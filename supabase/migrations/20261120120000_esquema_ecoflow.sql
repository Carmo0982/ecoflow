-- =====================================================================
-- EcoFlow · Esquema, reglas de negocio y seguridad (RLS)
-- Cada bloque cita las reglas de docs/ESPECIFICACION_TECNICA.md
-- (RN-* = negocio, SEG-* = seguridad).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos enumerados
-- ---------------------------------------------------------------------
create type public.estado_proyecto as enum ('pendiente', 'en_progreso', 'completado');
create type public.rol_equipo as enum ('instalador', 'coordinador');
create type public.tipo_material as enum ('panel', 'inversor', 'bateria', 'estructura', 'cableado', 'otro');

-- ---------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------

-- Perfil 1:1 con auth.users. Coordinadores e instaladores comparten tabla:
-- ambos son "equipo" y la diferencia es el rol (SEG-03).
create table public.instaladores (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null check (char_length(trim(nombre)) between 1 and 120),
  email      text not null unique,
  telefono   text check (telefono ~ '^\+?[0-9 -]{7,20}$'),
  rol        public.rol_equipo not null default 'instalador',
  creado_en  timestamptz not null default now()
);

create table public.materiales (
  id          uuid primary key default gen_random_uuid(),
  sku         text not null unique check (sku ~ '^[A-Z0-9-]{3,30}$'),
  nombre      text not null check (char_length(trim(nombre)) between 2 and 120),
  tipo        public.tipo_material not null,
  unidad      text not null default 'unidad',
  potencia_w  numeric(8, 2) check (potencia_w > 0),
  stock       integer not null default 0 check (stock >= 0),       -- RN-08
  creado_en   timestamptz not null default now()
);

create table public.proyectos (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null check (char_length(trim(nombre)) between 3 and 120),
  cliente             text not null check (char_length(trim(cliente)) between 2 and 120),
  direccion           text not null check (char_length(trim(direccion)) between 5 and 200),
  ciudad              text not null check (char_length(trim(ciudad)) between 2 and 80),
  capacidad_kw        numeric(8, 2) not null check (capacidad_kw > 0 and capacidad_kw <= 10000), -- RN-06
  estado              public.estado_proyecto not null default 'pendiente',                        -- RN-01
  instalador_id       uuid,
  fecha_inicio        date not null,
  fecha_fin_estimada  date not null,
  completado_en       timestamptz,
  creado_por          uuid not null default auth.uid(),
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  -- Nombres explícitos: el frontend los usa para desambiguar el "embedding"
  -- de PostgREST, porque hay DOS claves foráneas hacia instaladores.
  constraint proyectos_instalador_id_fkey
    foreign key (instalador_id) references public.instaladores (id) on delete set null,
  constraint proyectos_creado_por_fkey
    foreign key (creado_por) references public.instaladores (id) on delete restrict,

  constraint proyectos_fechas_coherentes check (fecha_fin_estimada >= fecha_inicio),            -- RN-05
  constraint proyectos_en_curso_con_instalador
    check (estado = 'pendiente' or instalador_id is not null),                                  -- RN-03
  constraint proyectos_completado_en_coherente
    check ((estado = 'completado') = (completado_en is not null))                               -- RN-04
);

-- Relación N:M proyecto ↔ material, con la cantidad usada.
create table public.proyecto_materiales (
  proyecto_id  uuid not null references public.proyectos (id) on delete cascade,
  material_id  uuid not null references public.materiales (id) on delete restrict,
  cantidad     integer not null check (cantidad between 1 and 10000),
  primary key (proyecto_id, material_id)
);

-- ---------------------------------------------------------------------
-- 3. Índices. Postgres NO indexa automáticamente las claves foráneas, y
--    las políticas RLS filtran por instalador_id en cada consulta.
-- ---------------------------------------------------------------------
create index proyectos_instalador_id_idx on public.proyectos (instalador_id);
create index proyectos_creado_por_idx on public.proyectos (creado_por);
create index proyectos_estado_idx on public.proyectos (estado);
create index proyecto_materiales_material_id_idx on public.proyecto_materiales (material_id);
-- (proyecto_id ya está cubierto por la PK compuesta, que empieza por él)

-- ---------------------------------------------------------------------
-- 4. Funciones auxiliares de seguridad
-- ---------------------------------------------------------------------

-- SEG-02/SEG-03: el rol se lee de la tabla (no del JWT ni de user_metadata).
-- SECURITY DEFINER para leer instaladores sin pasar por su RLS (evita
-- recursión); search_path vacío para que no se pueda secuestrar (SEG-08).
create or replace function public.es_coordinador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.instaladores
    where id = (select auth.uid()) and rol = 'coordinador'
  );
$$;

-- SEG-04: el perfil se crea en el servidor, siempre como 'instalador'.
create or replace function public.crear_perfil_equipo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.instaladores (id, nombre, email, rol)
  values (
    new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'nombre'), 120), ''), split_part(new.email, '@', 1)),
    new.email,
    'instalador'
  );
  return new;
