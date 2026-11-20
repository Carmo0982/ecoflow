import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ResumenEstado } from '../dominio';
import { ErrorDatos, traducirError } from '../errores';
import type { Repositorio } from './tipos';

type Cliente = SupabaseClient<Database>;

// Hay DOS claves foráneas de proyectos a instaladores (instalador_id y
// creado_por). Sin "!proyectos_instalador_id_fkey", PostgREST no sabe cuál
// usar y responde PGRST201 ("more than one relationship was found").
const SELECT_PROYECTO = '*, instalador:instaladores!proyectos_instalador_id_fkey(id, nombre)';
// Debe ser UN literal (no concatenado): supabase-js analiza este texto a nivel
// de tipos para inferir la forma exacta del resultado.
const SELECT_DETALLE = `*, instalador:instaladores!proyectos_instalador_id_fkey(id, nombre, telefono), materiales:proyecto_materiales(cantidad, material:materiales(id, sku, nombre, unidad, tipo))`;

/** Implementación real. Toda la autorización la hace RLS en Postgres. */
export function crearRepositorioSupabase(url: string, anonKey: string): Repositorio {
  const sb: Cliente = createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return {
    modo: 'supabase',

    async obtenerPerfil() {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await sb
        .from('instaladores')
        .select('id, nombre, email, rol')
        .eq('id', auth.user.id)
        .maybeSingle();
      if (error) throw traducirError(error);
      return data;
    },

    async iniciarSesion(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new ErrorDatos('Correo o contraseña incorrectos.');
    },

    async cerrarSesion() {
      await sb.auth.signOut();
    },

    alCambiarSesion(alCambiar) {
      const { data } = sb.auth.onAuthStateChange((evento) => {
        if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') alCambiar();
      });
      return () => data.subscription.unsubscribe();
    },

    async listarProyectos() {
      const { data, error } = await sb
        .from('proyectos')
        .select(SELECT_PROYECTO)
        .order('fecha_inicio', { ascending: true });
      if (error) throw traducirError(error);
      return data;
    },

    async obtenerProyecto(id) {
      const { data, error } = await sb.from('proyectos').select(SELECT_DETALLE).eq('id', id).maybeSingle();
      if (error) throw traducirError(error);
      return data;
    },

    async resumen() {
      const { data, error } = await sb.from('resumen_proyectos').select('estado, total, capacidad_kw');
      if (error) throw traducirError(error);
      // Las columnas de una vista se tipan como nullable; la vista nunca
      // devuelve null (unnest del enum + coalesce), así que se normaliza aquí.
      return data.flatMap((r): ResumenEstado[] =>
        r.estado ? [{ estado: r.estado, total: r.total ?? 0, capacidad_kw: Number(r.capacidad_kw ?? 0) }] : [],
      );
    },

    async listarInstaladores() {
      const { data, error } = await sb
        .from('instaladores')
        .select('id, nombre, email, rol, telefono')
        .eq('rol', 'instalador')
        .order('nombre');
      if (error) throw traducirError(error);
      return data;
    },

    async listarMateriales() {
      const { data, error } = await sb.from('materiales').select('*').order('tipo').order('nombre');
      if (error) throw traducirError(error);
      return data;
    },

    async crearProyecto(d) {
      // RN-07: una sola llamada RPC = una transacción (proyecto + materiales + stock).
      const { data, error } = await sb.rpc('crear_proyecto', {
        p_nombre: d.nombre,
        p_cliente: d.cliente,
        p_direccion: d.direccion,
        p_ciudad: d.ciudad,
        p_capacidad_kw: d.capacidad_kw,
        p_fecha_inicio: d.fecha_inicio,
        p_fecha_fin_estimada: d.fecha_fin_estimada,
        ...(d.instalador_id ? { p_instalador_id: d.instalador_id } : {}),
        p_materiales: d.materiales,
      });
      if (error) throw traducirError(error);
      return data;
    },

    async cambiarEstado(id, estado) {
      const { data, error } = await sb.from('proyectos').update({ estado }).eq('id', id).select('id');
      if (error) throw traducirError(error);
      // RLS no lanza error al filtrar: si no se actualizó ninguna fila, no había permiso.
      if (data.length === 0) throw new ErrorDatos('No tienes permiso para modificar este proyecto.', '42501');
    },

    suscribirCambios(alCambiar) {
      // Realtime aplica RLS: cada instalador solo recibe eventos de SUS proyectos.
      const canal = sb
        .channel(`proyectos-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, () => alCambiar())
        .subscribe();
      return () => {
        void sb.removeChannel(canal);
      };
    },
  };
}
