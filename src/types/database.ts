/**
 * Tipos de la base de datos de EcoFlow.
 *
 * Formato idéntico al de `supabase gen types typescript`. Los generó el
 * asistente de IA a partir de supabase/migrations/20261120120000_esquema_ecoflow.sql
 * (ver docs/ARQUITECTURA.md §5) y NO se confía en ellos a ciegas:
 * supabase/tests/tipos.test.ts los compara contra el esquema real (columnas,
 * nulabilidad, opcionalidad en Insert, enums y argumentos de funciones).
 *
 * Con un proyecto enlazado se regeneran con:
 *   npx supabase gen types typescript --linked > src/types/database.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      instaladores: {
        Row: {
          creado_en: string;
          email: string;
          id: string;
          nombre: string;
          rol: Database['public']['Enums']['rol_equipo'];
          telefono: string | null;
        };
        Insert: {
          creado_en?: string;
          email: string;
          id: string;
          nombre: string;
          rol?: Database['public']['Enums']['rol_equipo'];
          telefono?: string | null;
        };
        Update: {
          creado_en?: string;
          email?: string;
          id?: string;
          nombre?: string;
          rol?: Database['public']['Enums']['rol_equipo'];
          telefono?: string | null;
        };
        Relationships: [];
      };
      materiales: {
        Row: {
          creado_en: string;
          id: string;
          nombre: string;
          potencia_w: number | null;
          sku: string;
          stock: number;
          tipo: Database['public']['Enums']['tipo_material'];
          unidad: string;
        };
        Insert: {
          creado_en?: string;
          id?: string;
          nombre: string;
          potencia_w?: number | null;
          sku: string;
          stock?: number;
          tipo: Database['public']['Enums']['tipo_material'];
          unidad?: string;
        };
        Update: {
          creado_en?: string;
          id?: string;
          nombre?: string;
          potencia_w?: number | null;
          sku?: string;
          stock?: number;
          tipo?: Database['public']['Enums']['tipo_material'];
          unidad?: string;
        };
        Relationships: [];
      };
      proyecto_materiales: {
        Row: {
          cantidad: number;
          material_id: string;
          proyecto_id: string;
        };
        Insert: {
          cantidad: number;
          material_id: string;
          proyecto_id: string;
        };
        Update: {
          cantidad?: number;
          material_id?: string;
          proyecto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proyecto_materiales_material_id_fkey';
            columns: ['material_id'];
            isOneToOne: false;
            referencedRelation: 'materiales';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proyecto_materiales_proyecto_id_fkey';
            columns: ['proyecto_id'];
            isOneToOne: false;
            referencedRelation: 'proyectos';
            referencedColumns: ['id'];
          },
        ];
      };
      proyectos: {
        Row: {
          actualizado_en: string;
          capacidad_kw: number;
          ciudad: string;
          cliente: string;
          completado_en: string | null;
          creado_en: string;
          creado_por: string;
          direccion: string;
          estado: Database['public']['Enums']['estado_proyecto'];
          fecha_fin_estimada: string;
          fecha_inicio: string;
          id: string;
          instalador_id: string | null;
          nombre: string;
        };
        Insert: {
          actualizado_en?: string;
          capacidad_kw: number;
          ciudad: string;
          cliente: string;
          completado_en?: string | null;
          creado_en?: string;
          creado_por?: string;
          direccion: string;
          estado?: Database['public']['Enums']['estado_proyecto'];
          fecha_fin_estimada: string;
          fecha_inicio: string;
          id?: string;
          instalador_id?: string | null;
          nombre: string;
        };
        Update: {
          actualizado_en?: string;
          capacidad_kw?: number;
          ciudad?: string;
          cliente?: string;
          completado_en?: string | null;
          creado_en?: string;
          creado_por?: string;
          direccion?: string;
          estado?: Database['public']['Enums']['estado_proyecto'];
          fecha_fin_estimada?: string;
          fecha_inicio?: string;
          id?: string;
          instalador_id?: string | null;
          nombre?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proyectos_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'instaladores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proyectos_instalador_id_fkey';
            columns: ['instalador_id'];
            isOneToOne: false;
            referencedRelation: 'instaladores';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      resumen_proyectos: {
        Row: {
          capacidad_kw: number | null;
          estado: Database['public']['Enums']['estado_proyecto'] | null;
          total: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      crear_proyecto: {
        Args: {
          p_capacidad_kw: number;
          p_cliente: string;
          p_ciudad: string;
          p_direccion: string;
          p_fecha_fin_estimada: string;
          p_fecha_inicio: string;
          p_instalador_id?: string;
          p_materiales?: Json;
          p_nombre: string;
        };
        Returns: string;
      };
      es_coordinador: { Args: never; Returns: boolean };
    };
    Enums: {
      estado_proyecto: 'pendiente' | 'en_progreso' | 'completado';
      rol_equipo: 'instalador' | 'coordinador';
      tipo_material: 'panel' | 'inversor' | 'bateria' | 'estructura' | 'cableado' | 'otro';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export const Constants = {
  public: {
    Enums: {
      estado_proyecto: ['pendiente', 'en_progreso', 'completado'],
      rol_equipo: ['instalador', 'coordinador'],
      tipo_material: ['panel', 'inversor', 'bateria', 'estructura', 'cableado', 'otro'],
    },
  },
} as const;
