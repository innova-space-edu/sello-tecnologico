# Módulo Autoevaluación STEAM

## Qué se agregó

Nueva sección `/autoevaluacion` para que cada estudiante responda un cuestionario fijo de autoevaluación sobre proyectos STEAM, reciclaje, sitios verdes, seguimiento y mantención.

El estudiante debe:

1. Ingresar su nombre.
2. Seleccionar curso.
3. Indicar nombre del proyecto o intervención.
4. Indicar lugar intervenido en el colegio.
5. Responder el cuestionario.
6. Confirmar el envío final.

Al enviar, la autoevaluación queda guardada en Supabase en la tabla `self_evaluations`.

## Visualización docente/admin

Docentes y administradores pueden entrar a:

- `/autoevaluacion/respuestas`

Desde ahí pueden filtrar por:

- Curso.
- Nombre del estudiante.

Cada registro abre una página individual:

- `/autoevaluacion/respuestas/[id]`

Ahí se visualizan todas las respuestas, el proyecto, el lugar intervenido, la decisión final y el promedio de los ítems de autoevaluación.

## Archivos creados

- `src/lib/autoevaluacion.ts`
- `src/components/autoevaluacion/AutoevaluacionForm.tsx`
- `src/app/autoevaluacion/page.tsx`
- `src/app/autoevaluacion/respuestas/page.tsx`
- `src/app/autoevaluacion/respuestas/[id]/page.tsx`
- `src/app/api/autoevaluacion/route.ts`
- `supabase/migrations/20260617_self_evaluations.sql`

## Archivo modificado

- `src/components/Sidebar.tsx`

Se agregaron accesos laterales:

- `Autoevaluación`
- `Respuestas autoevaluación`, visible solo para docente/admin.

## Migración necesaria en Supabase

Ejecutar la migración:

```sql
supabase/migrations/20260617_self_evaluations.sql
```

Esta migración crea la tabla `self_evaluations`, índices y políticas RLS básicas para que cada estudiante pueda leer su respuesta y docentes/admin puedan revisar respuestas.
