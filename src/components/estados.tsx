import type { ReactNode } from 'react';
import { FolderOpen, RefreshCw, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Skeleton } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** UI-05 · Estados comunes de carga, error y vacío, reutilizados en todas las páginas. */

export function CargandoFilas({ filas = 4 }: { filas?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="space-y-2">
      {Array.from({ length: filas }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

export function ErrorCarga({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>No se pudieron cargar los datos</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{mensaje}</span>
        {reintentar && (
          <Button variant="outline" size="sm" onClick={reintentar}>
            <RefreshCw /> Reintentar
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
      <FolderOpen className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">{titulo}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
