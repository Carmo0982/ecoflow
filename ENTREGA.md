# Proyecto Final Integrador: El Arquitecto IA

**Caso:** EcoFlow, gestión de proyectos de instalación solar
**Stack:** Supabase (Postgres + RLS + Auth + Realtime) · React 19 · TypeScript ~7.0 estricto · Vite 8 · Tailwind 4 + componentes shadcn/ui · zod 4

🔗 Repositorio: [pegar aquí el link del repositorio]
🎬 Video demo: [pegar aquí el link del video] (guion en `docs/GUION_VIDEO.md`)

---

## 1. Contexto

EcoFlow necesita una app interna con dos roles:
- la **coordinación** crea proyectos, asigna instaladores y materiales, y ve todo;
- cada **instalador** ve **solo sus proyectos** y registra su avance (Pendiente → En progreso → Completado).

El reto fue diseñarla como arquitecto: primero un **documento de especificación** que guía a la IA, después el esquema y la seguridad en Postgres, y por último la interfaz en React. Cada pieza se comprueba con una prueba ejecutable.

## 2. Cómo se hizo

1. **Prompt maestro.** `docs/ESPECIFICACION_TECNICA.md` fija el rol de la IA y sus reglas (proponer antes de programar, citar IDs, no inventar, sin `any`). Contiene:
   - el modelo de datos;
   - las reglas `RN-01…10` (negocio), `SEG-01…08` (seguridad), `UI-01…08` y `ARQ-01…06`;
   - los criterios de aceptación.
2. **Esquema y seguridad en una migración.**
   - 4 tablas (las 3 pedidas más `proyecto_materiales`, por ser N:M con cantidad), con FKs con nombre y `on delete` justificado.
   - RLS en las 4 tablas y `GRANT` por columna.
   - Triggers para las transiciones de estado, el stock y "el instalador solo cambia el estado".
   - Una RPC transaccional y una vista del dashboard con `security_invoker`.
3. **Pruebas sobre Postgres real.**
   - PGlite (Postgres 18 en WebAssembly) con una réplica de los roles y `auth.uid()` de Supabase.
   - Cada prueba se hace pasar por un usuario igual que PostgREST.
   - 44 pruebas: RLS, triggers, RPC, tipos y seed.
4. **Tipos TypeScript con IA y verificados.** La IA generó `database.ts` en formato `supabase gen types`. Una prueba lo compara con `information_schema`, y la mutación demostró que detecta errores.
5. **Frontend modular.**
   - Patrón Repositorio inyectado por Context: Supabase real, o demo en memoria con las mismas reglas.
   - Hooks con estados de carga, error y vacío, y protección contra respuestas obsoletas.
   - Avance de estado optimista con reversión.
   - Realtime.
   - Formulario validado antes de llamar a Supabase.
6. **Verificación.**
   - Typecheck, 84 pruebas y build.
   - Mutaciones para confirmar que las pruebas fallan cuando deben.
   - Prueba manual en el navegador con los dos roles.

## 3. Mapa del repositorio

```
ecoflow/
├── ENTREGA.md · README.md
├── docs/
│   ├── ESPECIFICACION_TECNICA.md      ← ⭐ prompt maestro
│   ├── ARQUITECTURA.md                ← ⭐ diagrama ER, RLS justificada, estructura, prompts, problema complejo
│   └── GUION_VIDEO.md                 ← guion de 3–5 min
├── supabase/
│   ├── migrations/…_esquema_ecoflow.sql  ← ⭐ tablas, FKs, RLS, triggers, RPC, vista
│   ├── seed.sql                       ← datos de demo (idempotente)
│   └── tests/                         ← rls · tipos · limites · seed (PGlite)
└── src/
    ├── types/database.ts              ← ⭐ tipos generados con IA + verificados
    ├── lib/ dominio · validacion · errores · repositorio/{supabase,demo,contexto}
    ├── hooks/ useConsulta · useSesion · useProyectos · datos
    ├── components/ui/                 ← button, card, badge, campos, alert (cva)
    └── pages/ Dashboard · NuevoProyecto · DetalleProyecto · Login
```

## 4. Resultados

**Seguridad (todo comprobado con pruebas):**
- un instalador solo ve sus proyectos y los materiales de esos proyectos;
- no puede crear, reasignar ni editar otros campos;
- no puede hacerse coordinador;
- un anónimo no accede a nada;
- el dashboard no filtra los totales globales.

