# Módulo de encuestas evaluadas

## Qué incorpora

- Menú lateral **Encuestas** para administración, docentes, coordinación y UTP.
- Creación y edición visual de encuestas por curso.
- Curso predeterminado cuando el usuario ya tiene membresía o curso registrado.
- Ítems editables: alternativa única, selección múltiple, respuesta abierta y evaluación apreciativa de 1 a 5.
- Puntaje máximo configurable para cada pregunta.
- Pauta de corrección para preguntas cerradas.
- Cálculo automático de puntaje obtenido, porcentaje de logro y nota chilena de 1,0 a 7,0.
- Exigencia del 60% para alcanzar nota 4,0.
- Panel plegable para seleccionar docentes autorizados a revisar resultados.
- Página pública compartible mediante enlace y código QR.
- Respuestas anónimas opcionales.
- Panel interno con respuestas detalladas, puntajes y notas, restringido a administración, creador y docentes autorizados.
- Bloqueo automático de la pauta cuando ya existen respuestas, para preservar la validez de las calificaciones.

## Cálculo de la nota

La nota se calcula por tramos:

- 0% → 1,0
- 60% → 4,0
- 100% → 7,0

Entre esos puntos se usa interpolación lineal y la nota se redondea a un decimal.

## Rutas

- Panel interno: `/encuestas`
- Nueva encuesta: `/encuestas/nuevo`
- Detalle y resultados: `/encuestas/[id]`
- Edición: `/encuestas/[id]/editar`
- Formulario público: `/formularios/[slug]`

## Activación obligatoria en Supabase

Antes de probar el módulo en producción, ejecutar en **Supabase SQL Editor** estos archivos en el siguiente orden:

1. `supabase/migrations/20260604_surveys.sql`
2. `supabase/migrations/20260604_surveys_scoring.sql`

La primera migración crea las tablas:

- `surveys`
- `survey_questions`
- `survey_course_staff`
- `survey_responses`
- `survey_answers`

La segunda migración agrega:

- `max_points` y `correct_answers` en preguntas.
- `awarded_points` en respuestas individuales.
- `earned_points`, `max_points`, `achievement_percent` y `grade` en cada respuesta completa.
- Triggers para calcular puntaje y nota automáticamente en la base de datos.
- Resguardos para impedir que una persona envíe una nota manipulada desde el navegador.

También se habilitan políticas RLS y permisos por columna para permitir responder públicamente sin exponer resultados ni pautas correctas.

## Prueba recomendada

1. Ejecutar ambas migraciones SQL en orden.
2. Desplegar la rama `feature/encuestas` en Vercel.
3. Entrar como docente o administrador.
4. Abrir **Encuestas** y crear una encuesta asociada a un curso.
5. Agregar al menos un ítem de alternativa con respuesta correcta y uno apreciativo.
6. Definir puntaje máximo para cada ítem.
7. Copiar el enlace público o abrir el QR.
8. Responder el formulario sin iniciar sesión.
9. Confirmar que el panel interno muestre puntaje, porcentaje y nota.
10. Entrar como estudiante y comprobar que no aparece el menú interno de Encuestas.
