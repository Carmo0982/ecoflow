import { useCallback, useEffect, useState } from 'react';
import type { NuevoProyecto } from '@/lib/dominio';
import { mensajeDe } from '@/lib/errores';
import { useRepositorio } from '@/lib/repositorio/contexto';
import { useConsulta } from './useConsulta';
import { usePerfil } from './useSesion';

/** Totales por estado (vista resumen_proyectos, filtrada por RLS). */
export function useResumen() {
  const repo = useRepositorio();
  const { id } = usePerfil();
  const consulta = useConsulta(() => repo.resumen(), [repo, id]);
  const { recargar } = consulta;
  useEffect(() => repo.suscribirCambios(() => recargar({ silenciosa: true })), [repo, recargar]);
  return consulta;
}

export function useProyecto(idProyecto: string) {
  const repo = useRepositorio();
  const { id } = usePerfil();
  return useConsulta(() => repo.obtenerProyecto(idProyecto), [repo, id, idProyecto]);
}

export function useInstaladores() {
  const repo = useRepositorio();
  const { id } = usePerfil();
  return useConsulta(() => repo.listarInstaladores(), [repo, id]);
}

export function useMateriales() {
  const repo = useRepositorio();
  const { id } = usePerfil();
  return useConsulta(() => repo.listarMateriales(), [repo, id]);
}

/** Envío del formulario: estado de envío + error del servidor. */
export function useCrearProyecto() {
  const repo = useRepositorio();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useCallback(
    async (datos: NuevoProyecto): Promise<string | null> => {
      setEnviando(true);
      setError(null);
      try {
        return await repo.crearProyecto(datos);
      } catch (e) {
        setError(mensajeDe(e));
        return null;
      } finally {
        setEnviando(false);
      }
    },
    [repo],
  );

  return { crear, enviando, error };
}
