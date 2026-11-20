import { CircleCheck, Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ETIQUETA_ESTADO, type EstadoProyecto } from '@/lib/dominio';

const ICONO = { pendiente: Clock, en_progreso: Zap, completado: CircleCheck } satisfies Record<EstadoProyecto, unknown>;

/** El estado se comunica con texto + icono + color (no solo color, por accesibilidad). */
export function EstadoBadge({ estado }: { estado: EstadoProyecto }) {
  const Icono = ICONO[estado];
  return (
    <Badge variant={estado}>
      <Icono aria-hidden />
      {ETIQUETA_ESTADO[estado]}
    </Badge>
  );
}
