/**
 * Tipos del dominio, DERIVADOS de src/types/database.ts (nunca escritos a
 * mano por separado): si cambia el esquema, cambian aquí y el compilador
 * señala cada uso afectado.
 */
import { Constants, type Enums, type Tables } from '@/types/database';

export type EstadoProyecto = Enums<'estado_proyecto'>;
export type RolEquipo = Enums<'rol_equipo'>;
export type TipoMaterial = Enums<'tipo_material'>;

export type Perfil = Pick<Tables<'instaladores'>, 'id' | 'nombre' | 'email' | 'rol'>;
export type Instalador = Pick<Tables<'instaladores'>, 'id' | 'nombre' | 'email' | 'rol' | 'telefono'>;
export type Material = Tables<'materiales'>;

/** Fila de proyectos + el instalador "embebido" por la FK proyectos_instalador_id_fkey. */
export type Proyecto = Tables<'proyectos'> & {
  instalador: Pick<Tables<'instaladores'>, 'id' | 'nombre'> | null;
};

export type LineaMaterial = {
  cantidad: number;
  material: Pick<Material, 'id' | 'sku' | 'nombre' | 'unidad' | 'tipo'>;
};

export type ProyectoDetalle = Proyecto & {
  instalador: Pick<Tables<'instaladores'>, 'id' | 'nombre' | 'telefono'> | null;
  materiales: LineaMaterial[];
};

export type ResumenEstado = { estado: EstadoProyecto; total: number; capacidad_kw: number };

/** Datos ya validados para crear un proyecto (salida del esquema zod). */
export type NuevoProyecto = {
  nombre: string;
  cliente: string;
  direccion: string;
  ciudad: string;
  capacidad_kw: number;
  fecha_inicio: string;
  fecha_fin_estimada: string;
  instalador_id: string | null;
  materiales: { material_id: string; cantidad: number }[];
};

export const ESTADOS: readonly EstadoProyecto[] = Constants.public.Enums.estado_proyecto;

export const ETIQUETA_ESTADO: Record<EstadoProyecto, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completado: 'Completado',
};

/** RN-02: el estado solo avanza un paso. */
export function siguienteEstado(estado: EstadoProyecto): EstadoProyecto | null {
  if (estado === 'pendiente') return 'en_progreso';
  if (estado === 'en_progreso') return 'completado';
  return null;
}

export const ACCION_ESTADO: Record<EstadoProyecto, string | null> = {
  pendiente: 'Iniciar',
  en_progreso: 'Completar',
  completado: null,
};

export const ETIQUETA_TIPO: Record<TipoMaterial, string> = {
  panel: 'Panel',
  inversor: 'Inversor',
  bateria: 'Batería',
  estructura: 'Estructura',
  cableado: 'Cableado',
  otro: 'Otro',
};

/** "1 unidad", "2 unidades", "3 metros", "4 kits". */
export function cantidadConUnidad(cantidad: number, unidad: string): string {
  if (cantidad === 1) return `1 ${unidad}`;
  return `${cantidad} ${/[dlnr]$/.test(unidad) ? `${unidad}es` : `${unidad}s`}`;
}

/** RN-03 + SEG-01: ¿puede este perfil avanzar este proyecto? (solo UX; la regla real está en la BD). */
export function puedeAvanzar(perfil: Perfil, proyecto: Pick<Proyecto, 'estado' | 'instalador_id'>): boolean {
  if (siguienteEstado(proyecto.estado) === null || proyecto.instalador_id === null) return false;
  return perfil.rol === 'coordinador' || proyecto.instalador_id === perfil.id;
}
