# Guion del video demo (3–5 minutos)

**Antes de grabar:**
- Ten abiertas tres pestañas:
  1. la app con Supabase, o en modo demo con `npm run dev`;
  2. el panel de Supabase en *Table Editor* y *SQL Editor*;
  3. el repositorio en el editor de código.
- Si usas Supabase, crea primero los 3 usuarios y ejecuta `supabase/seed.sql` (ver README).
- En modo demo, el selector **"Ver como"** reemplaza el cierre y el inicio de sesión.

| Tiempo | En pantalla | Qué decir (guía, no textual) |
|---|---|---|
| **0:00–0:20** | Portada: dashboard de EcoFlow | "EcoFlow gestiona proyectos de instalación solar. La construí guiando a la IA con un documento de especificación: el prompt maestro." |
| **0:20–0:55** | `docs/ESPECIFICACION_TECNICA.md`: sección 0 y las tablas RN/SEG | "Cada regla tiene un ID. La IA no puede inventar tablas ni reglas; debe citarlas y escribir la prueba de cada una. Ese es el método: la especificación primero y la IA como ejecutora verificada." |
| **0:55–1:40** | Supabase → *Database → Schema Visualizer* (o el diagrama ER de `docs/ARQUITECTURA.md`) | "Tres tablas pedidas más `proyecto_materiales`, porque la relación con materiales es N:M y tiene cantidad. Fíjense en las dos FKs de proyectos a instaladores: asignado y autor. Cada `on delete` está justificado: si se va un instalador el proyecto queda sin asignar, y un material en uso no se puede borrar." |
| **1:40–2:30** | Supabase → *Authentication → Policies*, tabla `proyectos` | "Seguridad en la base de datos, no en la interfaz. El instalador solo ve los proyectos donde `instalador_id` es su `auth.uid()`. Crear es solo para coordinación y con `creado_por` igual a quien llama. El rol está protegido con GRANT por columna: nadie puede hacerse coordinador." |
| **2:30–3:00** | App como **Laura (coordinadora)**: tarjetas, filtro por estado, búsqueda | "La coordinadora ve todo: 7 proyectos. Las tarjetas salen de una vista en la base de datos." |
| **3:00–3:35** | Cambiar a **Andrés** (o iniciar sesión como él) | "Andrés solo ve sus 3 proyectos y sus totales cambian. Aquí estuvo el problema complejo: la primera vista le mostraba los totales de toda la empresa, porque una vista corre con los permisos de su dueño. La solución fue `security_invoker = true`, y hay una prueba de control que demuestra la fuga sin esa opción." *(Muestra 5 s de `supabase/tests/rls.test.ts`, bloque SEG-06.)* |
| **3:35–4:05** | Andrés pulsa **Iniciar** y luego **Completar** | "El cambio es optimista. Si la base de datos lo rechaza, por ejemplo al saltar de Pendiente a Completado, se revierte y se explica el motivo. Un trigger solo permite avanzar un paso." |
| **4:05–4:40** | Vuelve a Laura → **Nuevo proyecto**: enviar vacío, fecha fin < inicio, inversor con cantidad > stock; después datos válidos | "La validación ocurre antes de llamar a Supabase: errores por campo, fechas y stock. Con datos válidos, una sola RPC crea el proyecto y sus materiales y descuenta el stock en una transacción: o todo o nada." |
| **4:40–5:00** | Terminal: `npm test` (84 pruebas) y `src/types/database.ts` | "Los tipos TypeScript los generó la IA, pero una prueba los compara con el esquema real. Las 84 pruebas corren sobre Postgres real con PGlite. Gracias." |

**Consejos:**
- Graba a 1280×800 o más.
- Haz zoom (Cmd +) en el código.
- Si te pasas de 5 minutos, recorta el bloque 0:20–0:55 y menciona la especificación en una sola frase.
