/**
 * Utilidades compartidas por las pruebas de base de datos: crea un Postgres
 * en memoria (PGlite) con la réplica de Supabase y la migración de EcoFlow, y
 * permite "hacerse pasar" por un usuario igual que lo hace PostgREST.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('../migrations/', import.meta.url);
export const MIGRACIONES = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(new URL(f, dir), 'utf8'));
const STUB = readFileSync(new URL('./supabase-stub.sql', import.meta.url), 'utf8');

export async function crearBase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUB);
  for (const sql of MIGRACIONES) await db.exec(sql);
  return db;
}

type Fila = Record<string, unknown>;

/** Sesión dentro de una transacción que siempre se revierte. */
export class Sesion {
  constructor(private readonly db: PGlite) {}

  /** null = visitante anónimo. Cambia rol de Postgres y JWT como PostgREST. */
  async como(sub: string | null) {
    const rol = sub ? 'authenticated' : 'anon';
    await this.db.exec('reset role');
    await this.db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub, role: rol }),
    ]);
    await this.db.exec(`set local role ${rol}`);
  }

  /** Superusuario: equivale al editor SQL / panel de Supabase. */
  async comoServidor() {
    await this.db.exec('reset role');
    await this.db.query(`select set_config('request.jwt.claims', '', true)`);
  }

  async filas<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.db.query<T>(sql, params)).rows;
  }

  async afectadas(sql: string, params: unknown[] = []): Promise<number> {
    return (await this.db.query(sql, params)).affectedRows ?? 0;
  }

  /** Devuelve el SQLSTATE del error, o null si la sentencia funcionó. */
  async codigoError(sql: string, params: unknown[] = []): Promise<string | null> {
    await this.db.exec('savepoint intento');
    try {
      await this.db.query(sql, params);
      await this.db.exec('release savepoint intento');
      return null;
    } catch (e) {
      await this.db.exec('rollback to savepoint intento');
      return (e as { code?: string }).code ?? 'desconocido';
    }
  }
}

export function enTransaccion(obtenerDb: () => PGlite, prueba: (s: Sesion) => Promise<void>) {
  return async () => {
    const db = obtenerDb();
    await db.exec('begin');
    try {
      await prueba(new Sesion(db));
    } finally {
      await db.exec('rollback');
    }
  };
}
