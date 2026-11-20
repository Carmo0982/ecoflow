import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Perfil } from '@/lib/dominio';
import { mensajeDe } from '@/lib/errores';
import { useRepositorio } from '@/lib/repositorio/contexto';

interface Sesion {
  perfil: Perfil | null;
  cargando: boolean;
  error: string | null;
  esCoordinador: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const SesionContext = createContext<Sesion | null>(null);

/** Carga el perfil (id + rol desde la tabla instaladores) y lo recarga al cambiar la sesión. */
export function SesionProvider({ children }: { children: ReactNode }) {
  const repo = useRepositorio();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    try {
      setPerfil(await repo.obtenerPerfil());
      setError(null);
    } catch (e) {
      setPerfil(null);
      setError(mensajeDe(e));
    } finally {
      setCargando(false);
    }
  }, [repo]);

  useEffect(() => {
    void refrescar();
    return repo.alCambiarSesion(() => void refrescar());
  }, [repo, refrescar]);

  const iniciarSesion = useCallback(
    async (email: string, password: string) => {
      await repo.iniciarSesion(email, password);
      await refrescar();
    },
    [repo, refrescar],
  );

  const cerrarSesion = useCallback(async () => {
    await repo.cerrarSesion();
    setPerfil(null);
  }, [repo]);

  const valor = useMemo<Sesion>(
    () => ({ perfil, cargando, error, esCoordinador: perfil?.rol === 'coordinador', iniciarSesion, cerrarSesion }),
    [perfil, cargando, error, iniciarSesion, cerrarSesion],
  );

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion(): Sesion {
  const s = useContext(SesionContext);
  if (!s) throw new Error('useSesion debe usarse dentro de <SesionProvider>');
  return s;
}

/** Para páginas protegidas: el perfil ya está garantizado por <RutaProtegida>. */
export function usePerfil(): Perfil {
  const { perfil } = useSesion();
  if (!perfil) throw new Error('usePerfil requiere una sesión iniciada');
  return perfil;
}
