import type {
  EstadoProyecto,
  Instalador,
  Material,
  NuevoProyecto,
  Perfil,
  Proyecto,
  ProyectoDetalle,
  ResumenEstado,
} from '../dominio';
import { ESTADOS, siguienteEstado } from '../dominio';
import { ErrorDatos } from '../errores';
import type { Repositorio } from './tipos';

/**
 * UI-08 · Repositorio en memoria para el modo demo y las pruebas. Imita las
 * MISMAS reglas que la base de datos (visibilidad por instalador, RN-02,
 * RN-03, RN-07, RN-08, SEG-02) y responde con los mismos mensajes, así la
 * interfaz se comporta igual que con Supabase. No reemplaza a RLS: es solo
 * una simulación para demostrar y probar la interfaz sin backend.
 */

type FilaProyecto = Omit<Proyecto, 'instalador'>;
type FilaLinea = { proyecto_id: string; material_id: string; cantidad: number };

const EQUIPO: Instalador[] = [
  { id: '0b6f1c1e-3a5d-4c1a-9f10-000000000001', nombre: 'Laura Gómez', email: 'laura@ecoflow.test', rol: 'coordinador', telefono: '+57 300 111 0001' },
  { id: '0b6f1c1e-3a5d-4c1a-9f10-000000000002', nombre: 'Andrés Restrepo', email: 'andres@ecoflow.test', rol: 'instalador', telefono: '+57 300 111 0002' },
  { id: '0b6f1c1e-3a5d-4c1a-9f10-000000000003', nombre: 'Camila Ríos', email: 'camila@ecoflow.test', rol: 'instalador', telefono: '+57 300 111 0003' },
  { id: '0b6f1c1e-3a5d-4c1a-9f10-000000000004', nombre: 'Mateo Vélez', email: 'mateo@ecoflow.test', rol: 'instalador', telefono: null },
];
const [LAURA, ANDRES, CAMILA, MATEO] = EQUIPO.map((u) => u.id) as [string, string, string, string];

const material = (n: number, sku: string, nombre: string, tipo: Material['tipo'], stock: number, potencia_w: number | null, unidad = 'unidad'): Material => ({
  id: `5a1d0c3e-8b2f-4e6a-9c00-00000000000${n}`, sku, nombre, tipo, stock, potencia_w, unidad, creado_en: '2026-10-01T12:00:00Z',
});

const MATERIALES: Material[] = [
  material(1, 'PAN-550-MONO', 'Panel monocristalino 550 W', 'panel', 240, 550),
  material(2, 'PAN-450-BIF', 'Panel bifacial 450 W', 'panel', 80, 450),
  material(3, 'INV-5K-HIB', 'Inversor híbrido 5 kW', 'inversor', 12, 5000),
  material(4, 'INV-50K-TRI', 'Inversor trifásico 50 kW', 'inversor', 3, 50000),
  material(5, 'BAT-10K-LFP', 'Batería LFP 10 kWh', 'bateria', 6, null),
  material(6, 'EST-COPL-AL', 'Estructura coplanar de aluminio', 'estructura', 300, null, 'kit'),
  material(7, 'CAB-6MM-PV', 'Cable solar 6 mm²', 'cableado', 2000, null, 'metro'),
];
const M = MATERIALES.map((m) => m.id);

let secuencia = 0;
const proyecto = (
  nombre: string, cliente: string, direccion: string, ciudad: string, capacidad_kw: number,
  estado: EstadoProyecto, instalador_id: string | null, fecha_inicio: string, fecha_fin_estimada: string,
): FilaProyecto => {
  secuencia += 1;
  return {
    id: `7c2e9a10-4d3b-4f8e-a100-${String(secuencia).padStart(12, '0')}`,
    nombre, cliente, direccion, ciudad, capacidad_kw, estado, instalador_id, fecha_inicio, fecha_fin_estimada,
    completado_en: estado === 'completado' ? `${fecha_fin_estimada}T17:00:00Z` : null,
    creado_por: LAURA,
    creado_en: '2026-10-15T12:00:00Z',
    actualizado_en: '2026-10-15T12:00:00Z',
  };
};

