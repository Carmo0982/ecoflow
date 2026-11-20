import { useId, useState, type ComponentProps, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, LoaderCircle, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { CargandoFilas, ErrorCarga } from '@/components/estados';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorCampo, Input, Label, Select } from '@/components/ui/campos';
import { useCrearProyecto, useInstaladores, useMateriales } from '@/hooks/datos';
import { useSesion } from '@/hooks/useSesion';
import { cantidadConUnidad, ETIQUETA_TIPO, type Material } from '@/lib/dominio';
import { LIMITES, validarProyecto, type ValoresFormulario } from '@/lib/validacion';

const VACIO: ValoresFormulario = {
  nombre: '',
  cliente: '',
  direccion: '',
  ciudad: '',
  capacidad_kw: '',
  fecha_inicio: '',
  fecha_fin_estimada: '',
  instalador_id: '',
  materiales: [],
};

type CampoTexto = Exclude<keyof ValoresFormulario, 'materiales'>;

/** UI-04 · Campo con etiqueta y error enlazados (aria-invalid + aria-describedby). */
function Campo({
  nombre, etiqueta, error, ...props
}: { nombre: string; etiqueta: string; error?: string } & ComponentProps<'input'>) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} name={nombre} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      <ErrorCampo id={`${id}-error`} mensaje={error} />
    </div>
  );
}

export default function NuevoProyecto() {
  const { esCoordinador } = useSesion();
  if (!esCoordinador) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Acceso restringido</AlertTitle>
        <AlertDescription>Solo la coordinación puede crear proyectos.</AlertDescription>
      </Alert>
    );
  }
  return <FormularioProyecto />;
}