end;
$$;

create trigger al_registrar_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_equipo();

-- ---------------------------------------------------------------------
-- 5. Reglas de negocio en triggers (se cumplen sin importar el cliente)
-- ---------------------------------------------------------------------

-- RN-02, RN-04 y RN-10. SECURITY INVOKER (por defecto): current_user es el
-- rol de quien hace el UPDATE, así se distingue la app del panel de Supabase.
create or replace function public.proyectos_reglas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- RN-10: un instalador solo puede cambiar el estado.
    if current_user = 'authenticated' and not public.es_coordinador()
       and (to_jsonb(new) - 'estado' - 'actualizado_en' - 'completado_en')
           is distinct from (to_jsonb(old) - 'estado' - 'actualizado_en' - 'completado_en') then
      raise exception 'Un instalador solo puede cambiar el estado del proyecto'
        using errcode = '42501';
    end if;

    -- RN-02: el estado solo avanza un paso.
    if new.estado is distinct from old.estado
       and not (old.estado = 'pendiente' and new.estado = 'en_progreso')
       and not (old.estado = 'en_progreso' and new.estado = 'completado') then
      raise exception 'Transición de estado no permitida: % → %', old.estado, new.estado
        using errcode = '23514';
    end if;
  end if;

  -- RN-04: la fecha de completado la pone el servidor.
  new.completado_en := case
    when new.estado = 'completado'
      then coalesce(case when tg_op = 'UPDATE' then old.completado_en end, new.completado_en, now())
    else null
  end;
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger proyectos_reglas
  before insert or update on public.proyectos
  for each row execute function public.proyectos_reglas();

-- RN-08: el stock se ajusta SIEMPRE que cambia proyecto_materiales, venga
-- de la RPC, del panel o de un script. El UPDATE con "stock >= n" bloquea
-- la fila del material y evita sobreasignar con peticiones simultáneas.
create or replace function public.ajustar_stock_material()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_delta integer;
begin
  if tg_op = 'DELETE' then
    update public.materiales set stock = stock + old.cantidad where id = old.material_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.material_id <> old.material_id then
    raise exception 'No se puede cambiar el material de una línea; elimínala y crea otra'
      using errcode = '22023';
  end if;

  v_delta := new.cantidad - case when tg_op = 'UPDATE' then old.cantidad else 0 end;

  if v_delta > 0 then
    update public.materiales set stock = stock - v_delta
     where id = new.material_id and stock >= v_delta;
    if not found then
      raise exception 'Stock insuficiente para el material %', new.material_id
        using errcode = 'P0001';
    end if;
  elsif v_delta < 0 then
    update public.materiales set stock = stock - v_delta where id = new.material_id;
  end if;
  return new;
end;
$$;

create trigger proyecto_materiales_stock
  before insert or update on public.proyecto_materiales
  for each row execute function public.ajustar_stock_material();

create trigger proyecto_materiales_devolver_stock
  after delete on public.proyecto_materiales
  for each row execute function public.ajustar_stock_material();

-- ---------------------------------------------------------------------
-- 6. RPC: crear un proyecto con sus materiales de forma atómica (RN-07)
-- ---------------------------------------------------------------------
-- SECURITY INVOKER a propósito: solo se necesita atomicidad (una llamada =
-- una transacción), no privilegios extra. Las políticas RLS del usuario se
-- siguen aplicando, así que un instalador no puede usarla para crear nada.
create or replace function public.crear_proyecto(
  p_nombre text,
  p_cliente text,
  p_direccion text,
  p_ciudad text,
  p_capacidad_kw numeric,
  p_fecha_inicio date,
  p_fecha_fin_estimada date,
  p_instalador_id uuid default null,
  p_materiales jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_materiales) is distinct from 'array' then
    raise exception 'p_materiales debe ser un arreglo' using errcode = '22023';
  end if;

  insert into public.proyectos
    (nombre, cliente, direccion, ciudad, capacidad_kw, fecha_inicio, fecha_fin_estimada, instalador_id)
  values
    (trim(p_nombre), trim(p_cliente), trim(p_direccion), trim(p_ciudad), p_capacidad_kw,
     p_fecha_inicio, p_fecha_fin_estimada, p_instalador_id)
  returning id into v_id;

  -- Orden fijo por material_id: dos creaciones simultáneas bloquean las
  -- filas de materiales en el mismo orden (sin interbloqueos).
  insert into public.proyecto_materiales (proyecto_id, material_id, cantidad)
  select v_id, x.material_id, x.cantidad
  from jsonb_to_recordset(p_materiales) as x(material_id uuid, cantidad integer)
  order by x.material_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Vista del dashboard (UI-01, SEG-06)
