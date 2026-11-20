import { createContext, useContext, type ReactNode } from 'react';
import type { Repositorio } from './tipos';

const RepositorioContext = createContext<Repositorio | null>(null);

/** Inyección de dependencias: la app, el modo demo o una prueba eligen el repositorio. */
export function RepositorioProvider({ repositorio, children }: { repositorio: Repositorio; children: ReactNode }) {
  return <RepositorioContext.Provider value={repositorio}>{children}</RepositorioContext.Provider>;
}

export function useRepositorio(): Repositorio {
  const repo = useContext(RepositorioContext);
  if (!repo) throw new Error('useRepositorio debe usarse dentro de <RepositorioProvider>');
  return repo;
}
