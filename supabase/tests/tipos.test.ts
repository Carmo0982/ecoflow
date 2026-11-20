// @vitest-environment node
/**
 * ARQ-05 · Los tipos de src/types/database.ts los propuso la IA. Esta prueba
 * los contrasta con el esquema REAL (migración aplicada en PGlite) leyendo
 * information_schema y pg_catalog. Si alguien cambia la migración y olvida
 * regenerar los tipos, o la IA "inventó" una columna, la prueba falla.
 */
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Constants } from '../../src/types/database';
import { crearBase } from './entorno';

const fuente = readFileSync(new URL('../../src/types/database.ts', import.meta.url), 'utf8');

interface Campo {
  opcional: boolean;
  tipo: string;
}

/** Extrae los campos de un bloque `Nombre: { ... }` dentro de una tabla o vista. */
function campos(relacion: string, bloque: 'Row' | 'Insert'): Map<string, Campo> {
  const inicio = fuente.indexOf(`      ${relacion}: {`);
  if (inicio < 0) throw new Error(`No se encontró ${relacion} en database.ts`);
  const desde = fuente.indexOf(`${bloque}: {`, inicio);
  const hasta = fuente.indexOf('};', desde);
  const cuerpo = fuente.slice(desde + bloque.length + 3, hasta);
  const mapa = new Map<string, Campo>();
  for (const m of cuerpo.matchAll(/^\s*(\w+)(\?)?: (.+);$/gm)) {
    mapa.set(m[1]!, { opcional: m[2] === '?', tipo: m[3]! });
  }
  return mapa;
}

interface Columna {
  relacion: string;
  columna: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
}

const TIPO_TS: Record<string, string> = {
  uuid: 'string',
  text: 'string',
  date: 'string',
  'timestamp with time zone': 'string',
  numeric: 'number',
  integer: 'number',
  jsonb: 'Json',
};

const tipoEsperado = (c: Columna) =>
  c.data_type === 'USER-DEFINED' ? `Database['public']['Enums']['${c.udt_name}']` : TIPO_TS[c.data_type];

let db: PGlite;
let columnas: Columna[];

beforeAll(async () => {
  db = await crearBase();
  columnas = (
    await db.query<Columna>(`
      select table_name as relacion, column_name as columna, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, column_name`)
  ).rows;
}, 30_000);

afterAll(async () => db?.close());

const TABLAS = ['instaladores', 'materiales', 'proyecto_materiales', 'proyectos'];

describe('database.ts refleja la migración', () => {
  it.each(TABLAS)('tabla %s: mismas columnas, tipos y nulabilidad en Row', (tabla) => {
    const reales = columnas.filter((c) => c.relacion === tabla);
    const row = campos(tabla, 'Row');
    expect([...row.keys()].sort()).toEqual(reales.map((c) => c.columna).sort());
    for (const c of reales) {
      const esperado = tipoEsperado(c) + (c.is_nullable === 'YES' ? ' | null' : '');
      expect(row.get(c.columna)?.tipo, `${tabla}.${c.columna}`).toBe(esperado);
    }
  });

  it.each(TABLAS)('tabla %s: en Insert solo es obligatorio lo que no tiene default ni admite null', (tabla) => {
    const insert = campos(tabla, 'Insert');
    for (const c of columnas.filter((x) => x.relacion === tabla)) {
      const opcional = c.column_default !== null || c.is_nullable === 'YES';
      expect(insert.get(c.columna)?.opcional, `${tabla}.${c.columna}`).toBe(opcional);
    }
  });

  it('vista resumen_proyectos: mismas columnas (las vistas siempre se tipan como nullable)', () => {
    const reales = columnas.filter((c) => c.relacion === 'resumen_proyectos');
    const row = campos('resumen_proyectos', 'Row');
    expect([...row.keys()].sort()).toEqual(reales.map((c) => c.columna).sort());
    for (const c of reales) expect(row.get(c.columna)?.tipo).toBe(`${tipoEsperado(c)} | null`);
  });

  it('los enums tienen los mismos valores y en el mismo orden', async () => {
    const { rows } = await db.query<{ tipo: string; valores: string[] }>(`
      select t.typname as tipo, array_agg(e.enumlabel order by e.enumsortorder) as valores
      from pg_type t join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'public'
      group by t.typname`);
    const reales = Object.fromEntries(rows.map((r) => [r.tipo, r.valores]));
    expect(reales).toEqual(Constants.public.Enums);
  });

  it('crear_proyecto: mismos argumentos y los opcionales son los que tienen DEFAULT', async () => {
    const { rows } = await db.query<{ args: string[]; con_default: number }>(`
      select proargnames as args, pronargdefaults as con_default
      from pg_proc where proname = 'crear_proyecto'`);
    const [fn] = rows;
    const args = campos('crear_proyecto', 'Args' as 'Row');
    expect([...args.keys()].sort()).toEqual([...fn!.args].sort());
    const opcionales = fn!.args.slice(fn!.args.length - fn!.con_default);
    for (const a of fn!.args) expect(args.get(a)?.opcional, a).toBe(opcionales.includes(a));
  });

  it('las relaciones declaradas existen como claves foráneas con ese nombre', async () => {
    const declaradas = [...fuente.matchAll(/foreignKeyName: '(\w+)'/g)].map((m) => m[1]).sort();
    const { rows } = await db.query<{ conname: string }>(`
      select conname from pg_constraint c join pg_class r on r.oid = c.conrelid
      join pg_namespace n on n.oid = r.relnamespace
      where c.contype = 'f' and n.nspname = 'public' and r.relname <> 'instaladores'
      order by conname`);
    expect(declaradas).toEqual(rows.map((r) => r.conname));
  });
});
