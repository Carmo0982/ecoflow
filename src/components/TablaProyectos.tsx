import { Link } from 'react-router';
import { ChevronRight, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCION_ESTADO, puedeAvanzar, type Perfil, type Proyecto } from '@/lib/dominio';
import { EstadoBadge } from './EstadoBadge';

export const fecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const formatearFecha = (iso: string) => fecha.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

interface Props {
  proyectos: Proyecto[];
  perfil: Perfil;
  enCurso: ReadonlySet<string>;
  alAvanzar: (p: Proyecto) => void;
}

/** UI-02 · Tabla de proyectos. El botón de avance solo aparece si la regla lo permite (la BD lo vuelve a comprobar). */
export function TablaProyectos({ proyectos, perfil, enCurso, alAvanzar }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Proyecto</th>
            <th scope="col" className="px-4 py-3 font-medium">Ciudad</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">kWp</th>
            <th scope="col" className="px-4 py-3 font-medium">Inicio</th>
            <th scope="col" className="px-4 py-3 font-medium">Instalador</th>
            <th scope="col" className="px-4 py-3 font-medium">Estado</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {proyectos.map((p) => {
            const accion = ACCION_ESTADO[p.estado];
            const ocupado = enCurso.has(p.id);
            return (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link to={`/proyectos/${p.id}`} className="font-medium hover:underline">
                    {p.nombre}
                  </Link>
                  <div className="text-xs text-muted-foreground">{p.cliente}</div>
                </td>
                <td className="px-4 py-3">{p.ciudad}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.capacidad_kw}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatearFecha(p.fecha_inicio)}</td>
                <td className="px-4 py-3">
                  {p.instalador?.nombre ?? <span className="text-muted-foreground italic">Sin asignar</span>}
                </td>
                <td className="px-4 py-3"><EstadoBadge estado={p.estado} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {accion && puedeAvanzar(perfil, p) && (
                      <Button size="sm" variant="solar" disabled={ocupado} onClick={() => alAvanzar(p)} aria-label={`${accion} ${p.nombre}`}>
                        {ocupado && <LoaderCircle className="animate-spin" />}
                        {accion}
                      </Button>
                    )}
                    <Link to={`/proyectos/${p.id}`} aria-label={`Ver ${p.nombre}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                      <ChevronRight className="size-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
