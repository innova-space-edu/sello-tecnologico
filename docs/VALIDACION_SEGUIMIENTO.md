# Validación técnica — módulo Seguimiento docente

Fecha de preparación: 2026-06-01

## Comprobaciones completadas

- `./node_modules/.bin/tsc --noEmit --pretty false` → **correcto**, sin errores TypeScript.
- `./node_modules/.bin/eslint src/app/seguimientos src/components/seguimientos src/app/api/seguimientos` → **correcto**, sin errores ni advertencias del módulo nuevo.
- `next build --experimental-build-mode compile` → el bundle compila correctamente y alcanza la fase de optimización final.

## Observación sobre la compilación global

En este contenedor, la compilación completa del repositorio no finaliza el proceso después de la optimización de páginas. El código nuevo no presenta errores de TypeScript ni lint aislado. El repositorio original también contiene errores de lint en módulos preexistentes no relacionados con Seguimiento docente; no fueron modificados para evitar alterar funcionalidades ajenas a esta entrega.

## Activación necesaria

Antes de abrir `/seguimientos` en producción, ejecutar una sola vez:

`supabase/migrations/20260601_project_followups.sql`

La migración crea las tablas, índices, políticas RLS y el bucket privado `seguimiento-fotos`.
