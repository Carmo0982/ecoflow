import { z } from 'zod';
import type { Material, NuevoProyecto } from './dominio';

/**
 * ARQ-06 · Límites idénticos a los CHECK de la migración. Validar en el
 * cliente da mensajes inmediatos; la base de datos vuelve a validarlo todo.
 */
export const LIMITES = {
  nombre: { min: 3, max: 120 },
  cliente: { min: 2, max: 120 },
  direccion: { min: 5, max: 200 },
  ciudad: { min: 2, max: 80 },
  capacidadMaxKw: 10_000,
  cantidadMax: 10_000,
  materialesMax: 30,
} as const;

const texto = (campo: string, { min, max }: { min: number; max: number }) =>
  z
    .string()
    .trim()
    .min(min, { error: `${campo}: mínimo ${min} caracteres.` })
    .max(max, { error: `${campo}: máximo ${max} caracteres.` });

/** Valores tal como los tiene el formulario (todo texto). */
export type ValoresFormulario = {
  nombre: string;
  cliente: string;
  direccion: string;
  ciudad: string;
  capacidad_kw: string;
  fecha_inicio: string;
  fecha_fin_estimada: string;
  instalador_id: string;
  materiales: { material_id: string; cantidad: string }[];
};

/** Esquema campo a campo (tipos, formatos y rangos de los CHECK). */
export function crearEsquemaProyecto() {
  return z
    .object({
      nombre: texto('Nombre', LIMITES.nombre),
      cliente: texto('Cliente', LIMITES.cliente),
      direccion: texto('Dirección', LIMITES.direccion),
      ciudad: texto('Ciudad', LIMITES.ciudad),
      capacidad_kw: z
        .string()
        .trim()
        .min(1, { error: 'Escribe la capacidad en kWp.' })
        .pipe(
          z.coerce
            .number<string>({ error: 'Escribe un número válido.' })
            .gt(0, { error: 'La capacidad debe ser mayor que 0 kWp.' })
            .max(LIMITES.capacidadMaxKw, { error: `Máximo ${LIMITES.capacidadMaxKw} kWp.` })
            .multipleOf(0.01, { error: 'Usa como máximo dos decimales.' }),
        ),
      fecha_inicio: z.iso.date({ error: 'Elige una fecha de inicio válida.' }),
      fecha_fin_estimada: z.iso.date({ error: 'Elige una fecha de fin válida.' }),
      instalador_id: z
        .union([z.literal(''), z.guid({ error: 'Instalador inválido.' })])
        .transform((v) => (v === '' ? null : v)),
      materiales: z
        .array(
          z.object({
            material_id: z.string().min(1, { error: 'Elige un material.' }),
            cantidad: z
              .string()
              .trim()
              .min(1, { error: 'Indica la cantidad.' })
              .pipe(
                z.coerce
                  .number<string>({ error: 'Cantidad inválida.' })
                  .int({ error: 'La cantidad debe ser un número entero.' })
                  .min(1, { error: 'Mínimo 1.' })
                  .max(LIMITES.cantidadMax, { error: `Máximo ${LIMITES.cantidadMax}.` }),
              ),
          }),
        )
        .max(LIMITES.materialesMax, { error: `Máximo ${LIMITES.materialesMax} materiales.` }),
    });
}

type Inventario = readonly Pick<Material, 'id' | 'nombre' | 'stock'>[];

/**
 * Reglas que cruzan campos (RN-05, PK compuesta, RN-08). Van FUERA de zod a
 * propósito: un superRefine no se ejecuta si otro campo ya falló, y el
 * usuario vería los errores "por tandas" (corrige unos y aparecen otros).
 * Aquí se evalúan siempre, sobre los valores crudos.
 */
function erroresCruzados(v: ValoresFormulario, inventario: Inventario): Record<string, string> {
  const errores: Record<string, string> = {};
  if (v.fecha_inicio && v.fecha_fin_estimada && v.fecha_fin_estimada < v.fecha_inicio) {
    errores.fecha_fin_estimada = 'La fecha de fin no puede ser anterior a la de inicio.';
  }
  const porId = new Map(inventario.map((m) => [m.id, m]));
  const vistos = new Set<string>();
  v.materiales.forEach((linea, i) => {
    if (!linea.material_id) return;
    if (vistos.has(linea.material_id)) errores[`materiales.${i}.material_id`] = 'Material repetido.';
    vistos.add(linea.material_id);
    const material = porId.get(linea.material_id);
    const cantidad = Number(linea.cantidad.trim());
    if (!material) {
      errores[`materiales.${i}.material_id`] = 'Material inexistente.';
    } else if (linea.cantidad.trim() && Number.isFinite(cantidad) && cantidad > material.stock) {
      errores[`materiales.${i}.cantidad`] = `Solo hay ${material.stock} en stock.`;
    }
  });
  return errores;
}

export type ResultadoValidacion =
  | { ok: true; datos: NuevoProyecto }
  | { ok: false; errores: Record<string, string> };

/** Valida y devuelve errores por ruta ("nombre", "materiales.0.cantidad"…). */
export function validarProyecto(
  valores: ValoresFormulario,
  inventario: Inventario,
): ResultadoValidacion {
  const resultado = crearEsquemaProyecto().safeParse(valores);
  const errores: Record<string, string> = {};
  if (!resultado.success) {
    for (const issue of resultado.error.issues) {
      errores[issue.path.join('.')] ??= issue.message; // el primer error de cada campo
    }
  }
  // Los errores de formato tienen prioridad sobre los cruzados en el mismo campo.
  for (const [ruta, mensaje] of Object.entries(erroresCruzados(valores, inventario))) errores[ruta] ??= mensaje;
  if (resultado.success && Object.keys(errores).length === 0) return { ok: true, datos: resultado.data };
  return { ok: false, errores };
}
