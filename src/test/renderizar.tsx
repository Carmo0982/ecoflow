import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RutaProtegida } from '@/App';
import { SesionProvider } from '@/hooks/useSesion';
import { RepositorioProvider } from '@/lib/repositorio/contexto';
import { crearRepositorioDemo, USUARIOS_DEMO } from '@/lib/repositorio/demo';
import type { Repositorio } from '@/lib/repositorio/tipos';

export { USUARIOS_DEMO };

/** Repositorio demo sin latencia, con la posibilidad de sobrescribir métodos (repositorio falso). */
export function repoPrueba(usuario = USUARIOS_DEMO.LAURA, cambios: Partial<Repositorio> = {}): Repositorio {
  return { ...crearRepositorioDemo({ latenciaMs: 0, usuarioInicial: usuario }), ...cambios };
}

/** Monta un elemento con repositorio, sesión y router en memoria. */
export function renderizar(
  ui: ReactElement,
  { repo = repoPrueba(), ruta = '/', patron = '/' }: { repo?: Repositorio; ruta?: string; patron?: string } = {},
) {
  return render(
    <RepositorioProvider repositorio={repo}>
      <SesionProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            {/* La misma puerta de sesión que usa la app real. */}
            <Route element={<RutaProtegida />}>
              <Route path={patron} element={ui} />
              <Route path="/proyectos/:id" element={<p>Detalle abierto</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SesionProvider>
    </RepositorioProvider>,
  );
}
