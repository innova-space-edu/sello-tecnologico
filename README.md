<div align="center">

# 🏫 Ecosistema Multi-Tarea Basado en Proyectos

**Ecosistema escolar para crear, desarrollar, documentar, evaluar y publicar proyectos tecnológicos, científicos y STEAM.**

Desarrollado con **Next.js 16 · React 19 · Supabase · Tailwind CSS 4 · Vercel**

[![Producción](https://img.shields.io/badge/Producción-Vercel-black?logo=vercel)](https://sello-tecnologico.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-149ECA?logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Licencia](https://img.shields.io/badge/Licencia-Uso%20privado-red)](#-licencia-y-uso)

[Plataforma](https://sello-tecnologico.vercel.app) · [Comunidad pública](https://sello-tecnologico.vercel.app/comunidad) · [Repositorio](https://github.com/innova-space-edu/sello-tecnologico)

</div>

---

## 📋 Descripción

**Sello Tecnológico** es una plataforma educativa integral creada por la empresa Innova Space Edu SpA. Centraliza el ciclo completo de los proyectos escolares:

1. Creación y distribución de proyectos.
2. Organización individual o colaborativa de estudiantes.
3. Desarrollo guiado mediante rutas STEAM.
4. Registro de evidencias, bitácoras, pruebas y seguimientos.
5. Aplicación de encuestas y autoevaluaciones.
6. Elaboración colaborativa de informes.
7. Evaluación con rúbricas y nota chilena.
8. Construcción de portafolios personales y expedientes por proyecto.
9. Publicación de vitrinas, historias y contenidos en una comunidad pública.
10. Supervisión institucional, reportes, mensajería y moderación escolar.

El sistema utiliza **Supabase Auth**, PostgreSQL con **Row Level Security**, almacenamiento de archivos, eventos Realtime y rutas de servidor protegidas.

> **Aclaración sobre la IA:** **Mira** es la identidad, personalidad y forma de comunicación que utiliza la IA en distintos proyectos desarrollados por Innova Space Education. **EduAI** es una plataforma independiente y es el sistema que incorpora agentes educativos especializados. Este repositorio corresponde únicamente a **Sello Tecnológico**.

---

## 🧭 Módulos disponibles

### 📊 Dashboard

Panel personalizado según el rol del usuario:

- Resumen de proyectos, estados, evidencias, cursos, usuarios y páginas públicas.
- Progreso general de proyectos.
- Mensajes sin leer.
- Actividad reciente.
- Accesos rápidos a calendario, proyectos, evidencias, reportes y mensajería grupal.
- Indicadores diferenciados para estudiantes y personal del colegio.

### 👥 Usuarios, perfiles y roles

| Rol | Capacidades principales |
|---|---|
| 👑 **Admin** | Administración total, usuarios, proyectos, mensajes, moderación, notificaciones, reportes y configuración. |
| 🎯 **Coordinador** | Supervisión académica, proyectos, cursos, seguimientos, informes y evaluación. |
| 🧭 **UTP** | Revisión pedagógica, seguimiento, informes y funciones institucionales habilitadas para personal. |
| 👨‍🏫 **Docente** | Cursos, proyectos, distribución, seguimientos, encuestas, autoevaluaciones, informes y retroalimentación. |
| 🎓 **Estudiante** | Proyectos, evidencias, rutas STEAM, seguimiento, encuestas asignadas, informes, portafolio y comunidad. |

Funciones de perfiles:

- Inicio de sesión y registro con Supabase Auth.
- Detección automática de rol: correos `@colprovidencia.cl` se registran como docentes; los demás como estudiantes.
- Registro de nombre completo, RUT y curso.
- Cursos desde 1° Básico hasta 4° Medio.
- Creación o sincronización automática del perfil y membresía de curso.
- Edición administrativa de perfil, rol, contraseña y estado de bloqueo.
- Importación masiva de estudiantes.
- Filtros de usuarios por rol, curso, estado y búsqueda.

> Los roles `admin`, `coordinador` y `utp` no se asignan mediante el registro público; deben ser configurados por administración.

### 📚 Cursos

- Creación y edición de cursos.
- Año, área y nombre del curso.
- Incorporación y retiro manual de integrantes.
- Visualización de estudiantes por curso.
- Importación masiva.
- Invitación de un proyecto a todo el curso.
- Acceso directo a usuarios, proyectos y participantes asociados.

### 🗂️ Proyectos escolares

La ficha general del proyecto incluye información pedagógica y de gestión:

| Sección | Contenido |
|---|---|
| **A. Identificación** | Nombre, curso, responsables, fechas, semestre y tipo de proyecto. |
| **B. Vinculación curricular** | OA, habilidades, asignaturas, PEI y enfoque pedagógico. |
| **C. Problema o desafío** | Contexto, pregunta guía, justificación y necesidad detectada. |
| **D. Metodología** | ABP, STEAM, Design Thinking, organización y etapas. |
| **E. Tecnología e IA** | Herramientas utilizadas, uso de IA, verificación y ética. |
| **F. Producto final** | Resultado esperado, descripción y evidencias. |
| **G. Evaluación** | Instrumentos, criterios, rúbricas y estado de revisión. |
| **H. Reflexión** | Aprendizajes, dificultades, mejoras e impacto en la comunidad. |

También incluye:

- Estados: Borrador, En progreso, En revisión, Revisado, Aprobado y Cerrado.
- Comentarios y retroalimentación.
- Colaboradores aceptados.
- Grupos de proyecto y reconstrucción administrativa de grupos.
- Acceso a evidencias, ruta STEAM, informe, portafolio y vitrina pública.
- Exportación de proyectos a PDF.

#### Distribución e invitaciones

1. El docente crea un proyecto base.
2. Lo distribuye o invita a estudiantes y cursos.
3. Cada estudiante acepta la invitación.
4. El sistema genera o vincula la copia correspondiente.
5. La propiedad y edición quedan aisladas mediante políticas de seguridad.

### 🧩 Proyectos STEAM guiados

El proyecto incorpora un entorno guiado para disminuir la complejidad del trabajo escolar y acompañar al estudiante paso a paso.

#### Biblioteca de plantillas

- **31 plantillas STEAM** listas para iniciar.
- Niveles desde enseñanza básica y media según la plantilla.
- Dificultad inicial, intermedia o avanzada.
- Modalidades física, digital o híbrida.
- Materiales, producto esperado, pregunta guía y pruebas sugeridas.

#### Seis rutas de trabajo

| Ruta | Enfoque |
|---|---|
| 🔬 Investigación científica | Pregunta, hipótesis, variables, experimentación y análisis. |
| 🛠️ Ingeniería y prototipo | Diseño, construcción, pruebas y mejora iterativa. |
| 💻 Producto digital | Desarrollo de aplicaciones, sitios, recursos o soluciones digitales. |
| 🤖 Inteligencia artificial y datos | Datos, modelos, validación, sesgos y uso responsable de IA. |
| 📐 Matemática y modelación | Medición, representación, modelos y evaluación matemática. |
| 🎨 Creación, arte o intervención | Producción creativa, comunicación e impacto comunitario. |

#### Ocho fases

1. 🎯 Nuestro desafío.
2. 🔎 Investigación.
3. ✏️ Plan y diseño.
4. 🛠️ Primera versión.
5. 📊 Pruebas y evaluación.
6. 💬 Retroalimentación.
7. 🚀 Versión mejorada.
8. 🏁 Resultado final.

Funciones del espacio STEAM:

- Preguntas guiadas adaptadas a cada ruta.
- Guardado por fase.
- Evidencias obligatorias y opcionales vinculadas a la fase correcta.
- Revisión de seguridad, ética, permisos, herramientas y datos personales.
- Bloqueo de construcción hasta recibir aprobación docente cuando corresponde.
- Registro automático de versión 1 y versión 2 del prototipo.
- Tabla de pruebas con criterio, resultado esperado, resultado obtenido, unidad y cumplimiento.
- Bitácora rápida por sesión: trabajo realizado, problema encontrado y siguiente paso.
- Retroalimentación docente, aprobación o solicitud de cambios.
- Porcentaje de progreso y fase actual.
- Cierre conectado con informe y página pública.

### 📎 Evidencias

- Fotografías, videos, audios, documentos, enlaces, código y archivos externos.
- Relación directa con un proyecto.
- Clasificación inicial, intermedia y final.
- Fase y requisito STEAM asociado.
- Número de versión del prototipo.
- Reflexión sobre aprendizaje, dificultades y herramientas utilizadas.
- Edición, detalle y galería de evidencias.
- Reutilización de evidencias en informes, portafolios y vitrinas.

### 🧭 Seguimiento de proyectos

Dos modalidades en un mismo módulo:

#### Seguimiento docente

- Fecha, ticket, curso, asignatura y proyecto.
- Selección de estudiantes participantes.
- Observaciones y retroalimentación.
- Estado global y puntaje.
- Criterios evaluativos dinámicos.
- Fotografías existentes o captura desde cámara compatible.
- Edición por responsable, administración, coordinación o UTP.

#### Seguimiento del estudiante

- Registro autónomo del avance.
- Propósito, objetivo y cumplimiento.
- Dificultades, decisiones, evidencias y próximos pasos.
- Envío al docente.
- Comentarios y continuidad mediante un nuevo seguimiento relacionado.

El módulo incorpora actualizaciones Realtime, galería protegida y avisos personales.

### 🗳️ Encuestas evaluadas

- Creación y edición visual de formularios.
- Secciones y preguntas configurables.
- Preguntas de alternativa única o selección múltiple.
- Puntaje independiente por alternativa.
- Asignación por curso y por estudiante.
- Enlace público y código QR.
- Respuestas externas, anónimas o autenticadas.
- Pantalla **Mis encuestas** para estudiantes asignados.
- Resultados, tendencias y desglose por pregunta.
- Retroalimentación docente.
- Bloqueo de la pauta cuando ya existen respuestas.
- Analizadores visuales para resultados.

#### Escala chilena automática

- 0% → nota 1,0.
- 60% → nota 4,0.
- 100% → nota 7,0.
- Interpolación lineal y redondeo a un decimal.

### 🌱 Autoevaluaciones STEAM

- Formatos de autoevaluación configurables.
- Creación, copia y edición de formatos.
- Cuestionarios asociados a proyecto, curso y estudiante.
- Notificación a estudiantes seleccionados.
- Respuestas con decisión final y promedio.
- Revisión individual.
- Filtros por curso y nombre.
- Análisis grupal e individual mediante gráficos donut.
- Registro de proyecto o intervención y lugar intervenido.

### 📘 Informes colaborativos

Editor de informes por bloques integrado con el proyecto.

#### Plantillas incluidas

- Informe en blanco.
- Informe de proyecto.
- Informe científico.
- Intervención comunitaria.

#### Funciones

- Equipo con jefe de grupo y colaboradores editores.
- Presencia en línea de integrantes.
- Guardado manual y control de cambios.
- Bloques de título, texto, tabla y recursos.
- Reordenamiento, creación y eliminación de bloques.
- Biblioteca que reutiliza proyecto, evidencias, encuestas y páginas públicas.
- Comentarios y acciones del informe.
- Flujo: borrador, enviado, en revisión, cambios solicitados, evaluado y finalizado.
- Rúbrica compartida con criterios de 100 puntos.
- Evaluación por criterio y retroalimentación general.
- Cálculo de nota chilena 1,0–7,0 con 60% de exigencia.
- Permisos para estudiantes, líderes, colaboradores y personal evaluador.

### 📄 Documentos por bloques

Módulo adicional para documentos configurables:

- Creación desde plantillas administrables.
- Tipos de documento para proyectos, portafolios y evidencias.
- Bloques de texto, títulos, enlaces, listas, tablas, imágenes, archivos y registros de sesión.
- Campos para uso de IA, verificación y ética.
- Retroalimentación docente.
- Presencia de usuarios dentro del documento.
- Historial de cambios.
- Relación opcional con un proyecto.
- Administración de plantillas y bloques desde el panel administrativo.

### 📂 Portafolio personal y expediente de proyecto

#### Portafolio anual

- Información del estudiante.
- Presentación personal.
- Proyectos propios y colaborativos.
- Evidencias seleccionadas.
- Reflexiones.
- Progreso por etapas.
- Reflexión final.
- Secciones personalizadas.
- Modo Feria.
- Exportación a PDF.
- Vista de portafolios para personal autorizado.

#### Expediente unificado por proyecto

Cada participación genera un expediente individual que sincroniza registros del mismo proyecto:

- Ficha del proyecto.
- Evidencias.
- Seguimientos.
- Respuestas de encuestas.
- Autoevaluaciones.
- Página pública.
- Informe.
- Espacio STEAM.

Esto evita que el trabajo quede disperso entre módulos y permite revisar el proceso completo de cada estudiante.

### 🌐 Vitrinas y páginas públicas

Cada proyecto puede transformarse en una página pública editable:

- Constructor por bloques.
- Texto, imágenes, videos, audios, podcasts, archivos y enlaces.
- Recursos subidos a Supabase Storage.
- Paletas y configuración visual.
- Estado borrador o publicado.
- URL pública mediante `/p/[slug]`.
- Previsualizaciones Open Graph para compartir.
- Comentarios de usuarios autenticados.
- Reacciones múltiples.
- Vistas y estadísticas.
- Seguimiento de páginas, guardados y compartir nativo.
- Tendencias de contenido.
- Panel de páginas publicadas y borradores.

### 🌍 Comunidad pública

La ruta `/comunidad` reúne los contenidos públicos del colegio:

- Acceso sin iniciar sesión.
- Feed continuo de páginas, proyectos, imágenes, videos, audios, textos y archivos.
- Búsqueda por proyecto, curso, autor o publicación.
- Filtros por tipo de contenido.
- Orden por recientes o tendencias.
- Paginación progresiva.
- Reacciones, comentarios, vistas, compartir, seguir página y guardar localmente.
- Los comentarios requieren una cuenta autenticada.

### 🎬 Historias de la comunidad

- Carrusel público de imágenes y videos verticales.
- Hasta 10 elementos por historia.
- Máximo de 50 MB por archivo.
- Publicación por usuarios autenticados.
- Asociación opcional con proyecto, curso o página pública.
- Reacciones, comentarios, vistas y reportes.
- Publicación inmediata con aviso de revisión al personal.
- Estados de revisión: pendiente, revisada, marcada o con corrección solicitada.
- Estados de visibilidad: publicada, oculta, eliminada o expirada.
- Historias destacadas.
- Historial permanente de decisiones de moderación.
- Ruta individual para compartir y metadatos Open Graph. La publicación sin sesión depende de la configuración del proxy.

### 💬 Mensajería y avisos

#### Mensajes directos

- Conversaciones entre usuarios autorizados.
- Indicador de usuarios conectados.
- Conteo de mensajes sin leer.
- Restricción para estudiantes al mismo curso y personal autorizado.
- Bloqueo de parejas de usuarios.
- Monitoreo de seguridad.

#### Mensajes grupales

- Envío por administración o docentes.
- Selección múltiple de destinatarios.
- Adjuntos.
- Envío individual agrupado mediante lotes de mensajes.
- Pantalla administrativa y exportación de mensajes en JSONL.

#### Provi

**Provi es un chat grupal en tiempo real para docentes, administración y coordinación.** No es un asistente de IA.

#### Notificaciones

- Banners globales administrables.
- Tipos info, advertencia, éxito y error.
- Actualización con Supabase Realtime.
- Avisos personales con contador.
- Avisos por encuestas, seguimientos, resultados, retroalimentación, autoevaluaciones e historias pendientes de revisión.

### 🤖 Mira — identidad de la IA

**Mira** es el nombre, la personalidad y la identidad conversacional con la que responde la inteligencia artificial en varios proyectos desarrollados por Innova Space Education. No corresponde a una plataforma independiente ni al nombre de una arquitectura de agentes.

Dentro de **Sello Tecnológico**, la IA integrada se presenta y responde como Mira:

- Mantiene una comunicación cercana, educativa y en español.
- Apoya consultas académicas, tecnológicas y relacionadas con los proyectos escolares.
- Se integra mediante una API protegida del lado servidor.
- Utiliza actualmente **Groq** como proveedor de inferencia.
- Modelo principal configurado: `llama-3.3-70b-versatile`.
- Incluye respaldo automático entre modelos compatibles definidos en la ruta API.
- Informa claramente cuando el servicio no está configurado o se encuentra temporalmente no disponible.

#### Relación con EduAI

**EduAI** es otro proyecto y una plataforma independiente. EduAI es el sistema que contiene la arquitectura **multiagente**, con agentes educativos especializados para distintas funciones.

Aunque Sello Tecnológico y EduAI pueden utilizar la identidad conversacional de Mira, no son la misma plataforma:

| Concepto | Descripción |
|---|---|
| **Mira** | Identidad, personalidad y forma de comunicación de la IA utilizada en distintos proyectos. |
| **Sello Tecnológico** | Plataforma de gestión, desarrollo, evaluación y publicación de proyectos escolares. Integra una IA que responde como Mira. |
| **EduAI** | Plataforma educativa multiagente que reúne agentes especializados. Se mantiene como un proyecto y repositorio independiente. |

> Este README documenta exclusivamente las funciones existentes en **Sello Tecnológico**. Las capacidades, agentes y módulos propios de EduAI deben describirse en la documentación de ese proyecto.

### 🚨 Moderación y convivencia escolar

- Motor de análisis de contenido inapropiado.
- Categorías de riesgo: agresión, discriminación, privacidad y connotación sexual, entre otras.
- Registro en `flagged_messages`.
- Alertas pendientes en tiempo real para administración.
- Revisión del mensaje y contexto de conversación.
- Bloqueo o desbloqueo de usuarios y parejas de conversación.
- Historial de bloqueos y decisiones.
- Vista especializada de agresiones.
- Reanálisis administrativo.
- Protección especial de cuentas administrativas.
- Exportación de mensajes para revisión institucional.

### 📈 Reportes, calendario y auditoría

- Estadísticas por rol, estado, curso y tipo de evidencia.
- Usuarios, proyectos, cursos, mensajes e incidencias.
- Proyectos activos, revisados y bloqueados.
- Accesos y actividad reciente.
- Descargas PDF registradas.
- Gráficos interactivos con Recharts.
- Exportación de reportes a PDF con jsPDF.
- Calendario mensual de proyectos y eventos.
- Registro de accesos, auditoría y descargas.

### 👑 Administración y configuración

- Panel general de usuarios, proyectos, evidencias y mensajes.
- Gestión de proyectos y plantillas.
- Edición, bloqueo, eliminación y recuperación de cuentas.
- Restablecimiento de contraseñas.
- Importación de usuarios.
- Mensajería institucional.
- Moderación y revisión de historias.
- Configuración de nombre del colegio, año activo, repositorio y logo.

---

## 🔐 Seguridad

- Supabase Auth con correo y contraseña.
- Clientes Supabase separados para navegador, servidor y administración.
- `SUPABASE_SERVICE_ROLE_KEY` utilizada únicamente en rutas de servidor.
- Row Level Security en módulos nuevos.
- Middleware/proxy de autenticación para rutas privadas.
- Verificación de roles en páginas y API Routes.
- Separación entre contenido público y contenido autenticado.
- Buckets con políticas específicas de lectura y escritura.
- Aislamiento de propiedad y colaboración en proyectos.
- Comentarios públicos limitados a usuarios autenticados.
- Moderación automática y manual.
- Registro de accesos y acciones relevantes.

### Rutas públicas principales

- `/login`
- `/bloqueado`
- `/comunidad`
- `/p/[slug]`
- `/formularios/[slug]`
- `/auth/callback`

El resto de las rutas queda protegido por `src/proxy.ts`, salvo endpoints públicos definidos expresamente.

---

## 🗄️ Supabase

### Grupos principales de tablas

| Área | Tablas principales |
|---|---|
| Usuarios y cursos | `profiles`, `courses`, `course_members` |
| Proyectos | `projects`, `project_collaborators`, `project_groups`, `project_group_members`, `project_invitations`, `comments` |
| Evidencias y portafolios | `evidences`, `portfolios`, `portfolio_sections`, `project_portfolios`, `project_portfolio_items` |
| STEAM guiado | `steam_project_workspaces`, `steam_phase_entries`, `steam_journal_entries`, `steam_prototype_versions`, `steam_project_tests` |
| Seguimientos | `project_followups`, `followup_participants`, `followup_items`, `followup_photos` |
| Encuestas | `surveys`, `survey_questions`, `survey_course_staff`, `survey_students`, `survey_responses`, `survey_answers` |
| Autoevaluación | `self_evaluation_formats`, `self_evaluations` |
| Informes | `project_reports`, `project_report_members`, `project_report_sections`, `project_report_comments`, `project_report_rubrics`, `project_report_rubric_criteria`, `project_report_evaluations`, `project_report_scores` |
| Documentos | `templates`, `template_blocks`, `documents`, `document_presence` |
| Vitrinas | `project_public_pages`, `project_public_blocks`, `project_public_assets`, `project_public_page_comments`, `project_public_page_likes`, `project_public_page_views` |
| Comunidad | `public_social_feed`, `community_stories`, `community_story_items`, `community_story_reactions`, `community_story_comments`, `community_story_views`, `community_story_reports`, `community_story_review_history` |
| Mensajería | `messages`, `group_messages`, `message_batches`, `message_attachments` |
| Moderación | `flagged_messages`, `blocked_pairs`, `block_history`, `block_values` |
| Avisos y auditoría | `notifications`, `user_notifications`, `audit_log`, `user_access_logs`, `report_downloads`, `calendar_events` |

### Buckets de Storage

- `project-public-assets`: recursos de vitrinas y páginas públicas.
- `community-stories`: imágenes y videos de historias.
- `seguimiento-fotos`: fotografías privadas de seguimientos.

### Vistas relevantes

- `public_social_feed`
- `project_public_page_trending`
- `community_active_stories`

---

## 🧱 Migraciones incluidas

Ejecutar las migraciones disponibles respetando el orden cronológico:

```text
supabase/migrations/20260604_surveys.sql
supabase/migrations/20260604_surveys_option_scores.sql
supabase/migrations/20260604_surveys_scoring.sql
supabase/migrations/20260604_surveys_students.sql
supabase/migrations/20260604_surveys_teacher_admin_only.sql
supabase/migrations/20260604_user_notifications.sql
supabase/migrations/20260617_message_batches.sql
supabase/migrations/20260617_self_evaluations.sql
supabase/migrations/20260624_project_public_pages.sql
supabase/migrations/20260625_inline_publication_interactions.sql
supabase/migrations/20260625_vitrina_social_interactions.sql
supabase/migrations/20260627_allow_revisado_project_status.sql
supabase/migrations/20260627_moderation_aggression_view.sql
supabase/migrations/20260627_page_design_palettes.sql
supabase/migrations/20260627_self_evaluation_formats_and_notifications.sql
supabase/migrations/20260627_survey_sections_and_analyzer_types.sql
supabase/migrations/20260714_public_social_feed.sql
supabase/migrations/20260715_community_stories.sql
supabase/migrations/20260715_reactions_and_story_review_history.sql
supabase/migrations/20260715_z_authenticated_social_comments.sql
supabase/migrations/20260716235920_user_notifications_open_types.sql
supabase/migrations/20260716_000_project_reports_schema_bootstrap.sql
supabase/migrations/20260716_project_reports_collaboration.sql
supabase/migrations/20260716_project_reports_permissions_functions.sql
supabase/migrations/20260716_project_reports_policy_function_grants.sql
supabase/migrations/20260716_project_reports_security_and_grading_fix.sql
supabase/migrations/20260716_z_project_reports_policy_function_grants.sql
supabase/migrations/20260716235930_project_reports_manual_permissions_fix.sql
supabase/migrations/20260718002849_steam_guided_projects.sql
supabase/migrations/20260720021611_unified_project_portfolios.sql
```

> **Importante:** esta copia del repositorio contiene migraciones incrementales, pero no incluye todas las migraciones históricas del esquema base. Para una instalación desde cero todavía se necesita el SQL original de tablas como `profiles`, `courses`, `projects`, `messages`, `evidences`, `documents` y las tablas base de seguimiento. El documento `docs/SEGUIMIENTO_DOCENTE.md` también menciona `20260601_project_followups.sql`, archivo que no está incluido en esta copia.

---

## 🚀 Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.1.6, App Router y Turbopack |
| Interfaz | React 19.2.3 |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS 4 |
| Autenticación | Supabase Auth |
| Base de datos | Supabase PostgreSQL |
| Seguridad | RLS, proxy de autenticación y API Routes con validación de rol |
| Tiempo real | Supabase Realtime |
| Archivos | Supabase Storage |
| Gráficos | Recharts 3.7 |
| PDF | jsPDF y jsPDF AutoTable |
| IA | Groq API |
| Despliegue | Vercel |
| Control de versiones | GitHub |

---

## 📁 Estructura principal

```text
sello-tecnologico/
├── docs/                         # Documentación funcional y validaciones
├── public/                       # Logos y recursos estáticos
├── scripts/                      # Scripts de mantenimiento y parches
├── supabase/
│   └── migrations/               # Migraciones incrementales de Supabase
├── src/
│   ├── app/
│   │   ├── admin/                # Administración, mensajes y moderación
│   │   ├── api/                  # API Routes protegidas
│   │   ├── autoevaluacion/       # Formatos, respuestas y análisis
│   │   ├── calendario/           # Calendario
│   │   ├── comunidad/            # Feed público
│   │   ├── configuracion/        # Ajustes de plataforma
│   │   ├── cursos/               # Gestión de cursos
│   │   ├── dashboard/            # Panel principal
│   │   ├── documentos/           # Editor por bloques
│   │   ├── encuestas/            # Encuestas docentes
│   │   ├── evidencias/           # Evidencias de proyectos
│   │   ├── formularios/          # Formularios públicos
│   │   ├── historia/             # Historia pública individual
│   │   ├── informes/             # Informes colaborativos
│   │   ├── mensajes/             # Mensajes directos y grupales
│   │   ├── mis-encuestas/        # Encuestas asignadas al estudiante
│   │   ├── mis-notificaciones/   # Avisos personales
│   │   ├── portafolio/           # Portafolio anual y expedientes
│   │   ├── proyectos/            # Proyectos clásicos y STEAM guiados
│   │   ├── publicacion/          # Redirecciones y publicaciones
│   │   ├── reportes/             # Analítica y exportación
│   │   ├── revision-historias/   # Revisión de contenido social
│   │   ├── seguimientos/         # Seguimiento docente y estudiantil
│   │   ├── usuarios/             # Gestión de usuarios
│   │   └── vitrinas/             # Administración de páginas públicas
│   ├── components/
│   │   ├── analisis/
│   │   ├── autoevaluacion/
│   │   ├── encuestas/
│   │   ├── informes/
│   │   ├── mensajes/
│   │   ├── portafolio/
│   │   ├── seguimientos/
│   │   ├── share/
│   │   ├── social/
│   │   ├── stories/
│   │   └── vitrinas/
│   ├── lib/                      # Supabase, permisos, moderación y plantillas
│   └── proxy.ts                  # Protección de rutas y control de sesión
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## ⚡ Variables de entorno

Crear `.env.local` en la raíz:

```env
# Supabase público
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY

# Supabase privado: solo servidor
SUPABASE_SERVICE_ROLE_KEY=TU_SUPABASE_SERVICE_ROLE_KEY

# URL de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# IA con identidad Mira
GROQ_API_KEY=TU_GROQ_API_KEY
```

En Vercel, `VERCEL_PROJECT_PRODUCTION_URL` es proporcionada automáticamente por la plataforma y se utiliza como respaldo para los metadatos públicos.

> Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` con el prefijo `NEXT_PUBLIC_` ni la utilices en componentes del navegador.

---

## 🔧 Desarrollo local

### Requisitos

- Node.js 20 o superior recomendado.
- npm.
- Proyecto Supabase configurado.
- Variables de entorno válidas.
- Esquema base y migraciones instaladas.

### Instalación

```bash
git clone https://github.com/innova-space-edu/sello-tecnologico.git
cd sello-tecnologico
npm ci
```

Crear `.env.local` y luego iniciar:

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

### Comandos disponibles

```bash
npm run dev                 # Desarrollo
npm run build               # Compilación de producción
npm run start               # Servidor de producción
npm run lint                # ESLint
npm run apply:pages-video   # Ejecuta scripts de parcheo de páginas, videos e informes
```

El comando `apply:pages-video` modifica archivos fuente mediante scripts de mantenimiento. Debe ejecutarse de forma intencional y con el repositorio respaldado en Git.

### Validaciones recomendadas

```bash
npm run lint
npx tsc --noEmit
npm run build
```

> `next.config.ts` actualmente usa `typescript.ignoreBuildErrors: true`, por lo que el build puede continuar aunque existan errores de tipos. Además, la clave `eslint.ignoreDuringBuilds` ya no es reconocida por Next.js 16 y genera una advertencia. Ejecuta TypeScript y ESLint por separado antes de fusionar o desplegar cambios.

---

## 📦 Despliegue en Vercel

1. Conectar el repositorio `innova-space-edu/sello-tecnologico` a Vercel.
2. Configurar todas las variables de entorno.
3. Confirmar que las migraciones de Supabase estén aplicadas.
4. Configurar el dominio de producción.
5. Desplegar desde la rama principal.

```bash
git add .
git commit -m "docs: actualizar documentación del proyecto"
git push origin main
```

Vercel detectará el cambio y generará un nuevo despliegue.

---

## ✅ Lista de comprobación después del deploy

- Inicio de sesión y registro.
- Creación automática del perfil y asignación de curso.
- Dashboard según rol.
- Creación, distribución y aceptación de proyectos.
- Carga y visualización de evidencias.
- Apertura de una ruta STEAM y guardado de fases.
- Seguimientos con fotografías.
- Encuestas públicas y asignadas.
- Autoevaluaciones y avisos.
- Creación y evaluación de informes.
- Portafolio y expediente de proyecto.
- Publicación de una vitrina.
- Feed `/comunidad` e historias.
- Reacciones, vistas y comentarios autenticados.
- Mensajes directos, grupales y Provi.
- Moderación y revisión de contenido.
- Exportaciones PDF.

---

## ⚠️ Observaciones técnicas actuales

- El repositorio usa un esquema Supabase histórico que no está completamente representado por las migraciones incluidas.
- Las migraciones nuevas deben aplicarse en el orden indicado.
- El proyecto contiene funciones que dependen del rol `utp`, aunque ese rol no se ofrece en el registro público.
- La integración de IA que responde como Mira necesita `GROQ_API_KEY`; sin ella muestra un aviso de servicio no configurado.
- Las páginas públicas y la comunidad dependen de Storage y de las políticas RLS correspondientes.
- La ruta `/historia/[id]` existe, pero `src/proxy.ts` no la incluye actualmente entre las rutas públicas; un visitante sin sesión será redirigido al login.
- El build ignora errores TypeScript mediante `typescript.ignoreBuildErrors`. La opción `eslint.ignoreDuringBuilds` es obsoleta en Next.js 16 y debe eliminarse o actualizarse.
- La validación `npx tsc --noEmit` de esta copia reporta errores pendientes en analizadores de autoevaluación, el editor de formatos, el editor de vitrinas, el motor de moderación y la configuración de Next.js.

---

## 📚 Documentación complementaria

- `docs/AUTOEVALUACION_STEAM.md`
- `docs/ENCUESTAS.md`
- `docs/SEGUIMIENTO_DOCENTE.md`
- `docs/VALIDACION_SEGUIMIENTO.md`

---

## 👨‍💻 Desarrollo

**Innova Space Education**  
Fundador y desarrollador: **Esthefano Morales Campaña**  
Sitio institucional: [innova-space-edu.cl](https://www.innova-space-edu.cl/)  
Correo: [contacto@innova-space-edu.cl](mailto:contacto@innova-space-edu.cl)

Plataforma desarrollada **Ecosistema Multi-Tarea Basado en Proyectos**.

---

## 🔒 Licencia y uso

Este repositorio es de **uso privado**. Su código, base de datos, recursos, configuración y documentación no se distribuyen bajo una licencia de código abierto. Cualquier copia, publicación, reutilización o despliegue externo requiere autorización de sus responsables.

---

<div align="center">

**Ecosistema Multi-Tarea Basado en Proyectos · Innova Space Edu SpA · 2026**

<sub>Proyectos, ciencia, tecnología, creatividad y comunidad educativa.</sub>

</div>
