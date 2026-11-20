import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const base =
  'h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(base, className)} {...props} />;
}

/** Select nativo con estilo shadcn: accesible por teclado y sin dependencias. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(base, 'pr-8', className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-sm font-medium leading-none select-none', className)} {...props} />;
}

/** Mensaje de error de un campo, enlazado con aria-describedby. */
export function ErrorCampo({ id, mensaje }: { id: string; mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {mensaje}
    </p>
  );
}
