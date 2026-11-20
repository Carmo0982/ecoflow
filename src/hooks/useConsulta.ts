import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react';
import { mensajeDe } from '@/lib/errores';

export interface EstadoConsulta<T> {
  datos: T | undefined;
  cargando: boolean;
  error: string | null;
  /** Vuelve a pedir los datos. Con `silenciosa` no muestra el estado de carga (p. ej. realtime). */
  recargar: (opciones?: { silenciosa?: boolean }) => void;
  /** Permite actualizaciones optimistas desde otros hooks. */
  setDatos: Dispatch<SetStateAction<T | undefined>>;
}

/**
 * UI-05 · Hook genérico de lectura con estados de carga/error.
 *
 * Protege contra respuestas obsoletas: si llegan dos respuestas fuera de
 * orden (p. ej. el usuario cambia de rol en mitad de una carga), solo se
 * aplica la de la ÚLTIMA petición. Tampoco actualiza estado tras desmontar.
 */
export function useConsulta<T>(cargar: () => Promise<T>, deps: DependencyList): EstadoConsulta<T> {
  const [datos, setDatos] = useState<T | undefined>(undefined);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ultima = useRef(0);
  const cargarRef = useRef(cargar);
  // Siempre la última función (sin reescribir refs durante el render).
  useLayoutEffect(() => {
    cargarRef.current = cargar;
  });

  const ejecutar = useCallback((silenciosa = false) => {
    const id = ++ultima.current;
    if (!silenciosa) setCargando(true);
    cargarRef.current().then(
      (resultado) => {
        if (id !== ultima.current) return;
        setDatos(resultado);
        setError(null);
        setCargando(false);
      },
      (e: unknown) => {
        if (id !== ultima.current) return;
        setError(mensajeDe(e));
        setCargando(false);
      },
    );
  }, []);

  useEffect(() => {
    ejecutar();
    return () => {
      ultima.current++; // invalida la petición en vuelo al cambiar deps o desmontar
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const recargar = useCallback((opciones?: { silenciosa?: boolean }) => ejecutar(opciones?.silenciosa), [ejecutar]);

  return { datos, cargando, error, recargar, setDatos };
}
