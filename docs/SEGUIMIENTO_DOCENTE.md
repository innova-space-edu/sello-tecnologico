# Módulo de seguimiento docente

## Qué agrega esta entrega

- Menú lateral **Seguimiento** para todos los usuarios autenticados.
- Vista docente con historial de sesiones y botón **Nueva sesión**.
- Formulario con fecha, ticket, curso, asignatura, proyecto, panel plegable de estudiantes, observaciones, retroalimentación, estado global, puntaje, tabla dinámica de criterios y fotografías.
- Selector para subir fotografías existentes y botón de cámara para tomar una fotografía en el instante desde dispositivos compatibles.
- Vista del estudiante con solo las evaluaciones en las que fue incluido.
- Vista detallada compartida con tabla evaluativa, retroalimentación y galería protegida.
- Edición completa por docente responsable, administrador, coordinador o UTP.

## Activación obligatoria en Supabase

1. Abrir **SQL Editor** en Supabase.
2. Ejecutar el archivo `supabase/migrations/20260601_project_followups.sql`.
3. Confirmar que se crearon las tablas:
   - `project_followups`
   - `followup_participants`
   - `followup_items`
   - `followup_photos`
4. Confirmar la existencia del bucket privado `seguimiento-fotos`.
5. Verificar en Vercel las variables ya utilizadas por el proyecto:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Flujo esperado

1. El docente entra a **Seguimiento** y selecciona **Nueva sesión**.
2. Escoge curso, proyecto y estudiantes mediante paneles plegables.
3. Completa criterios, evaluación, retroalimentación y evidencias fotográficas.
4. Los estudiantes seleccionados entran a **Seguimiento** y ven la sesión asignada.
5. El docente puede abrir la ficha y editarla posteriormente.

## Próxima etapa prevista

La bitácora autónoma de estudiantes se implementará como una sesión diferente: notas cronológicas, propósito, objetivo, verificación de cumplimiento, evidencias y comentarios del docente. No se mezcló con la evaluación docente para mantener permisos, interfaz y reportes claramente separados.