function FormularioProyecto() {
  const navigate = useNavigate();
  const instaladores = useInstaladores();
  const materiales = useMateriales();
  const { crear, enviando, error: errorServidor } = useCrearProyecto();
  const [valores, setValores] = useState<ValoresFormulario>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const idInstalador = useId();

  if (instaladores.error || materiales.error) {
    return (
      <ErrorCarga
        mensaje={instaladores.error ?? materiales.error ?? ''}
        reintentar={() => {
          instaladores.recargar();
          materiales.recargar();
        }}
      />
    );
  }
  if (!instaladores.datos || !materiales.datos) return <CargandoFilas filas={6} />;

  const inventario: Material[] = materiales.datos;
  const set = (campo: CampoTexto) => (e: { target: { value: string } }) =>
    setValores((v) => ({ ...v, [campo]: e.target.value }));
  const setLinea = (i: number, cambio: Partial<ValoresFormulario['materiales'][number]>) =>
    setValores((v) => ({ ...v, materiales: v.materiales.map((l, j) => (j === i ? { ...l, ...cambio } : l)) }));

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Se valida ANTES de llamar a Supabase; si falla, no hay petición de red.
    const r = validarProyecto(valores, inventario);
    if (!r.ok) {
      setErrores(r.errores);
      // Lleva el foco al primer campo con error.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setErrores({});
    const id = await crear(r.datos);
    if (id) void navigate(`/proyectos/${id}`, { state: { creado: true } });
  }

  return (
    <form noValidate onSubmit={enviar} className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver al panel
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo proyecto de instalación</CardTitle>
          <CardDescription>Todos los proyectos se crean en estado Pendiente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo nombre="nombre" etiqueta="Nombre del proyecto" value={valores.nombre} onChange={set('nombre')} error={errores.nombre} maxLength={LIMITES.nombre.max} />
          <Campo nombre="cliente" etiqueta="Cliente" value={valores.cliente} onChange={set('cliente')} error={errores.cliente} maxLength={LIMITES.cliente.max} />
          <Campo nombre="direccion" etiqueta="Dirección" value={valores.direccion} onChange={set('direccion')} error={errores.direccion} maxLength={LIMITES.direccion.max} />
          <Campo nombre="ciudad" etiqueta="Ciudad" value={valores.ciudad} onChange={set('ciudad')} error={errores.ciudad} maxLength={LIMITES.ciudad.max} />
          <Campo nombre="capacidad_kw" etiqueta="Capacidad (kWp)" inputMode="decimal" placeholder="Ej. 12.5" value={valores.capacidad_kw} onChange={set('capacidad_kw')} error={errores.capacidad_kw} />
          <div className="space-y-1.5">
            <Label htmlFor={idInstalador}>Instalador asignado</Label>
            <Select id={idInstalador} value={valores.instalador_id} onChange={set('instalador_id')} aria-invalid={!!errores.instalador_id}>
              <option value="">Sin asignar (se asigna después)</option>
              {instaladores.datos.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </Select>
            <ErrorCampo id={`${idInstalador}-error`} mensaje={errores.instalador_id} />
          </div>
          <Campo nombre="fecha_inicio" etiqueta="Fecha de inicio" type="date" value={valores.fecha_inicio} onChange={set('fecha_inicio')} error={errores.fecha_inicio} />
          <Campo nombre="fecha_fin_estimada" etiqueta="Fecha fin estimada" type="date" min={valores.fecha_inicio || undefined} value={valores.fecha_fin_estimada} onChange={set('fecha_fin_estimada')} error={errores.fecha_fin_estimada} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Materiales</CardTitle>
          <CardDescription>Se descuentan del inventario al crear el proyecto (en la misma transacción).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {valores.materiales.length === 0 && <p className="text-sm text-muted-foreground">Sin materiales todavía.</p>}
          {valores.materiales.map((linea, i) => {
            const eMat = errores[`materiales.${i}.material_id`];
            const eCant = errores[`materiales.${i}.cantidad`];
            const stock = inventario.find((m) => m.id === linea.material_id)?.stock;
            return (
              <fieldset key={i} className="grid items-start gap-2 sm:grid-cols-[1fr_8rem_auto]">
                <legend className="sr-only">Material {i + 1}</legend>
                <div className="space-y-1">
                  <Select aria-label={`Material ${i + 1}`} value={linea.material_id} aria-invalid={!!eMat} onChange={(e) => setLinea(i, { material_id: e.target.value })}>
                    <option value="">Elige un material…</option>
                    {inventario.map((m) => (
                      <option key={m.id} value={m.id} disabled={m.stock === 0}>
                        {ETIQUETA_TIPO[m.tipo]} · {m.nombre} ({cantidadConUnidad(m.stock, m.unidad)} en stock)
                      </option>
                    ))}
                  </Select>
                  <ErrorCampo id={`mat-${i}-error`} mensaje={eMat} />
                </div>
                <div className="space-y-1">
                  <Input aria-label={`Cantidad del material ${i + 1}`} inputMode="numeric" placeholder={stock !== undefined ? `máx. ${stock}` : 'Cantidad'} value={linea.cantidad} aria-invalid={!!eCant} onChange={(e) => setLinea(i, { cantidad: e.target.value })} />
                  <ErrorCampo id={`cant-${i}-error`} mensaje={eCant} />
                </div>
                <Button variant="ghost" size="icon" aria-label={`Quitar material ${i + 1}`} onClick={() => setValores((v) => ({ ...v, materiales: v.materiales.filter((_, j) => j !== i) }))}>
                  <Trash2 />
                </Button>
              </fieldset>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            disabled={valores.materiales.length >= LIMITES.materialesMax}
            onClick={() => setValores((v) => ({ ...v, materiales: [...v.materiales, { material_id: '', cantidad: '' }] }))}
          >
            <Plus /> Agregar material
          </Button>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 border-t pt-6">
          {errorServidor && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>La base de datos rechazó el proyecto</AlertTitle>
              <AlertDescription>{errorServidor}</AlertDescription>
            </Alert>
          )}
          {Object.keys(errores).length > 0 && (
            <p role="status" className="text-sm text-destructive">
              {Object.keys(errores).length === 1 ? 'Revisa el campo marcado.' : `Revisa los ${Object.keys(errores).length} campos marcados.`}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Link to="/" className="inline-flex h-9 items-center rounded-md px-4 text-sm hover:bg-muted">Cancelar</Link>
            <Button type="submit" disabled={enviando}>
              {enviando && <LoaderCircle className="animate-spin" />}
              {enviando ? 'Creando…' : 'Crear proyecto'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
