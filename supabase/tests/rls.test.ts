// @vitest-environment node
/**
 * Pruebas de la migración sobre Postgres real (PGlite). Cada `it` cita la
 * regla de docs/ESPECIFICACION_TECNICA.md que verifica y corre en una
 * transacción que se revierte, así las pruebas no se afectan entre sí.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearBase, enTransaccion, type Sesion } from './entorno';

const COORD = 'c0000000-0000-4000-8000-000000000001';
const ANDRES = 'a0000000-0000-4000-8000-000000000002';
const CAMILA = 'b0000000-0000-4000-8000-000000000003';
const PANEL = 'e0000000-0000-4000-8000-000000000001';
const INVERSOR = 'e0000000-0000-4000-8000-000000000002';
const P_ANDRES = 'f0000000-0000-4000-8000-000000000001'; // pendiente, asignado a Andrés
const P_CAMILA = 'f0000000-0000-4000-8000-000000000002'; // en_progreso, asignado a Camila
const P_LIBRE = 'f0000000-0000-4000-8000-000000000003'; // pendiente, sin instalador

let db: PGlite;
const t = (p: (s: Sesion) => Promise<void>) => enTransaccion(() => db, p);

beforeAll(async () => {
  db = await crearBase();
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${COORD}',  'laura@ecoflow.test',  '{"nombre":"Laura Coordinadora"}'),
      ('${ANDRES}', 'andres@ecoflow.test', '{"nombre":"Andrés Instalador"}'),
      ('${CAMILA}', 'camila@ecoflow.test', '{"nombre":"Camila Instaladora","rol":"coordinador"}');
    update public.instaladores set rol = 'coordinador' where id = '${COORD}';

    insert into public.materiales (id, sku, nombre, tipo, unidad, potencia_w, stock) values
      ('${PANEL}', 'PAN-550', 'Panel monocristalino 550 W', 'panel', 'unidad', 550, 100),
      ('${INVERSOR}', 'INV-5K', 'Inversor híbrido 5 kW', 'inversor', 'unidad', 5000, 5);

    insert into public.proyectos
      (id, nombre, cliente, direccion, ciudad, capacidad_kw, estado, instalador_id, fecha_inicio, fecha_fin_estimada, creado_por)
    values
      ('${P_ANDRES}', 'Techo Casa Ruiz', 'Familia Ruiz', 'Calle 10 # 4-21', 'Medellín', 5.5, 'pendiente', '${ANDRES}', '2026-12-01', '2026-12-05', '${COORD}'),
      ('${P_CAMILA}', 'Bodega Solar Norte', 'Logística Norte SAS', 'Km 3 vía Bello', 'Bello', 40, 'en_progreso', '${CAMILA}', '2026-11-10', '2026-11-30', '${COORD}'),
      ('${P_LIBRE}', 'Colegio San José', 'Colegio San José', 'Carrera 50 # 12-3', 'Envigado', 25, 'pendiente', null, '2027-01-10', '2027-01-25', '${COORD}');

    insert into public.proyecto_materiales (proyecto_id, material_id, cantidad) values
      ('${P_ANDRES}', '${PANEL}', 10),
      ('${P_CAMILA}', '${PANEL}', 70),
      ('${P_CAMILA}', '${INVERSOR}', 2);
  `);
}, 30_000);

afterAll(async () => db?.close());

const stock = async (s: Sesion, id: string) => {
  await s.comoServidor();
  const [fila] = await s.filas<{ stock: number }>('select stock from public.materiales where id = $1', [id]);
  return fila?.stock;
};

describe('Esquema e integridad', () => {
  it('SEG-04 · el trigger crea el perfil como instalador aunque la metadata pida "coordinador"', t(async (s) => {
    await s.comoServidor();
    const [camila] = await s.filas<{ rol: string; nombre: string }>(
      'select rol, nombre from public.instaladores where id = $1', [CAMILA]);
    expect(camila).toEqual({ rol: 'instalador', nombre: 'Camila Instaladora' });
  }));

  it('RN-08 · el seed descontó stock por trigger (100 − 10 − 70 = 20 paneles)', t(async (s) => {
    expect(await stock(s, PANEL)).toBe(20);
    expect(await stock(s, INVERSOR)).toBe(3);
  }));

  it('RN-03 · no se puede iniciar un proyecto sin instalador', t(async (s) => {
    await s.como(COORD);
    expect(await s.codigoError(`update public.proyectos set estado = 'en_progreso' where id = $1`, [P_LIBRE]))
      .toBe('23514');
  }));

  it('RN-05 / RN-06 · fechas incoherentes y capacidades fuera de rango se rechazan', t(async (s) => {
    await s.como(COORD);
    expect(await s.codigoError(
      `update public.proyectos set fecha_fin_estimada = '2026-01-01' where id = $1`, [P_LIBRE])).toBe('23514');
    expect(await s.codigoError(`update public.proyectos set capacidad_kw = 0 where id = $1`, [P_LIBRE])).toBe('23514');
  }));

  it('las claves foráneas impiden borrar un material en uso', t(async (s) => {
    await s.comoServidor();
    // ON DELETE RESTRICT responde 23001 (restrict_violation); NO ACTION respondería 23503.
    expect(await s.codigoError('delete from public.materiales where id = $1', [PANEL])).toBe('23001');
  }));

  it('UI-07 · proyectos está en la publicación de Realtime', t(async (s) => {
    await s.comoServidor();
    const tablas = await s.filas<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime'`);
    expect(tablas.map((x) => x.tablename)).toEqual(['proyectos']);
  }));
});

describe('SEG-01 · cada instalador solo ve sus proyectos asignados', () => {
  it('Andrés ve solo su proyecto; Camila solo el suyo; la coordinadora los tres', t(async (s) => {
    const ids = async (u: string) => {
      await s.como(u);
      return (await s.filas<{ id: string }>('select id from public.proyectos order by id')).map((p) => p.id);
    };
    expect(await ids(ANDRES)).toEqual([P_ANDRES]);
    expect(await ids(CAMILA)).toEqual([P_CAMILA]);
    expect(await ids(COORD)).toEqual([P_ANDRES, P_CAMILA, P_LIBRE]);
  }));

  it('los materiales de un proyecto ajeno tampoco son visibles (la política hereda la de proyectos)', t(async (s) => {
    await s.como(ANDRES);
    const filas = await s.filas<{ proyecto_id: string }>('select proyecto_id from public.proyecto_materiales');
    expect(new Set(filas.map((f) => f.proyecto_id))).toEqual(new Set([P_ANDRES]));
  }));

  it('un instalador no puede modificar un proyecto que no ve', t(async (s) => {
    await s.como(CAMILA);
    expect(await s.afectadas(`update public.proyectos set estado = 'en_progreso' where id = $1`, [P_ANDRES])).toBe(0);
  }));

  it('el instalador solo ve su propio perfil; la coordinadora ve el equipo', t(async (s) => {
    await s.como(ANDRES);
    expect(await s.filas('select id from public.instaladores')).toEqual([{ id: ANDRES }]);
    await s.como(COORD);
    expect(await s.filas('select id from public.instaladores')).toHaveLength(3);
  }));
});

describe('SEG-06 · el resumen del dashboard respeta RLS', () => {
  const resumen = async (s: Sesion, vista = 'public.resumen_proyectos') =>
    Object.fromEntries(
      (await s.filas<{ estado: string; total: number }>(`select estado, total from ${vista}`)).map((r) => [r.estado, r.total]),
    );

  it('Andrés ve sus totales; la coordinadora los globales', t(async (s) => {
    await s.como(ANDRES);
    expect(await resumen(s)).toEqual({ pendiente: 1, en_progreso: 0, completado: 0 });
    await s.como(COORD);
    expect(await resumen(s)).toEqual({ pendiente: 2, en_progreso: 1, completado: 0 });
  }));

  it('control: la MISMA vista sin security_invoker filtra los totales globales a Andrés', t(async (s) => {
    await s.comoServidor();
    await s.filas(`
      create view public.resumen_inseguro as
      select e.estado, count(p.id)::integer as total
      from unnest(enum_range(null::public.estado_proyecto)) as e (estado)
      left join public.proyectos p on p.estado = e.estado
      group by e.estado`);
    await s.filas('grant select on public.resumen_inseguro to authenticated');
    await s.como(ANDRES);
    expect(await resumen(s, 'public.resumen_inseguro')).toEqual({ pendiente: 2, en_progreso: 1, completado: 0 });
  }));
});

describe('SEG-02 / SEG-03 / SEG-05 / SEG-07 · privilegios', () => {
  it('SEG-05 · un anónimo no lee tablas, vista ni ejecuta la RPC', t(async (s) => {
    await s.como(null);
    expect(await s.codigoError('select * from public.proyectos')).toBe('42501');
    expect(await s.codigoError('select * from public.resumen_proyectos')).toBe('42501');
    expect(await s.codigoError('select * from public.materiales')).toBe('42501');
    expect(await s.codigoError(
      `select public.crear_proyecto('x','x','x','x',1,'2026-01-01','2026-01-02')`)).toBe('42501');
  }));

  it('SEG-02 · un instalador no puede crear proyectos (ni directo ni por la RPC)', t(async (s) => {
    await s.como(ANDRES);
    expect(await s.codigoError(
      `insert into public.proyectos (nombre, cliente, direccion, ciudad, capacidad_kw, fecha_inicio, fecha_fin_estimada)
       values ('Mi proyecto', 'Yo', 'Calle 1 # 1-1', 'Medellín', 3, '2026-12-01', '2026-12-02')`)).toBe('42501');
    expect(await s.codigoError(
      `select public.crear_proyecto('Mi proyecto','Yo','Calle 1 # 1-1','Medellín',3,'2026-12-01','2026-12-02')`)).toBe('42501');
  }));

  it('SEG-02 · un instalador no modifica el catálogo de materiales', t(async (s) => {
    await s.como(ANDRES);
    expect(await s.afectadas('update public.materiales set stock = 9999')).toBe(0);
  }));

  it('SEG-03 · nadie cambia su propio rol; el teléfono sí se puede editar', t(async (s) => {
    await s.como(ANDRES);
    expect(await s.codigoError(`update public.instaladores set rol = 'coordinador' where id = $1`, [ANDRES])).toBe('42501');
    expect(await s.afectadas(`update public.instaladores set telefono = '+57 300 000 0000' where id = $1`, [ANDRES])).toBe(1);
  }));

  it('SEG-07 · la coordinadora no puede registrar un proyecto a nombre de otra persona', t(async (s) => {
    await s.como(COORD);
    expect(await s.codigoError(
      `insert into public.proyectos (nombre, cliente, direccion, ciudad, capacidad_kw, fecha_inicio, fecha_fin_estimada, creado_por)
       values ('Proyecto X', 'Cliente', 'Calle 1 # 1-1', 'Medellín', 3, '2026-12-01', '2026-12-02', $1)`, [ANDRES])).toBe('42501');
  }));

  it('RN-01 · un proyecto no puede nacer en_progreso desde la app', t(async (s) => {
    await s.como(COORD);
    expect(await s.codigoError(
      `insert into public.proyectos (nombre, cliente, direccion, ciudad, capacidad_kw, fecha_inicio, fecha_fin_estimada, instalador_id, estado)
       values ('Proyecto X', 'Cliente', 'Calle 1 # 1-1', 'Medellín', 3, '2026-12-01', '2026-12-02', $1, 'en_progreso')`, [ANDRES])).toBe('42501');
  }));
});

describe('RN-02 / RN-04 / RN-10 · ciclo de vida del proyecto', () => {
  it('el instalador avanza su proyecto paso a paso y el servidor fecha la finalización', t(async (s) => {
    await s.como(ANDRES);
    const avanzar = (estado: string) =>
      s.codigoError(`update public.proyectos set estado = $1 where id = $2`, [estado, P_ANDRES]);
    expect(await avanzar('completado')).toBe('23514'); // no se salta pasos
    expect(await avanzar('en_progreso')).toBeNull();
    expect(await avanzar('completado')).toBeNull();
    const [p] = await s.filas<{ completado_en: Date | null }>(
      'select completado_en from public.proyectos where id = $1', [P_ANDRES]);
    expect(p?.completado_en).toBeInstanceOf(Date);
    expect(await avanzar('pendiente')).toBe('23514'); // no retrocede
  }));

  it('RN-10 · el instalador no puede cambiar otros campos ni reasignarse el proyecto', t(async (s) => {
    await s.como(ANDRES);
    expect(await s.codigoError(`update public.proyectos set capacidad_kw = 99 where id = $1`, [P_ANDRES])).toBe('42501');
    expect(await s.codigoError(`update public.proyectos set instalador_id = $1 where id = $2`, [CAMILA, P_ANDRES]))
      .toBe('42501');
  }));

  it('RN-10 · la coordinadora sí puede editar y reasignar', t(async (s) => {
    await s.como(COORD);
    expect(await s.afectadas(`update public.proyectos set instalador_id = $1, capacidad_kw = 30 where id = $2`, [CAMILA, P_LIBRE]))
      .toBe(1);
  }));
});

describe('RN-07 / RN-08 / RN-09 · creación atómica, stock y borrado', () => {
  const crear = (materiales: unknown[]) =>
    `select public.crear_proyecto('Finca El Sol', 'Finca El Sol SAS', 'Vereda La Palma', 'Rionegro', 12.5,
       '2027-02-01', '2027-02-10', '${ANDRES}', '${JSON.stringify(materiales)}'::jsonb) as id`;

  it('RN-07 · crea proyecto + materiales y descuenta stock', t(async (s) => {
    await s.como(COORD);
    const [fila] = await s.filas<{ id: string }>(crear([
      { material_id: PANEL, cantidad: 20 }, { material_id: INVERSOR, cantidad: 1 },
    ]));
    const [p] = await s.filas<{ estado: string; creado_por: string }>(
      'select estado, creado_por from public.proyectos where id = $1', [fila?.id]);
    expect(p).toEqual({ estado: 'pendiente', creado_por: COORD });
    expect(await s.filas('select * from public.proyecto_materiales where proyecto_id = $1', [fila?.id])).toHaveLength(2);
    expect(await stock(s, PANEL)).toBe(0);
    expect(await stock(s, INVERSOR)).toBe(2);
  }));

  it('RN-07 / RN-08 · sin stock suficiente no queda NADA a medias', t(async (s) => {
    await s.como(COORD);
    const err = await s.codigoError(crear([
      { material_id: INVERSOR, cantidad: 1 }, { material_id: PANEL, cantidad: 21 }, // solo hay 20
    ]));
    expect(err).toBe('P0001');
    await s.comoServidor();
    expect(await s.filas(`select 1 from public.proyectos where nombre = 'Finca El Sol'`)).toHaveLength(0);
    expect(await stock(s, INVERSOR)).toBe(3); // el inversor descontado se devolvió con el rollback
  }));

  it('RN-07 · materiales duplicados en la misma solicitud se rechazan', t(async (s) => {
    await s.como(COORD);
    expect(await s.codigoError(crear([
      { material_id: PANEL, cantidad: 1 }, { material_id: PANEL, cantidad: 1 },
    ]))).toBe('23505');
  }));

  it('RN-09 · borrar un proyecto pendiente devuelve su stock; uno en curso no se borra', t(async (s) => {
    await s.como(COORD);
    expect(await s.afectadas('delete from public.proyectos where id = $1', [P_CAMILA])).toBe(0);
    expect(await s.afectadas('delete from public.proyectos where id = $1', [P_ANDRES])).toBe(1);
    expect(await stock(s, PANEL)).toBe(30);
  }));
});
