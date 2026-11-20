// @vitest-environment node
/** El seed de la demo se ejecuta sin errores, respeta los triggers y es idempotente. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MATERIALES_DEMO } from '../../src/lib/repositorio/demo';
import { crearBase } from './entorno';

const SEED = readFileSync(new URL('../seed.sql', import.meta.url), 'utf8');

describe('supabase/seed.sql', () => {
  it('sin usuarios solo carga materiales', async () => {
    const db = await crearBase();
    await db.exec(SEED);
    const { rows } = await db.query<{ m: number; p: number }>(
      'select (select count(*)::int from public.materiales) m, (select count(*)::int from public.proyectos) p');
    expect(rows[0]).toEqual({ m: 7, p: 0 });
    await db.close();
  }, 30_000);

  it('con usuarios crea proyectos, asigna la coordinadora y descuenta stock; dos ejecuciones = mismo resultado', async () => {
    const db = await crearBase();
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
      (gen_random_uuid(), 'laura@ecoflow.test', '{"nombre":"Laura Gómez"}'),
      (gen_random_uuid(), 'andres@ecoflow.test', '{"nombre":"Andrés Restrepo"}'),
      (gen_random_uuid(), 'camila@ecoflow.test', '{"nombre":"Camila Ríos"}')`);
    await db.exec(SEED);
    await db.exec(SEED); // idempotente

    const q = async <T,>(sql: string) => (await db.query<T>(sql)).rows;
    expect(await q(`select rol from public.instaladores where email = 'laura@ecoflow.test'`)).toEqual([{ rol: 'coordinador' }]);
    expect(await q(`select estado::text, count(*)::int n, count(completado_en)::int c from public.proyectos group by 1 order by 1`))
      .toEqual([
        { estado: 'completado', n: 2, c: 2 },
        { estado: 'en_progreso', n: 2, c: 0 },
        { estado: 'pendiente', n: 2, c: 0 },
      ]);
    // Tras el seed, el inventario coincide con el del modo demo (src/lib/repositorio/demo.ts).
    const stock = await q<{ sku: string; stock: number }>(`select sku, stock from public.materiales`);
    expect(Object.fromEntries(stock.map((m) => [m.sku, m.stock]))).toEqual(
      Object.fromEntries(MATERIALES_DEMO.map((m) => [m.sku, m.stock])));
    await db.close();
  }, 30_000);
});
