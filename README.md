# EcoFlow · Gestión de proyectos solares

Aplicación interna para coordinar instalaciones fotovoltaicas. Usa Supabase (Postgres, RLS, Auth y Realtime), React 19, TypeScript, Vite 8, Tailwind 4 con componentes al estilo shadcn/ui y zod.

- Entrega del proyecto: [`ENTREGA.md`](ENTREGA.md).
- Arquitectura: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
- Prompt maestro: [`docs/ESPECIFICACION_TECNICA.md`](docs/ESPECIFICACION_TECNICA.md).

## Ejecutar (modo demo, sin backend)

Requiere Node 24.

```bash
npm install
npm run dev
```

Sin variables de entorno, la app arranca en **modo demo**: los datos están en memoria y siguen las mismas reglas que la base de datos. El selector **"Ver como"** permite cambiar entre la coordinadora (Laura) y los instaladores (Andrés, Camila, Mateo).

## Conectar a Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta en el **SQL Editor** el archivo `supabase/migrations/20261120120000_esquema_ecoflow.sql`. Con la CLI también sirve `supabase db push`.
3. En **Authentication → Users → Add user**, crea con contraseña:
   - `laura@ecoflow.test`
   - `andres@ecoflow.test`
   - `camila@ecoflow.test`
4. Ejecuta `supabase/seed.sql` en el SQL Editor. El seed:
   - convierte a Laura en coordinadora;
   - carga el catálogo de materiales;
   - crea 6 proyectos.
5. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. **Nunca** uses la `service_role` key: saltaría todas las políticas RLS.
6. Ejecuta `npm run dev` y entra con cualquiera de los tres usuarios.

Para regenerar los tipos desde el proyecto real:

```bash
npx supabase gen types typescript --project-id <id> > src/types/database.ts
```

Después ejecuta `npm test`: `supabase/tests/tipos.test.ts` comprueba que los tipos coinciden con la migración.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run typecheck` | `tsc -b` para la app, las pruebas y `vite.config.ts` |
| `npm test` | Vitest: 44 pruebas de base de datos (RLS, triggers, RPC, tipos, seed) sobre Postgres real con PGlite, y 40 de frontend (validación, hooks, Dashboard, formulario, modo demo) |
| `npm run build` | Typecheck y build de producción |
| `npm run preview` | Sirve `dist/` |

## Estructura

```
supabase/
  migrations/…_esquema_ecoflow.sql   esquema, RLS, triggers, RPC, vista, privilegios
  seed.sql                           datos de ejemplo
  tests/                             pruebas de la BD con PGlite (+ réplica mínima de Supabase)
src/
  types/database.ts                  tipos del esquema (formato supabase gen types)
  lib/                               dominio, validación, errores, repositorios (Supabase/Demo)
  hooks/                             useConsulta, useSesion, useProyectos, datos
  components/ui/                     componentes estilo shadcn (cva + tailwind-merge)
  components/, pages/                dashboard, formulario, detalle, login
docs/                                especificación, arquitectura, guion del video
```
