import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, CircleCheck, LoaderCircle, MapPin, Package, Phone, TriangleAlert, UserRound } from 'lucide-react';
import { CargandoFilas, ErrorCarga, Vacio } from '@/components/estados';
import { EstadoBadge } from '@/components/EstadoBadge';
import { formatearFecha } from '@/components/TablaProyectos';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProyecto } from '@/hooks/datos';
import { usePerfil } from '@/hooks/useSesion';
import { ACCION_ESTADO, cantidadConUnidad, ETIQUETA_TIPO, puedeAvanzar, siguienteEstado } from '@/lib/dominio';
import { mensajeDe } from '@/lib/errores';
import { useRepositorio } from '@/lib/repositorio/contexto';

export default function DetalleProyecto() {
  const { id = '' } = useParams();
  const creado = (useLocation().state as { creado?: boolean } | null)?.creado;
  const repo = useRepositorio();
  const perfil = usePerfil();
  const { datos: p, cargando, error, recargar } = useProyecto(id);
  const [avanzando, setAvanzando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  if (error) return <ErrorCarga mensaje={error} reintentar={() => recargar()} />;
  if (cargando && p === undefined) return <CargandoFilas filas={5} />;
  // null = no existe o RLS lo oculta: para el usuario es lo mismo (no se filtra su existencia).
  if (!p) {
    return (
      <Vacio titulo="Proyecto no encontrado">
        No existe o no está asignado a ti. <Link to="/" className="underline">Volver al panel</Link>
      </Vacio>
    );
  }

  const destino = siguienteEstado(p.estado);
  const accion = ACCION_ESTADO[p.estado];

  async function avanzar() {
    if (!destino) return;
    setAvanzando(true);
    setErrorAccion(null);
    try {
      await repo.cambiarEstado(id, destino);
      recargar({ silenciosa: true });
    } catch (e) {
      setErrorAccion(mensajeDe(e));
    } finally {
      setAvanzando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver al panel
      </Link>

      {creado && (
        <Alert>
          <CircleCheck className="text-primary" />
          <AlertTitle>Proyecto creado</AlertTitle>
          <AlertDescription>Los materiales ya se descontaron del inventario.</AlertDescription>
        </Alert>
      )}
      {errorAccion && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cambiar el estado</AlertTitle>
          <AlertDescription>{errorAccion}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{p.nombre}</h1>
          <p className="text-muted-foreground">{p.cliente}</p>
        </div>
        <div className="flex items-center gap-2">
          <EstadoBadge estado={p.estado} />
          {accion && puedeAvanzar(perfil, p) && (
            <Button variant="solar" disabled={avanzando} onClick={() => void avanzar()}>
              {avanzando && <LoaderCircle className="animate-spin" />}
              {accion}
            </Button>
          )}
        </div>
      </div>
      {p.estado === 'pendiente' && !p.instalador && (
        <p className="text-sm text-muted-foreground">Asigna un instalador para poder iniciar este proyecto (RN-03).</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Instalación</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex gap-2"><MapPin className="size-4 text-muted-foreground" aria-hidden />{p.direccion}, {p.ciudad}</p>
            <p className="flex gap-2"><CalendarDays className="size-4 text-muted-foreground" aria-hidden />{formatearFecha(p.fecha_inicio)} → {formatearFecha(p.fecha_fin_estimada)}</p>
            <p><span className="text-muted-foreground">Capacidad:</span> <strong>{p.capacidad_kw} kWp</strong></p>
            {p.completado_en && <p><span className="text-muted-foreground">Completado el:</span> {formatearFecha(p.completado_en)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Instalador</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {p.instalador ? (
              <>
                <p className="flex gap-2"><UserRound className="size-4 text-muted-foreground" aria-hidden />{p.instalador.nombre}</p>
                {p.instalador.telefono && <p className="flex gap-2"><Phone className="size-4 text-muted-foreground" aria-hidden />{p.instalador.telefono}</p>}
              </>
            ) : (
              <p className="text-muted-foreground italic">Sin asignar</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Package className="size-4" aria-hidden /> Materiales</CardTitle>
          <CardDescription>
            {p.materiales.length === 1 ? '1 referencia reservada' : `${p.materiales.length} referencias reservadas`} para este proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {p.materiales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este proyecto no tiene materiales asignados.</p>
          ) : (
            <ul className="divide-y text-sm">
              {p.materiales.map(({ cantidad, material: m }) => (
                <li key={m.id} className="flex justify-between gap-4 py-2">
                  <span>
                    {m.nombre} <span className="text-xs text-muted-foreground">· {ETIQUETA_TIPO[m.tipo]} · {m.sku}</span>
                  </span>
                  <span className="tabular-nums">{cantidadConUnidad(cantidad, m.unidad)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
