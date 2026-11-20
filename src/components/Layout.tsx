import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Info, LogOut, Plus, Sun } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/campos';
import { usePerfil, useSesion } from '@/hooks/useSesion';
import { useRepositorio } from '@/lib/repositorio/contexto';
import { cn } from '@/lib/utils';
import { CargandoFilas } from './estados';

const enlace = ({ isActive }: { isActive: boolean }) =>
  cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted', isActive && 'bg-muted');

export function Layout() {
  const repo = useRepositorio();
  const perfil = usePerfil();
  const { esCoordinador, cerrarSesion } = useSesion();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sun className="size-5" aria-hidden />
            </span>
            EcoFlow
          </NavLink>
          <nav className="flex gap-1" aria-label="Principal">
            <NavLink to="/" end className={enlace}>Panel</NavLink>
            {esCoordinador && (
              <NavLink to="/proyectos/nuevo" className={enlace}>
                <Plus className="mr-1 inline size-4" aria-hidden />
                Nuevo proyecto
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {repo.demo ? (
              <div className="flex items-center gap-2">
                <Label htmlFor="ver-como" className="text-muted-foreground">Ver como</Label>
                <Select id="ver-como" className="h-8 w-auto" value={perfil.id} onChange={(e) => repo.demo?.cambiarUsuario(e.target.value)}>
                  {repo.demo.usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} · {u.rol}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <>
                <span className="text-sm">
                  {perfil.nombre} <span className="text-muted-foreground">· {perfil.rol}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => void cerrarSesion()}>
                  <LogOut /> Salir
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {repo.modo === 'demo' && (
          <Alert variant="info">
            <Info />
            <AlertDescription>
              Modo demo: datos en memoria que imitan las reglas de la base de datos. Configura
              <code className="mx-1 rounded bg-sky-100 px-1">VITE_SUPABASE_URL</code> y
              <code className="mx-1 rounded bg-sky-100 px-1">VITE_SUPABASE_ANON_KEY</code> para usar Supabase.
            </AlertDescription>
          </Alert>
        )}
        {/* Suspense DENTRO del layout: la cabecera no desaparece al cargar una ruta diferida. */}
        <Suspense fallback={<CargandoFilas />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
