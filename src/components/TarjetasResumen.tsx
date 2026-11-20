import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/alert';
import { ESTADOS, ETIQUETA_ESTADO, type EstadoProyecto, type ResumenEstado } from '@/lib/dominio';
import { cn } from '@/lib/utils';
import { EstadoBadge } from './EstadoBadge';
import { ErrorCarga } from './estados';

const BORDE: Record<EstadoProyecto, string> = {
  pendiente: 'border-t-amber-400',
  en_progreso: 'border-t-sky-500',
  completado: 'border-t-emerald-500',
};

const kw = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

interface Props {
  resumen: ResumenEstado[] | undefined;
  cargando: boolean;
  error: string | null;
  reintentar: () => void;
  filtro: EstadoProyecto | null;
  alFiltrar: (estado: EstadoProyecto | null) => void;
}

/** UI-01 · Una tarjeta por estado; al pulsarla filtra la tabla. */
export function TarjetasResumen({ resumen, cargando, error, reintentar, filtro, alFiltrar }: Props) {
  if (error) return <ErrorCarga mensaje={error} reintentar={reintentar} />;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ESTADOS.map((estado) => {
        const fila = resumen?.find((r) => r.estado === estado);
        const activo = filtro === estado;
        return (
          <button
            key={estado}
            type="button"
            aria-pressed={activo}
            aria-label={`Filtrar por ${ETIQUETA_ESTADO[estado]}`}
            onClick={() => alFiltrar(activo ? null : estado)}
            className="rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <Card className={cn('border-t-4 transition-shadow hover:shadow-md', BORDE[estado], activo && 'ring-2 ring-primary')}>
              <CardHeader className="pb-2">
                <CardDescription>
                  <EstadoBadge estado={estado} />
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {cargando && !fila ? <Skeleton className="h-9 w-12" /> : (fila?.total ?? 0)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {cargando && !fila ? <Skeleton className="h-4 w-24" /> : `${kw.format(fila?.capacidad_kw ?? 0)} kWp`}
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
