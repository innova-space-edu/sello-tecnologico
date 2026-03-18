<div align="center">

# 🏫 Sello Tecnológico — Colegio Providencia

**Plataforma de gestión de proyectos tecnológicos escolares**  
Desarrollada con Next.js 16 · Supabase · Vercel · Tailwind CSS

[![Deploy](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://sello-tecnologico.vercel.app)
[![Stack](https://img.shields.io/badge/Stack-Next.js%2016%20+%20Supabase-blue)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-Privado-red)](.)

</div>

---

## 📋 ¿Qué es el Sello Tecnológico?

Sistema web integral para que el **Colegio Providencia** gestione, documente y evalúe proyectos tecnológicos escolares. Permite a docentes crear y distribuir fichas de proyectos, a estudiantes completarlas individualmente, y a administradores supervisar todo el proceso desde un único panel.

---

## ✨ Funcionalidades principales

### 👥 Gestión de usuarios y roles
| Rol | Capacidades |
|-----|------------|
| 👑 **Admin** | Acceso total: gestión de usuarios, configuración, moderación, reportes |
| 🎯 **Coordinador** | Igual que admin excepto configuración de sistema |
| 👨‍🏫 **Docente** | Crear/distribuir proyectos, gestionar cursos, ver reportes |
| 🎓 **Estudiante** | Completar proyectos, subir evidencias, ver portafolio |

- Registro automático con detección de rol por correo (`@colprovidencia.cl` → Docente)
- Al registrarse, los estudiantes se asignan automáticamente a su curso (ej: `1mA` → `1° Medio A`)
- El curso se crea automáticamente si no existe
- Solo administradores y docentes pueden cambiar roles

### 📚 Cursos
- Creación y gestión de cursos por año y área
- Agregar/quitar estudiantes manualmente o por importación masiva (CSV)
- Botón **📨 Invitar** directo en cada curso para enviar proyectos al curso completo

### 🗂️ Proyectos — Ficha completa de 8 secciones
Los proyectos siguen una estructura pedagógica basada en metodologías MINEDUC:

| Sección | Contenido |
|---------|-----------|
| **A. Identificación** | Nombre, año, semestre, curso, docentes, tipo, fechas |
| **B. Curricular** | OA MINEDUC, habilidades, vinculación PEI |
| **C. Problema** | Pregunta guía, contexto, justificación |
| **D. Metodología** | ABP/STEAM/Design Thinking + 5 etapas expandibles |
| **E. Tecnología e IA** | Uso de IA, verificación ética |
| **F. Producto final** | Tipo, descripción, evidencias adjuntas |
| **G. Evaluación** | Instrumentos, criterios, rúbricas |
| **H. Reflexión** | Aprendizajes, dificultades, mejoras, impacto |

#### 📋 Sistema de invitación y distribución
1. El docente crea un proyecto plantilla
2. Hace clic en **📨 Invitar** en la tarjeta del curso
3. Cada estudiante recibe un **mensaje directo** con link de aceptación
4. El estudiante acepta → se crea **su propia copia** del proyecto
5. Cada estudiante edita solo su copia — sin mezclar datos con otros

### 📎 Evidencias
- Subida de fotos, videos, documentos, links y código
- Clasificación por etapa: inicial / intermedia / final
- Reflexión por evidencia (qué aprendí, dificultades, herramientas)
- Vinculación a proyectos específicos

### 📋 Portafolio personal
Portafolio digital estructurado con 8 pestañas:
- **A. Información** — Datos personales del estudiante
- **B. Presentación** — Quién soy, qué espero aprender
- **C. Proyectos** — Todos los proyectos con datos completos sincronizados automáticamente
- **D. Evidencias** — Galería de evidencias subidas
- **E. Reflexiones** — Reflexión detallada por evidencia
- **F. Progreso** — Línea de tiempo inicial → intermedia → final
- **G. Reflexión final** — Síntesis del proceso de aprendizaje
- **➕ Mis secciones** — Secciones personalizadas libres

### 💬 Mensajería interna
- Chat en tiempo real entre usuarios
- **Filtro por curso**: los estudiantes solo ven compañeros del mismo curso + docentes
- Los docentes y admin ven a todos los usuarios
- Detección automática de lenguaje inapropiado (bullying, grooming)
- Bloqueo automático de ambos participantes al detectar mensaje inapropiado
- Panel de moderación para revisar y desbloquear

### 🔔 Notificaciones
- Banners en tiempo real para todos los usuarios
- Tipos: info / advertencia / éxito / error
- Administrable desde panel de notificaciones
- Desaparece automáticamente al desactivarla (Supabase Realtime)
- No se muestra en la página de login

### 📊 Reportes y estadísticas
- Distribución de proyectos por estado
- Usuarios por rol
- Evidencias por tipo
- Proyectos por curso
- Visualización con gráficos interactivos (Recharts)

### 📅 Calendario
- Vista mensual de fechas de proyectos
- Proyectos con fechas de inicio y término

### 🕐 Historial
- Registro de actividades recientes de la plataforma

### 🌐 Portafolio público — Feria Tecnológica
- Vista pública de portafolios para feria escolar
- Acceso sin login para visitantes y apoderados

### 🤖 Asistentes de IA integrados
| Asistente | Descripción |
|-----------|-------------|
| 🤖 **Mira** | Agente de IA multi-propósito con 26 agentes especializados (tutor, investigador, diseñador, evaluador, etc.) |
| 💬 **ProviChat** | Asistente flotante del colegio para consultas rápidas |

### 👑 Panel de administración
- Ver todos los mensajes del sistema
- Moderar conversaciones flaggeadas
- Desbloquear usuarios sancionados
- Estadísticas globales

### ⚙️ Configuración
- **Todos los usuarios**: cambio de su propia contraseña con indicador de fortaleza
- **Solo Admin/Coordinador**: nombre del colegio, repositorio, año activo, URL del logo

---

## 🔐 Sistema de seguridad

- **Row Level Security (RLS)** en Supabase — cada usuario solo puede modificar sus propios datos
- **Middleware de autenticación** — protege todas las rutas, redirige a login si no hay sesión
- **Detección de contenido inapropiado** — trigger PostgreSQL que bloquea automáticamente
- **Protección de cuentas admin** — los admins nunca son bloqueados automáticamente
- **Aislamiento de proyectos** — RLS garantiza que `UPDATE` solo funciona si `owner_id = auth.uid()`
- **API routes protegidas** — verifican rol del usuario en servidor antes de ejecutar

---

## 🗄️ Base de datos (Supabase)

### Tablas principales
| Tabla | Descripción |
|-------|-------------|
| `profiles` | Usuarios con rol, RUT, curso, estado de bloqueo |
| `courses` | Cursos con nombre, año, área |
| `course_members` | Relación estudiante ↔ curso |
| `projects` | Fichas de proyectos con todos los campos pedagógicos |
| `evidences` | Evidencias con archivos, reflexiones y etapa |
| `portfolios` | Portafolio personal anual por estudiante |
| `portfolio_sections` | Secciones personalizadas del portafolio |
| `messages` | Mensajes directos entre usuarios |
| `flagged_messages` | Mensajes detectados como inapropiados |
| `project_invitations` | Invitaciones de proyectos pendientes/aceptadas |
| `notifications` | Banners de notificación global |
| `settings` | Configuración global de la plataforma |
| `comments` | Comentarios en proyectos |

---

## 🚀 Stack tecnológico

```
Frontend:   Next.js 16.1.6 (App Router + Turbopack)
Estilos:    Tailwind CSS
Auth:       Supabase Auth (email/password)
Base datos: Supabase (PostgreSQL + RLS + Realtime)
Deploy:     Vercel (auto-deploy desde GitHub)
Repositorio: GitHub (innova-space-edu/sello-tecnologico)
```

---

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── admin/              # Panel y moderación de admin
│   ├── api/                # API Routes (server-side)
│   │   ├── aceptar-invitacion/
│   │   ├── admin/delete-user/
│   │   ├── admin/reset-password/
│   │   ├── distribuir-proyecto/
│   │   ├── invitar-proyecto/
│   │   └── mira/
│   ├── calendario/
│   ├── configuracion/
│   ├── cursos/
│   ├── dashboard/
│   ├── evidencias/
│   ├── historial/
│   ├── login/
│   ├── mensajes/
│   ├── notificaciones/
│   ├── portafolio/
│   ├── proyectos/
│   │   ├── [id]/editar/    # Edición individual de proyecto
│   │   └── aceptar/        # Aceptar invitación de proyecto
│   ├── reportes/
│   └── usuarios/
├── components/
│   ├── MiraChat.tsx        # Agente IA Mira
│   ├── NotificationBanner.tsx
│   ├── PortfolioSections.tsx
│   ├── ProviChat.tsx       # Chat asistente del colegio
│   └── Sidebar.tsx
├── lib/
│   ├── supabase.ts         # Cliente Supabase (browser)
│   └── supabase-server.ts  # Cliente Supabase (servidor)
└── proxy.ts                # Middleware de autenticación y permisos
```

---

## ⚡ Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://sello-tecnologico.vercel.app
```

---

## 🔧 Desarrollo local

```bash
# Clonar
git clone https://github.com/innova-space-edu/sello-tecnologico

# Instalar dependencias
npm install

# Variables de entorno
cp .env.example .env.local
# Editar .env.local con tus keys de Supabase

# Iniciar en desarrollo
npm run dev
```

---

## 📦 Deploy

El proyecto hace **deploy automático** en Vercel al hacer `git push origin main`.

```bash
git add .
git commit -m "descripción del cambio"
git push origin main
# Vercel detecta el push y despliega automáticamente (~1 min)
```

---

## 👨‍💻 Desarrollado por

**Innova Space Education**  
📧 Contacto: [innova-space-edu](https://github.com/innova-space-edu)  
🌐 Plataforma: [sello-tecnologico.vercel.app](https://sello-tecnologico.vercel.app)

---

<div align="center">
<sub>Colegio Providencia · Sello Tecnológico · 2026</sub>
</div>