**Problema complejo resuelto con IA:**
- *El problema:* la vista del dashboard se ejecutaba con los permisos de su dueño, así que cada instalador veía los totales de toda la empresa. Es una fuga de **agregados** que una prueba de "¿puedo leer esta fila?" no detecta.
- *La solución:* `security_invoker = true`, con una prueba de control que demuestra la fuga sin esa opción y una mutación que confirma que la prueba falla si se quita.
- Detalle en `ARQUITECTURA.md` §6, junto con 6 errores de propuestas de la IA que la verificación detectó.

**Verificación:**
- `npm run typecheck` ✔ · `npm test`: **84/84** ✔ (44 de base de datos y 40 de frontend) · `npm run build` ✔.
- Navegador (build de producción, modo demo):
  - la coordinadora ve 7 proyectos y avanza uno, y las tarjetas se actualizan;
  - Camila ve solo sus 2 proyectos, recibe "acceso restringido" en `/proyectos/nuevo` y "no encontrado" en un proyecto ajeno;
  - el formulario muestra todos los errores, bloquea una cantidad mayor que el stock y, con datos válidos, crea el proyecto y redirige al detalle;
  - 0 errores en la consola.
- **No probado contra un Supabase real** (no hay proyecto conectado): login, embedding vía PostgREST, RPC por HTTP, eventos de Realtime y la salida real de `gen types`. El SQL sí corrió en Postgres real (PGlite). Los pasos para conectarlo están en el README.

## 5. Cumplimiento de la rúbrica

### 5.1 Precisión en la arquitectura

| Criterio | Evidencia | Dónde |
|---|---|---|
| Tablas `proyectos`, `instaladores`, `materiales` | Más `proyecto_materiales` (N:M con cantidad), justificada | migración §2, `ARQUITECTURA` §2 |
| Claves foráneas correctas | 5 FKs con `cascade`, `set null` o `restrict` justificados; restricciones con nombre para desambiguar el embedding; FKs indexadas | `ARQUITECTURA` §2 |
| RLS: el instalador ve solo lo asignado | Política `instalador_id = (select auth.uid())`; materiales heredan la visibilidad del proyecto | migración §8, `rls.test.ts` SEG-01 |
| Políticas justificadas | Tabla por tabla y operación, con el *porqué* de cada una | `ARQUITECTURA` §3 |
| Integridad en la BD | CHECKs, triggers RN-02/04/08/10, RPC atómica, vista `security_invoker` | migración §5–7 |

### 5.2 Calidad del código React

| Criterio | Evidencia | Dónde |
|---|---|---|
| Modular | Repositorio inyectado, hooks, componentes de UI, páginas lazy | `src/` |
| Hooks | `useConsulta` genérico; `useProyectos` optimista + realtime; `useSesion` | `src/hooks/` |
| Estados de carga y error | Esqueletos, alerta con *Reintentar*, estado vacío y error del servidor traducido | `components/estados.tsx` |
| Dashboard con estados | Tarjetas Pendiente / En progreso / Completado con kWp, filtro y búsqueda | `pages/Dashboard.tsx` |
| Formulario validado antes de enviar | zod + reglas cruzadas; prueba de que no se llama a Supabase si es inválido | `NuevoProyecto.tsx` y `.test.tsx` |
| Librería de componentes | Tailwind 4 + componentes shadcn/ui (cva, tailwind-merge, lucide) | `components/ui/` |
| TypeScript completo | Estricto, sin `any`; tipos de dominio derivados de `database.ts`; `select` tipado | `lib/dominio.ts` |

### 5.3 Uso estratégico de la IA

| Criterio | Evidencia | Dónde |
|---|---|---|
| Especificación que guía a la IA | Prompt maestro con IDs y criterios de aceptación | `ESPECIFICACION_TECNICA.md` |
| Prompts clave | 6 prompts acotados que citan IDs y exigen pruebas | `ARQUITECTURA` §7 |
| Tipos generados con IA | `database.ts` + prueba contra el esquema real + mutación | `ARQUITECTURA` §5 |
| Problema complejo documentado | Fuga de agregados en la vista → `security_invoker`, con prueba de control | `ARQUITECTURA` §6 |
| Sin copiar y pegar a ciegas | 6 propuestas de la IA corregidas porque una prueba o `tsc` las detectó; mutaciones en BD, tipos y hooks | `ARQUITECTURA` §6 |
