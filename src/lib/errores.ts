/** Error con un mensaje apto para mostrar al usuario. */
export class ErrorDatos extends Error {
  constructor(
    mensaje: string,
    readonly codigo?: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDatos';
  }
}

/**
 * Traduce los SQLSTATE que producen las reglas de la base de datos a
 * mensajes en español. Así la interfaz explica POR QUÉ la base de datos
 * rechazó algo, sin exponer detalles internos.
 */
export function traducirError(error: { code?: string; message: string }): ErrorDatos {
  switch (error.code) {
    case '42501':
      return new ErrorDatos('No tienes permiso para realizar esta acción.', error.code);
    case '23514':
      return new ErrorDatos(
        error.message.includes('Transición')
          ? 'Ese cambio de estado no está permitido: los proyectos avanzan Pendiente → En progreso → Completado.'
          : 'Los datos no cumplen las reglas del proyecto (fechas, capacidad o instalador).',
        error.code,
      );
    case '23505':
      return new ErrorDatos('Hay un material repetido en el proyecto.', error.code);
    case 'P0001':
      return new ErrorDatos('Stock insuficiente para uno de los materiales.', error.code);
    case 'PGRST116':
      return new ErrorDatos('No se encontró el registro o no tienes acceso a él.', error.code);
    default:
      return new ErrorDatos('Ocurrió un error inesperado. Inténtalo de nuevo.', error.code);
  }
}

export const mensajeDe = (e: unknown): string =>
  e instanceof ErrorDatos ? e.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';