function datosIniciales() {
  secuencia = 0;
  const proyectos: FilaProyecto[] = [
    proyecto('Techo residencial Ruiz', 'Familia Ruiz', 'Calle 10 # 43-21', 'Medellín', 5.5, 'pendiente', ANDRES, '2026-12-01', '2026-12-04'),
    proyecto('Bodega Solar Norte', 'Logística Norte SAS', 'Km 3 vía Bello', 'Bello', 48, 'en_progreso', CAMILA, '2026-11-10', '2026-11-30'),
    proyecto('Colegio San José', 'Colegio San José', 'Carrera 50 # 12-30', 'Envigado', 25, 'pendiente', null, '2027-01-12', '2027-01-26'),
    proyecto('Finca El Sol', 'Agroindustrial El Sol', 'Vereda La Palma', 'Rionegro', 12.5, 'en_progreso', ANDRES, '2026-11-15', '2026-11-28'),
    proyecto('Clínica Las Palmas', 'Clínica Las Palmas', 'Calle 33 # 80-12', 'Medellín', 60, 'completado', CAMILA, '2026-09-01', '2026-09-25'),
    proyecto('Panadería Doña Rosa', 'Rosa Álvarez', 'Carrera 45 # 70-05', 'Itagüí', 8, 'completado', ANDRES, '2026-10-05', '2026-10-09'),
    proyecto('Hotel Mirador', 'Hoteles Mirador SAS', 'Vía Las Palmas km 8', 'Medellín', 35, 'pendiente', MATEO, '2026-12-08', '2026-12-20'),
  ];
  const lineas: FilaLinea[] = [
    { proyecto_id: proyectos[0]!.id, material_id: M[0]!, cantidad: 10 },
    { proyecto_id: proyectos[0]!.id, material_id: M[2]!, cantidad: 1 },
    { proyecto_id: proyectos[1]!.id, material_id: M[1]!, cantidad: 106 },
    { proyecto_id: proyectos[1]!.id, material_id: M[3]!, cantidad: 1 },
    { proyecto_id: proyectos[3]!.id, material_id: M[0]!, cantidad: 23 },
    { proyecto_id: proyectos[3]!.id, material_id: M[4]!, cantidad: 2 },
  ];
  return { proyectos, lineas, materiales: MATERIALES.map((m) => ({ ...m })) };
}

export interface OpcionesDemo {
  /** Retardo artificial para mostrar los estados de carga (0 en pruebas). */
  latenciaMs?: number;
  usuarioInicial?: string;
}

