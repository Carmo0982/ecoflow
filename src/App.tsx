import { lazy } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router';
import { CargandoFilas, ErrorCarga, Vacio } from '@/components/estados';
import { Layout } from '@/components/Layout';
import { SesionProvider, useSesion } from '@/hooks/useSesion';
import { RepositorioProvider } from '@/lib/repositorio/contexto';
import type { Repositorio } from '@/lib/repositorio/tipos';
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';

// Rutas secundarias diferidas: el formulario (y zod) solo se descargan al abrirlo.
const NuevoProyecto = lazy(() => import('@/pages/NuevoProyecto'));
const DetalleProyecto = lazy(() => import('@/pages/DetalleProyecto'));

/** Exige sesión; el rol no se comprueba aquí sino en RLS (y en la UI solo para ocultar acciones). */
export function RutaProtegida() {
  const { perfil, cargando, error } = useSesion();
  if (cargando) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <CargandoFilas />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorCarga mensaje={error} reintentar={() => window.location.reload()} />
      </div>
    );
  }
  return perfil ? <Outlet /> : <Navigate to="/login" replace />;
}

export function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="proyectos/nuevo" element={<NuevoProyecto />} />
          <Route path="proyectos/:id" element={<DetalleProyecto />} />
          <Route
            path="*"
            element={
              <Vacio titulo="Página no encontrada">
                <Link to="/" className="underline">Volver al panel</Link>
              </Vacio>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App({ repositorio }: { repositorio: Repositorio }) {
  return (
    <RepositorioProvider repositorio={repositorio}>
      <SesionProvider>
        <BrowserRouter>
          <Rutas />
        </BrowserRouter>
      </SesionProvider>
    </RepositorioProvider>
  );
}
