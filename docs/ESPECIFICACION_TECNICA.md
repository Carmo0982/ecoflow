# Documento de Especificación Técnica · EcoFlow (Prompt maestro)

> **Uso:** este documento se pega **completo** al inicio de cada conversación con el asistente de IA. Es el contrato de diseño: la IA no puede inventar tablas, columnas, reglas ni dependencias que no estén aquí. Si algo falta o es ambiguo, debe preguntar en vez de suponer. Cada regla tiene un **ID** para que los prompts y las pruebas la citen.

---

## 0. Rol e instrucciones para la IA

Actúas como **desarrollador senior de React + Supabase** bajo la dirección de un arquitecto. Reglas de trabajo:

1. **Primero propones, después programas.** Ante una tarea, responde con el plan (archivos, firmas, tablas afectadas) y espera aprobación si cambia el esquema o una regla.
2. **Cita los IDs** (`RN-03`, `SEG-02`…) que cumple cada fragmento de código.
3. **No inventes.** Usa solo los nombres de este documento. Si una regla parece contradecirse, señálalo.
4. **Seguridad en la base de datos, no en la interfaz.** Ocultar un botón no es una regla de seguridad; toda regla `SEG-*` se aplica con RLS, `GRANT` o triggers.
5. **Cada regla debe poder probarse.** Junto con el código, indica qué prueba la verifica.
6. TypeScript estricto: prohibido `any`, `@ts-ignore` y `as unknown as`.

## 1. Contexto del negocio

EcoFlow es una startup de tecnología limpia que instala sistemas solares fotovoltaicos. Necesita una **aplicación interna** para gestionar sus proyectos de instalación. Usuarios:

| Rol | Quién es | Qué hace en la app |
|---|---|---|
| `coordinador` | Planea la operación | Crea proyectos, asigna instaladores, define materiales, ve todo |
| `instalador` | Técnico de campo | Ve **solo** sus proyectos asignados y actualiza su avance |

## 2. Modelo de datos

Tablas exigidas por el cliente: **`proyectos`, `instaladores`, `materiales`**. Para modelar correctamente la relación muchos a muchos entre proyectos y materiales (un proyecto usa varios materiales; un material se usa en muchos proyectos) se añade la tabla de unión **`proyecto_materiales`** con la cantidad.

| Tabla | Propósito | Claves |
|---|---|---|
| `instaladores` | Perfil de cada usuario del equipo (técnicos y coordinadores) | PK `id` = FK → `auth.users.id` (1:1) |
| `proyectos` | Una instalación solar para un cliente | PK `id`; FK `instalador_id` → `instaladores` (N:1, opcional); FK `creado_por` → `instaladores` |
| `materiales` | Catálogo de inventario (paneles, inversores…) | PK `id`; `sku` único |
| `proyecto_materiales` | Materiales asignados a un proyecto | PK compuesta (`proyecto_id`, `material_id`); FKs a ambas tablas |

Enumeraciones: `estado_proyecto` = `pendiente | en_progreso | completado`; `rol_equipo` = `instalador | coordinador`; `tipo_material` = `panel | inversor | bateria | estructura | cableado | otro`.

## 3. Reglas de negocio (RN)

| ID | Regla |
|---|---|
| RN-01 | Todo proyecto nace en estado `pendiente`. |
| RN-02 | El estado solo avanza: `pendiente → en_progreso → completado`. No se retrocede ni se salta un paso. |
| RN-03 | Un proyecto no puede pasar a `en_progreso` sin instalador asignado. |
| RN-04 | Al completarse se registra `completado_en` automáticamente; un proyecto no completado no tiene esa fecha. |
| RN-05 | `fecha_fin_estimada ≥ fecha_inicio`. |
| RN-06 | La capacidad está en kWp, es mayor que 0 y como máximo 10 000. |
| RN-07 | Crear un proyecto con sus materiales es **atómico**: o se guarda todo o nada. |
| RN-08 | Asignar materiales descuenta stock. No se puede asignar más de lo disponible. |
| RN-09 | Solo se puede eliminar un proyecto `pendiente`. |
| RN-10 | Un instalador solo puede cambiar el **estado** de su proyecto, ningún otro campo. |