-- ---------------------------------------------------------------------
-- security_invoker = true: la vista se evalúa con los permisos de quien
-- consulta, así que las políticas RLS de proyectos se aplican dentro. Sin
-- esta opción, una vista corre con los permisos de su dueño (postgres) y
-- un instalador vería los totales de TODA la empresa.
create view public.resumen_proyectos
with (security_invoker = true)
as
select
  e.estado,
  count(p.id)::integer                           as total,
  coalesce(sum(p.capacidad_kw), 0)::numeric(12, 2) as capacidad_kw
from unnest(enum_range(null::public.estado_proyecto)) as e (estado)
left join public.proyectos p on p.estado = e.estado
group by e.estado
order by e.estado;

-- ---------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------
alter table public.instaladores        enable row level security;
alter table public.materiales          enable row level security;
alter table public.proyectos           enable row level security;
alter table public.proyecto_materiales enable row level security;

-- INSTALADORES ---------------------------------------------------------
create policy "instaladores: cada uno se ve a sí mismo; el coordinador ve a todos"
  on public.instaladores for select to authenticated
  using (id = (select auth.uid()) or (select public.es_coordinador()));

create policy "instaladores: cada uno edita su contacto"
  on public.instaladores for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- PROYECTOS ------------------------------------------------------------
-- SEG-01: el instalador solo ve lo asignado a él.
create policy "proyectos: el instalador ve los suyos; el coordinador ve todos"
  on public.proyectos for select to authenticated
  using (instalador_id = (select auth.uid()) or (select public.es_coordinador()));

-- SEG-02 + SEG-07 + RN-01
create policy "proyectos: solo el coordinador crea"
  on public.proyectos for insert to authenticated
  with check (
    (select public.es_coordinador())
    and creado_por = (select auth.uid())
    and estado = 'pendiente'
  );

-- El instalador puede actualizar su proyecto (el trigger limita QUÉ cambia,
-- RN-10); WITH CHECK impide que se lo reasigne a otra persona.
create policy "proyectos: el asignado o el coordinador actualizan"
  on public.proyectos for update to authenticated
  using (instalador_id = (select auth.uid()) or (select public.es_coordinador()))
  with check (instalador_id = (select auth.uid()) or (select public.es_coordinador()));

create policy "proyectos: el coordinador elimina pendientes"                -- RN-09
  on public.proyectos for delete to authenticated
  using ((select public.es_coordinador()) and estado = 'pendiente');

-- MATERIALES -----------------------------------------------------------
create policy "materiales: catálogo visible para el equipo"
  on public.materiales for select to authenticated
  using (true); -- inventario interno sin datos personales; anon no tiene GRANT

create policy "materiales: el coordinador gestiona el catálogo"
  on public.materiales for all to authenticated
  using ((select public.es_coordinador()))
  with check ((select public.es_coordinador()));

-- PROYECTO_MATERIALES --------------------------------------------------
-- La subconsulta a proyectos también pasa por la RLS de proyectos: si no
-- puedes ver el proyecto, no ves sus materiales (SEG-01 se hereda).
create policy "proyecto_materiales: visibles con su proyecto"
  on public.proyecto_materiales for select to authenticated
  using (exists (select 1 from public.proyectos p where p.id = proyecto_materiales.proyecto_id));

create policy "proyecto_materiales: el coordinador gestiona"
  on public.proyecto_materiales for all to authenticated
  using ((select public.es_coordinador()))
  with check ((select public.es_coordinador()));

-- ---------------------------------------------------------------------
-- 9. Privilegios (segunda capa, por debajo de RLS)
-- ---------------------------------------------------------------------
-- Supabase da GRANT ALL a anon y authenticated sobre lo que se crea en public.
revoke all on public.instaladores, public.materiales, public.proyectos,
              public.proyecto_materiales, public.resumen_proyectos from anon;      -- SEG-05

-- TRUNCATE no pasa por RLS: se revoca aunque PostgREST no lo exponga.
revoke truncate, references, trigger on public.instaladores, public.materiales,
       public.proyectos, public.proyecto_materiales from authenticated;

-- SEG-03: el perfil solo se edita en nombre y teléfono; el rol jamás.
revoke insert, update, delete on public.instaladores from authenticated;
grant update (nombre, telefono) on public.instaladores to authenticated;

-- La vista es de solo lectura.
revoke insert, update, delete on public.resumen_proyectos from authenticated;

-- SEG-08: funciones fuera del alcance de anon.
revoke execute on function public.es_coordinador() from public, anon;
revoke execute on function public.crear_perfil_equipo() from public, anon, authenticated;
revoke execute on function public.crear_proyecto(text, text, text, text, numeric, date, date, uuid, jsonb)
  from public, anon;
grant execute on function public.es_coordinador() to authenticated;
grant execute on function public.crear_proyecto(text, text, text, text, numeric, date, date, uuid, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------
-- 10. Realtime (UI-07). Supabase Realtime respeta RLS en postgres_changes.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.proyectos;
  end if;
end;
$$;
