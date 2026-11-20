import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, TriangleAlert, X } from 'lucide-react';
import { CargandoFilas, ErrorCarga, Vacio } from '@/components/estados';
import { TablaProyectos } from '@/components/TablaProyectos';
import { TarjetasResumen } from '@/components/TarjetasResumen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, variantesBoton } from '@/components/ui/button';
import { Input } from '@/components/ui/campos';
import { useResumen } from '@/hooks/datos';
import { useProyectos } from '@/hooks/useProyectos';
import { usePerfil, useSesion } from '@/hooks/useSesion';
import { ETIQUETA_ESTADO, type EstadoProyecto } from '@/lib/dominio';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function Dashboard() {
  const perfil = usePerfil();
  const { esCoordinador } = useSesion();
  const resumen = useResumen();
  const { proyectos, cargando, error, recargar, avanzar, enCurso, errorAccion, limpiarErrorAccion } = useProyectos();
  const [filtro, setFiltro] = useState<EstadoProyecto | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return (proyectos ?? []).filter(
      (p) =>
        (!filtro || p.estado === filtro) &&
        (!q || normalizar(`${p.nombre} ${p.cliente} ${p.ciudad}`).includes(q)),
    );
  }, [proyectos, filtro, busqueda]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel de proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {esCoordinador ? 'Todos los proyectos de la empresa.' : `Proyectos asignados a ${perfil.nombre}.`}
          </p>
        </div>
        {esCoordinador && (
          <Link to="/proyectos/nuevo" className={variantesBoton()}>
            <Plus /> Nuevo proyecto
          </Link>
        )}
      </div>

      <TarjetasResumen
        resumen={resumen.datos}
        cargando={resumen.cargando}
        error={resumen.error}
        reintentar={() => resumen.recargar()}
        filtro={filtro}
        alFiltrar={setFiltro}
      />

      {errorAccion && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cambiar el estado</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {errorAccion}
            <Button variant="ghost" size="icon" aria-label="Cerrar aviso" onClick={limpiarErrorAccion}>
              <X />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="titulo-lista" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-lista" className="font-medium">
            {filtro ? `Proyectos: ${ETIQUETA_ESTADO[filtro]}` : 'Todos los proyectos'}
            {proyectos && <span className="ml-2 text-sm text-muted-foreground">({visibles.length})</span>}
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Buscar proyectos"
              placeholder="Buscar por nombre, cliente o ciudad"
              className="pl-8"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <ErrorCarga mensaje={error} reintentar={() => recargar()} />
        ) : cargando && !proyectos ? (
          <CargandoFilas />
        ) : visibles.length === 0 ? (
          <Vacio titulo={proyectos?.length ? 'Ningún proyecto coincide con el filtro' : 'Aún no hay proyectos'}>
            {!proyectos?.length && !esCoordinador && 'Cuando te asignen un proyecto aparecerá aquí.'}
          </Vacio>
        ) : (
          <TablaProyectos proyectos={visibles} perfil={perfil} enCurso={enCurso} alAvanzar={(p) => void avanzar(p).then(() => resumen.recargar({ silenciosa: true }))}
          />
        )}
      </section>
    </>
  );
}
