# Módulo de encuestas evaluadas


## Nuevo creador de encuestas en línea (CreaLab)

El módulo **Mis encuestas** ahora también permite **crear formularios en línea** desde
cuentas de estudiantes, docentes y administración. Se mantiene separado del
módulo de encuestas **evaluadas y calificadas**, para no alterar notas existentes.

- **Editor:** \`/mis-encuestas/crear\`. Admite hasta 25 preguntas: respuesta corta,
  párrafo largo, alternativa única, selección múltiple, escala 1–5, número y fecha.
  Permite reordenar preguntas, duplicarlas, marcar obligatoriedad y usar secciones.
- **Mis formularios:** \`/mis-encuestas\` muestra los creados y las encuestas asignadas.
- **Resultados:** \`/mis-encuestas/creadas/[id]\`. Solo el autor o administración
  accede al resumen y las respuestas. Las preguntas se bloquean cuando existen respuestas.
- **Enlace público:** \`/formularios-online/[slug]\`. Se puede responder sin cuenta ni
  aportar nombre/correo. No muestra resultados ni información de la persona creadora.
- **Compartir:** el detalle genera un enlace copiable y un código QR mediante QuickChart
  (el proveedor recibe únicamente la dirección pública, nunca las respuestas).
- **Revisión:** formularios creados por estudiantes quedan en \`pending_review\`.
  Un administrador los aprueba en \`/admin/encuestas-online\`; solo los publicados
  aceptan visitas y respuestas. Docentes y administración publican directamente.
- **Protección:** \`online_surveys\` y \`online_survey_submissions\` usan RLS y no
  otorgan permisos directos de Data API a \`anon\` ni \`authenticated\`. Las API
  comprueban identidad, propiedad, roles, publicación y límites de tamaño;
  las respuestas almacenan un token de envío aleatorio y una huella de red
  seudonimizada para reducir abusos. No sustituye la protección anti-bots del WAF.
- **Supabase:** migración aplicada \`20261110172838_online_surveys_project_lab.sql\`.
  Las encuestas calificadas preexistentes no se modifican.


## Qué incorpora

- Menú interno **Encuestas** para cuentas con rol `docente` o `admin`.
- Creación y edición visual de encuestas por curso.
- Página pública compartible mediante enlace y código QR.
- Respuestas públicas para usuarios externos o anónimos.
- Selección de estudiantes registrados por curso mediante `survey_students`.
- Pantalla **Mis encuestas** para estudiantes asignados.
- Pantalla **Mis avisos** con notificaciones personales y contador en tiempo real.
- Puntaje independiente configurable para cada alternativa.
- Cálculo automático de puntaje, porcentaje y nota chilena de 1,0 a 7,0.
- Exigencia del 60% para alcanzar nota 4,0.
- Panel interno con respuestas detalladas, tendencias por alternativa y retroalimentación docente.
- Resultado estudiantil completo: puntaje total, porcentaje, nota, retroalimentación y desglose por pregunta.
- Avisos automáticos al asignar encuestas o seguimientos y cuando se actualizan resultados o retroalimentaciones.
- Bloqueo automático de la pauta cuando existen respuestas, para preservar la validez de las calificaciones.

## Cálculo de la nota

La nota se calcula por tramos:

- 0% → 1,0
- 60% → 4,0
- 100% → 7,0

Entre esos puntos se usa interpolación lineal y la nota se redondea a un decimal.

## Puntaje por alternativa

En preguntas de alternativa única, el puntaje máximo del ítem corresponde al mayor valor configurado. Ejemplo:

- Logrado → 3 puntos
- Medianamente logrado → 2 puntos
- No logrado → 1 punto

En preguntas de selección múltiple, el puntaje máximo corresponde a la suma de los valores positivos configurados.

## Rutas principales

- Panel interno: `/encuestas`
- Nueva encuesta: `/encuestas/nuevo`
- Detalle y resultados docentes: `/encuestas/[id]`
- Gestión de estudiantes: `/encuestas/estudiantes/[id]`
- Edición: `/encuestas/[id]/editar`
- Formulario público: `/formularios/[slug]`
- Sesión estudiantil: `/mis-encuestas`
- Detalle estudiantil: `/mis-encuestas/[id]`
- Bandeja personal: `/mis-notificaciones`

## Activación obligatoria en Supabase

Ejecutar en **Supabase SQL Editor** estos archivos en orden:

1. `supabase/migrations/20260604_surveys.sql`
2. `supabase/migrations/20260604_surveys_scoring.sql`
3. `supabase/migrations/20260604_surveys_teacher_admin_only.sql`
4. `supabase/migrations/20260604_surveys_students.sql`
5. `supabase/migrations/20260604_surveys_option_scores.sql`
6. `supabase/migrations/20260604_user_notifications.sql`

Las migraciones crean las tablas del módulo, los puntajes por alternativa, las calificaciones automáticas, la asignación de estudiantes y la tabla `user_notifications` protegida con RLS.

La última migración agrega triggers para:

- Avisar cuando un estudiante es asignado a una encuesta.
- Avisar cuando un estudiante es asignado a un seguimiento.
- Avisar cuando cambia el estado, puntaje o retroalimentación de un seguimiento.
- Avisar cuando se actualiza una calificación o retroalimentación de encuesta.

## Consideración sobre respuestas públicas

El enlace `/formularios/[slug]` permanece público. Una respuesta externa o anónima aparece en el panel docente, pero solamente se asocia automáticamente a la sesión privada de un estudiante cuando la persona responde con su cuenta iniciada y queda registrado `registered_user_id`.

## Prueba recomendada

1. Desplegar la rama `feature/encuestas` en Vercel.
2. Entrar como docente o administrador.
3. Crear una encuesta, seleccionar un curso y asignar estudiantes registrados.
4. Iniciar sesión con una cuenta estudiantil seleccionada.
5. Confirmar que aparecen **Mis avisos** y **Mis encuestas**.
6. Abrir la encuesta pendiente y responderla con la cuenta iniciada.
7. Confirmar que aparecen puntaje, porcentaje, nota y desglose por pregunta.
8. Entrar nuevamente como docente, abrir la respuesta y guardar una retroalimentación.
9. Volver a la cuenta estudiantil y confirmar que llega un aviso nuevo y aparece el comentario.
10. Crear o actualizar un seguimiento para el mismo estudiante y comprobar que el aviso abre `/seguimientos/[id]`.