## 4. Seguridad (SEG)

| ID | Regla | Mecanismo esperado |
|---|---|---|
| SEG-01 | Un instalador **solo ve los proyectos asignados a él** (y sus materiales). | RLS `select` en `proyectos` y `proyecto_materiales` |
| SEG-02 | Solo un coordinador crea, reasigna o elimina proyectos y gestiona el catálogo. | RLS + función `es_coordinador()` |
| SEG-03 | El rol vive en `instaladores.rol`, y **nadie puede cambiar su propio rol** desde el cliente. | `GRANT UPDATE` por columna; nunca `user_metadata` |
| SEG-04 | El perfil se crea en el servidor al registrarse, siempre como `instalador`. | Trigger en `auth.users` |
| SEG-05 | Usuarios anónimos no acceden a nada. | `REVOKE` a `anon` |
| SEG-06 | Los agregados del dashboard respetan RLS (un instalador no ve totales globales). | Vista con `security_invoker = true` |
| SEG-07 | `creado_por` lo fija el servidor, no el cliente. | `WITH CHECK (creado_por = auth.uid())` |
| SEG-08 | Toda función `SECURITY DEFINER` fija `search_path = ''` y revoca `EXECUTE` a `anon`. | Revisión + prueba |

## 5. Interfaz (UI)

| ID | Requisito |
|---|---|
| UI-01 | Dashboard con 3 indicadores (Pendiente, En progreso, Completado) más la capacidad total en kWp, calculados por la base de datos. |
| UI-02 | Lista de proyectos filtrable por estado, con instalador, ciudad, capacidad y fechas. |
| UI-03 | El instalador asignado ve un botón para avanzar el estado (`Iniciar` / `Completar`), con actualización optimista y reversión si falla. |
| UI-04 | Formulario "Nuevo proyecto" (solo coordinador) con validación **antes** de enviar: campos obligatorios, rangos, fechas coherentes, materiales sin duplicados y cantidad ≤ stock. Errores por campo y accesibles. |
| UI-05 | Toda vista tiene estados de **carga**, **error** (con reintento) y **vacío**. |
| UI-06 | Componentes con Tailwind CSS 4 al estilo shadcn/ui (copiados al repo, variantes con `cva`). |
| UI-07 | Los cambios hechos por otros usuarios aparecen sin recargar (Supabase Realtime). |
| UI-08 | Sin variables de entorno, la app corre en **modo demo** con datos locales que imitan las mismas reglas. |

## 6. Arquitectura del frontend (ARQ)

| ID | Regla |
|---|---|
| ARQ-01 | Stack: React 19, TypeScript ~7.0 estricto, Vite 8, react-router 8, `@supabase/supabase-js` ^2.119, Tailwind 4, zod 4, Vitest 5, Node 24. |
| ARQ-02 | Los componentes **no importan supabase-js**. Usan hooks; los hooks usan un `Repositorio` inyectado por Context. |
| ARQ-03 | Hay dos implementaciones del `Repositorio`: Supabase y Demo. Las pruebas usan una falsa. |
| ARQ-04 | Los hooks devuelven `{ datos, cargando, error, recargar }` e ignoran respuestas de peticiones obsoletas. |
| ARQ-05 | Los tipos salen de `src/types/database.ts`, con el formato de `supabase gen types typescript`, y una prueba verifica que coinciden con la migración. |
| ARQ-06 | Una sola fuente de validación en el cliente: `src/lib/validacion.ts` (esquema zod por campo + reglas cruzadas que se evalúan siempre, para mostrar todos los errores en un solo envío). Sus límites son los mismos `CHECK` de la base de datos, y una prueba lo comprueba. |

## 7. Criterios de aceptación (definición de terminado)

- `npm run typecheck`, `npm test` y `npm run build` pasan.
- Cada regla `RN-*` y `SEG-*` tiene al menos una prueba sobre Postgres real (PGlite) en `supabase/tests/`.
- La prueba de tipos confirma que `database.ts` refleja la migración (columnas, nulabilidad, enums).
- Prueba manual en el navegador del flujo coordinador → instalador en modo demo.