export function crearRepositorioDemo({ latenciaMs = 350, usuarioInicial = LAURA }: OpcionesDemo = {}): Repositorio {
  const db = datosIniciales();
  let actual = usuarioInicial;
  const oyentesCambios = new Set<() => void>();
  const oyentesSesion = new Set<() => void>();

  const esperar = () => new Promise<void>((r) => setTimeout(r, latenciaMs));
  const perfil = (): Instalador => {
    const u = EQUIPO.find((x) => x.id === actual);
    if (!u) throw new ErrorDatos('Usuario demo inexistente.');
    return u;
  };
  const esCoordinador = () => perfil().rol === 'coordinador';
  const visible = (p: FilaProyecto) => esCoordinador() || p.instalador_id === actual; // SEG-01
  const conInstalador = (p: FilaProyecto): Proyecto => {
    const i = EQUIPO.find((x) => x.id === p.instalador_id);
    return { ...p, instalador: i ? { id: i.id, nombre: i.nombre } : null };
  };
  const avisar = () => setTimeout(() => oyentesCambios.forEach((f) => f()), 0);
  const copia = <T,>(x: T): T => structuredClone(x);

  return {
    modo: 'demo',

    demo: {
      usuarios: EQUIPO.map(({ id, nombre, email, rol }) => ({ id, nombre, email, rol })),
      cambiarUsuario(id) {
        actual = id;
        oyentesSesion.forEach((f) => f());
      },
    },

    async obtenerPerfil(): Promise<Perfil> {
      const { id, nombre, email, rol } = perfil();
      return { id, nombre, email, rol };
    },
    async iniciarSesion() {},
    async cerrarSesion() {},
    alCambiarSesion(f) {
      oyentesSesion.add(f);
      return () => oyentesSesion.delete(f);
    },

    async listarProyectos() {
      await esperar();
      return copia(
        db.proyectos
          .filter(visible)
          .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
          .map(conInstalador),
      );
    },

    async obtenerProyecto(id): Promise<ProyectoDetalle | null> {
      await esperar();
      const p = db.proyectos.find((x) => x.id === id && visible(x));
      if (!p) return null;
      const i = EQUIPO.find((x) => x.id === p.instalador_id);
      const materiales = db.lineas
        .filter((l) => l.proyecto_id === id)
        .map((l) => {
          const m = db.materiales.find((x) => x.id === l.material_id)!;
          return { cantidad: l.cantidad, material: { id: m.id, sku: m.sku, nombre: m.nombre, unidad: m.unidad, tipo: m.tipo } };
        });
      return copia({ ...p, instalador: i ? { id: i.id, nombre: i.nombre, telefono: i.telefono } : null, materiales });
    },

    async resumen(): Promise<ResumenEstado[]> {
      await esperar();
      const propios = db.proyectos.filter(visible); // SEG-06
      return ESTADOS.map((estado) => {
        const deEstado = propios.filter((p) => p.estado === estado);
        return { estado, total: deEstado.length, capacidad_kw: deEstado.reduce((s, p) => s + p.capacidad_kw, 0) };
      });
    },

    async listarInstaladores() {
      await esperar();
      return copia(EQUIPO.filter((u) => u.rol === 'instalador' && (esCoordinador() || u.id === actual)));
    },

    async listarMateriales() {
      await esperar();
      return copia(db.materiales);
    },

    async crearProyecto(d: NuevoProyecto) {
      await esperar();
      if (!esCoordinador()) throw new ErrorDatos('No tienes permiso para realizar esta acción.', '42501');
      // RN-07: validar todo ANTES de modificar algo (equivale a la transacción).
      for (const l of d.materiales) {
        const m = db.materiales.find((x) => x.id === l.material_id);
        if (!m || m.stock < l.cantidad) throw new ErrorDatos('Stock insuficiente para uno de los materiales.', 'P0001');
      }
      const nuevo: FilaProyecto = {
        id: crypto.randomUUID(),
        nombre: d.nombre, cliente: d.cliente, direccion: d.direccion, ciudad: d.ciudad,
        capacidad_kw: d.capacidad_kw, fecha_inicio: d.fecha_inicio, fecha_fin_estimada: d.fecha_fin_estimada,
        instalador_id: d.instalador_id, estado: 'pendiente', completado_en: null,
        creado_por: actual, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString(),
      };
      db.proyectos.push(nuevo);
      for (const l of d.materiales) {
        db.materiales.find((x) => x.id === l.material_id)!.stock -= l.cantidad; // RN-08
        db.lineas.push({ proyecto_id: nuevo.id, ...l });
      }
      avisar();
      return nuevo.id;
    },

    async cambiarEstado(id, estado) {
      await esperar();
      const p = db.proyectos.find((x) => x.id === id && visible(x));
      if (!p) throw new ErrorDatos('No tienes permiso para modificar este proyecto.', '42501');
      if (siguienteEstado(p.estado) !== estado) {
        throw new ErrorDatos(
          'Ese cambio de estado no está permitido: los proyectos avanzan Pendiente → En progreso → Completado.',
          '23514',
        );
      }
      if (estado === 'en_progreso' && !p.instalador_id) {
        throw new ErrorDatos('Los datos no cumplen las reglas del proyecto (fechas, capacidad o instalador).', '23514');
      }
      p.estado = estado;
      p.completado_en = estado === 'completado' ? new Date().toISOString() : null;
      p.actualizado_en = new Date().toISOString();
      avisar();
    },

    suscribirCambios(f) {
      oyentesCambios.add(f);
      return () => oyentesCambios.delete(f);
    },
  };
}

export const USUARIOS_DEMO = { LAURA, ANDRES, CAMILA, MATEO };
export const MATERIALES_DEMO = MATERIALES;
