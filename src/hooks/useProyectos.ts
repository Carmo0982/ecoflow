import { useCallback, useEffect, useState } from 'react';
import { siguienteEstado, type Proyecto } from '@/lib/dominio';
import { mensajeDe } from '@/lib/errores';
import { useRepositorio } from '@/lib/repositorio/contexto';
import { usePerfil } from './useSesion';
import { useConsulta } from './useConsulta';

/**
 * Lista de proyectos visibles para el usuario (RLS decide cuáles) +
 * avance de estado optimista + sincronización en tiempo real (UI-07).
 */
export function useProyectos() {
  const repo = useRepositorio();
  const perfil = usePerfil();
  const consulta = useConsulta(() => repo.listarProyectos(), [repo, perfil.id]);
  const { recargar, setDatos } = consulta;
  const [enCurso, setEnCurso] = useState<ReadonlySet<string>>(new Set());
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // UI-07: otro usuario cambió algo → recarga silenciosa (sin parpadeo de carga).
  useEffect(() => repo.suscribirCambios(() => recargar({ silenciosa: true })), [repo, recargar]);

  const avanzar = useCallback(
    async (proyecto: Proyecto) => {
      const destino = siguienteEstado(proyecto.estado);
      if (!destino) return;
      setErrorAccion(null);
      setEnCurso((s) => new Set(s).add(proyecto.id));
      // UI-03: actualización optimista; si la BD lo rechaza, se revierte.
      const cambiar = (estado: Proyecto['estado']) =>
        setDatos((lista) => lista?.map((p) => (p.id === proyecto.id ? { ...p, estado } : p)));
      cambiar(destino);
      try {
        await repo.cambiarEstado(proyecto.id, destino);
      } catch (e) {
        cambiar(proyecto.estado);
        setErrorAccion(mensajeDe(e));
      } finally {
        setEnCurso((s) => {
          const n = new Set(s);
          n.delete(proyecto.id);
          return n;
        });
      }
    },
    [repo, setDatos],
  );

  return {
    proyectos: consulta.datos,
    cargando: consulta.cargando,
    error: consulta.error,
    recargar,
    avanzar,
    enCurso,
    errorAccion,
    limpiarErrorAccion: () => setErrorAccion(null),
  };
}
