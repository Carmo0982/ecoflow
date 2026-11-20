import { crearRepositorioDemo } from './demo';
import type { Repositorio } from './tipos';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * Elige la implementación según el entorno. supabase-js se importa de forma
 * dinámica: en modo demo ni siquiera se descarga.
 */
export async function crearRepositorio(): Promise<Repositorio> {
  if (url && anonKey) {
    const { crearRepositorioSupabase } = await import('./supabase');
    return crearRepositorioSupabase(url, anonKey);
  }
  return crearRepositorioDemo();
}
