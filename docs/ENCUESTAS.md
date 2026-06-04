# Módulo de encuestas

## Qué incorpora

- Menú lateral **Encuestas** para administración, docentes, coordinación y UTP.
- Creación y edición visual de encuestas por curso.
- Curso predeterminado cuando el usuario ya tiene membresía o curso registrado.
- Ítems editables: alternativa única, selección múltiple, respuesta abierta y evaluación apreciativa de 1 a 5.
- Panel plegable para seleccionar docentes autorizados a revisar resultados.
- Página pública compartible mediante enlace y código QR.
- Respuestas anónimas opcionales.
- Panel interno con respuestas detalladas, restringido a administración, creador y docentes autorizados.

## Rutas

- Panel interno: `/encuestas`
- Nueva encuesta: `/encuestas/nuevo`
- Detalle y resultados: `/encuestas/[id]`
- Edición: `/encuestas/[id]/editar`
- Formulario público: `/formularios/[slug]`

## Activación obligatoria en Supabase

Antes de probar el módulo en producción, ejecutar en **Supabase SQL Editor** el archivo entregado por separado:

`20260604_surveys.sql`

La migración crea estas tablas:

- `surveys`
- `survey_questions`
- `survey_course_staff`
- `survey_responses`
- `survey_answers`

También habilita RLS y políticas diferenciadas para permitir responder públicamente sin exponer los resultados.

## Prueba recomendada

1. Ejecutar la migración SQL.
2. Entrar como docente o administrador.
3. Abrir **Encuestas** y crear una encuesta asociada a un curso.
4. Agregar al menos un ítem de alternativa y uno apreciativo.
5. Copiar el enlace público o abrir el QR.
6. Responder el formulario sin iniciar sesión.
7. Confirmar que la respuesta aparece en el panel interno.
8. Entrar como estudiante y comprobar que no aparece el menú interno de Encuestas.
