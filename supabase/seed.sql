-- =====================================================================
-- EcoFlow · Datos de ejemplo para la demo (NO usar en producción).
--
-- Uso con un proyecto de Supabase en la nube:
--   1. Ejecuta la migración (supabase/migrations/…_esquema_ecoflow.sql).
--   2. En Authentication → Users → "Add user" crea, con contraseña:
--        laura@ecoflow.test   (será la coordinadora)
--        andres@ecoflow.test  (instalador)
--        camila@ecoflow.test  (instalador)
--      El trigger al_registrar_usuario les crea el perfil como "instalador".
--   3. Ejecuta este archivo en el SQL Editor.
--
-- Se ejecuta como superusuario (postgres), igual que el SQL Editor: no pasa
-- por RLS, pero SÍ por los triggers (stock, completado_en). Es idempotente:
-- se puede ejecutar varias veces sin duplicar datos.
-- =====================================================================

insert into public.materiales (sku, nombre, tipo, unidad, potencia_w, stock) values
  ('PAN-550-MONO', 'Panel monocristalino 550 W',      'panel',      'unidad', 550,   273),
  ('PAN-450-BIF',  'Panel bifacial 450 W',            'panel',      'unidad', 450,   186),
  ('INV-5K-HIB',   'Inversor híbrido 5 kW',           'inversor',   'unidad', 5000,  13),
  ('INV-50K-TRI',  'Inversor trifásico 50 kW',        'inversor',   'unidad', 50000, 4),
  ('BAT-10K-LFP',  'Batería LFP 10 kWh',              'bateria',    'unidad', null,  8),
  ('EST-COPL-AL',  'Estructura coplanar de aluminio', 'estructura', 'kit',    null,  300),
  ('CAB-6MM-PV',   'Cable solar 6 mm²',               'cableado',   'metro',  null,  2000)
on conflict (sku) do nothing;
-- Stock INICIAL: tras descontar los materiales de abajo queda igual que en el modo demo.

do $$
declare
  v_laura  uuid := (select id from public.instaladores where email = 'laura@ecoflow.test');
  v_andres uuid := (select id from public.instaladores where email = 'andres@ecoflow.test');
  v_camila uuid := (select id from public.instaladores where email = 'camila@ecoflow.test');
  v_p1 uuid; v_p2 uuid; v_p4 uuid;
  mat  constant text := 'select id from public.materiales where sku = $1';
  m    uuid;
begin
  if v_laura is null or v_andres is null or v_camila is null then
    raise notice 'Seed: faltan usuarios (laura/andres/camila@ecoflow.test). Solo se cargaron materiales.';
    return;
  end if;

  -- SEG-03: el rol de coordinador solo se asigna desde el servidor.
  update public.instaladores set rol = 'coordinador', telefono = '+57 300 111 0001' where id = v_laura;
  update public.instaladores set telefono = '+57 300 111 0002' where id = v_andres;
  update public.instaladores set telefono = '+57 300 111 0003' where id = v_camila;

  if exists (select 1 from public.proyectos) then
    raise notice 'Seed: ya hay proyectos; no se insertan de nuevo.';
    return;
  end if;

  insert into public.proyectos (nombre, cliente, direccion, ciudad, capacidad_kw, estado, instalador_id, fecha_inicio, fecha_fin_estimada, creado_por)
  values ('Techo residencial Ruiz', 'Familia Ruiz', 'Calle 10 # 43-21', 'Medellín', 5.5, 'pendiente', v_andres, '2026-12-01', '2026-12-04', v_laura)
  returning id into v_p1;
  insert into public.proyectos (nombre, cliente, direccion, ciudad, capacidad_kw, estado, instalador_id, fecha_inicio, fecha_fin_estimada, creado_por)
  values ('Bodega Solar Norte', 'Logística Norte SAS', 'Km 3 vía Bello', 'Bello', 48, 'en_progreso', v_camila, '2026-11-10', '2026-11-30', v_laura)
  returning id into v_p2;
  insert into public.proyectos (nombre, cliente, direccion, ciudad, capacidad_kw, estado, instalador_id, fecha_inicio, fecha_fin_estimada, creado_por)
  values ('Finca El Sol', 'Agroindustrial El Sol', 'Vereda La Palma', 'Rionegro', 12.5, 'en_progreso', v_andres, '2026-11-15', '2026-11-28', v_laura)
  returning id into v_p4;

  -- completado_en lo pone el trigger (RN-04).
  insert into public.proyectos (nombre, cliente, direccion, ciudad, capacidad_kw, estado, instalador_id, fecha_inicio, fecha_fin_estimada, creado_por) values
    ('Colegio San José',    'Colegio San José',     'Carrera 50 # 12-30', 'Envigado', 25, 'pendiente',  null,     '2027-01-12', '2027-01-26', v_laura),
    ('Clínica Las Palmas',  'Clínica Las Palmas',   'Calle 33 # 80-12',   'Medellín', 60, 'completado', v_camila, '2026-09-01', '2026-09-25', v_laura),
    ('Panadería Doña Rosa', 'Rosa Álvarez',         'Carrera 45 # 70-05', 'Itagüí',   8,  'completado', v_andres, '2026-10-05', '2026-10-09', v_laura);

  -- El trigger ajustar_stock_material descuenta el inventario (RN-08).
  execute mat into m using 'PAN-550-MONO'; insert into public.proyecto_materiales values (v_p1, m, 10), (v_p4, m, 23);
  execute mat into m using 'INV-5K-HIB';   insert into public.proyecto_materiales values (v_p1, m, 1);
  execute mat into m using 'PAN-450-BIF';  insert into public.proyecto_materiales values (v_p2, m, 106);
  execute mat into m using 'INV-50K-TRI';  insert into public.proyecto_materiales values (v_p2, m, 1);
  execute mat into m using 'BAT-10K-LFP';  insert into public.proyecto_materiales values (v_p4, m, 2);

  raise notice 'Seed: 6 proyectos creados.';
end $$;
