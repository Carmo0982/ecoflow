import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorDatos } from '@/lib/errores';
import { useConsulta } from './useConsulta';

/** Promesa que la prueba resuelve cuando quiere (para forzar el desorden de red). */
function controlada<T>() {
  let resolver!: (v: T) => void;
  const promesa = new Promise<T>((r) => (resolver = r));
  return { promesa, resolver };
}

describe('useConsulta', () => {
  it('pasa por cargando → datos', async () => {
    const { result } = renderHook(() => useConsulta(() => Promise.resolve([1, 2]), []));
    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.datos).toEqual([1, 2]));
    expect(result.current).toMatchObject({ cargando: false, error: null });
  });

  it('traduce el error a un mensaje para el usuario', async () => {
    const { result } = renderHook(() => useConsulta(() => Promise.reject(new ErrorDatos('Sin conexión.')), []));
    await waitFor(() => expect(result.current.error).toBe('Sin conexión.'));
    const { result: r2 } = renderHook(() => useConsulta(() => Promise.reject(new Error('detalle interno')), []));
    await waitFor(() => expect(r2.current.error).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.'));
  });

  it('descarta una respuesta lenta que llega después de una más nueva', async () => {
    const lenta = controlada<string>();
    const rapida = controlada<string>();
    const { result, rerender } = renderHook(({ usuario }) => useConsulta(() => (usuario === 'A' ? lenta.promesa : rapida.promesa), [usuario]), {
      initialProps: { usuario: 'A' },
    });
    rerender({ usuario: 'B' }); // p. ej. cambio de usuario antes de que responda la 1.ª petición
    await act(async () => rapida.resolver('datos de B'));
    await act(async () => lenta.resolver('datos de A')); // llega tarde
    expect(result.current.datos).toBe('datos de B');
  });

  it('recarga silenciosa no vuelve a mostrar el estado de carga', async () => {
    let n = 0;
    const { result } = renderHook(() => useConsulta(() => Promise.resolve(++n), []));
    await waitFor(() => expect(result.current.datos).toBe(1));
    act(() => result.current.recargar({ silenciosa: true }));
    expect(result.current.cargando).toBe(false);
    await waitFor(() => expect(result.current.datos).toBe(2));
  });
});
