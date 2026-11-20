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

/**
 * ARQ-02/ARQ-03 · Contrato de acceso a datos. Los hooks dependen de esta
 * interfaz, no de supabase-js, así que la misma interfaz de usuario funciona
 * con Supabase, en modo demo o con un repositorio falso en las pruebas.
 *
 * Todos los métodos lanzan ErrorDatos con un mensaje apto para el usuario.
 */
export interface Repositorio {
  readonly modo: 'supabase' | 'demo';

  obtenerPerfil(): Promise<Perfil | null>;
  iniciarSesion(email: string, password: string): Promise<void>;
  cerrarSesion(): Promise<void>;
  /** Avisa cuando cambia la sesión. Devuelve la función para desuscribirse. */
  alCambiarSesion(alCambiar: () => void): () => void;

  listarProyectos(): Promise<Proyecto[]>;
  obtenerProyecto(id: string): Promise<ProyectoDetalle | null>;
  resumen(): Promise<ResumenEstado[]>;
  listarInstaladores(): Promise<Instalador[]>;
  listarMateriales(): Promise<Material[]>;

  crearProyecto(datos: NuevoProyecto): Promise<string>;
  cambiarEstado(id: string, estado: EstadoProyecto): Promise<void>;

  /** UI-07 · Avisa cuando alguien cambia proyectos. Devuelve la función de limpieza. */
  suscribirCambios(alCambiar: () => void): () => void;

  /** Solo en modo demo: permite cambiar de usuario para probar los roles. */
  readonly demo?: {
    usuarios: readonly Perfil[];
    cambiarUsuario(id: string): void;
  };
}
