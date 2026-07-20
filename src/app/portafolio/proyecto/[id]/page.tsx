/* eslint-disable @typescript-eslint/no-explicit-any */
import Sidebar from '@/components/Sidebar'
import PrintProjectPortfolioButton from '@/components/PrintProjectPortfolioButton'
import PortfolioValue, { PortfolioAction, PortfolioEmpty, PortfolioField, hasPortfolioContent } from '@/components/portafolio/PortfolioValue'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type SearchParams = Promise<{ estudiante?: string; portafolio?: string }>

const STAFF = ['admin', 'administrador', 'docente', 'coordinador', 'utp']
const SYSTEM_FIELDS = new Set([
  'id', 'owner_id', 'course_id', 'group_id', 'plantilla_id', 'created_at', 'updated_at',
  'courses', 'project_groups', 'profiles',
])

const LABELS: Record<string, string> = {
  title: 'Nombre del proyecto', description: 'Descripción completa', status: 'Estado', year: 'Año', semester: 'Semestre',
  tipo_proyecto: 'Tipo de proyecto', asignaturas: 'Asignaturas', docentes: 'Docentes', roles_equipo: 'Roles del equipo',
  start_date: 'Fecha de inicio', end_date: 'Fecha de término', objetivos_aprendizaje: 'Objetivos de Aprendizaje (OA)',
  habilidades: 'Habilidades', vinculacion_pei: 'Vinculación con el PEI', problema_detectado: 'Problema detectado',
  evidencia_problema: 'Evidencia del problema', pregunta_guia: 'Pregunta guía', preguntas_investigacion: 'Preguntas de investigación',
  contexto_problema: 'Contexto del problema', justificacion: 'Justificación', hipotesis: 'Hipótesis', metodologia: 'Metodología',
  organizacion_trabajo: 'Organización del trabajo', herramientas_tecnologicas: 'Herramientas tecnológicas',
  herramientas_materiales: 'Materiales físicos', uso_ia: 'Uso de inteligencia artificial', estrategia_verificacion: 'Verificación del uso de IA',
  objetivo_general: 'Objetivo general', objetivos_especificos: 'Objetivos específicos', solucion_propuesta: 'Solución propuesta',
  descripcion_boceto: 'Descripción del boceto', boceto_url: 'Boceto', evaluacion: 'Evaluación', autoevaluacion: 'Autoevaluación',
  aprendizajes_logrados: 'Aprendizajes logrados', dificultades: 'Dificultades', mejoras: 'Mejoras',
  impacto_comunidad: 'Impacto en la comunidad', fuentes_consultadas: 'Fuentes consultadas', etapas_metodologia: 'Etapas de la metodología',
  steam_template_slug: 'Plantilla STEAM', steam_route: 'Ruta STEAM', steam_mode: 'Modalidad', steam_level: 'Nivel sugerido',
}

const PROJECT_SECTIONS = [
  { title: '1. Identificación y organización', keys: ['title', 'description', 'status', 'year', 'semester', 'tipo_proyecto', 'asignaturas', 'docentes', 'roles_equipo', 'start_date', 'end_date'] },
  { title: '2. Fundamentación curricular', keys: ['objetivos_aprendizaje', 'habilidades', 'vinculacion_pei'] },
  { title: '3. Problema, investigación y desafío', keys: ['problema_detectado', 'evidencia_problema', 'pregunta_guia', 'preguntas_investigacion', 'contexto_problema', 'justificacion', 'hipotesis'] },
  { title: '4. Metodología, recursos y tecnología', keys: ['metodologia', 'etapas_metodologia', 'organizacion_trabajo', 'herramientas_tecnologicas', 'herramientas_materiales', 'uso_ia', 'estrategia_verificacion'] },
  { title: '5. Objetivos, solución y boceto', keys: ['objetivo_general', 'objetivos_especificos', 'solucion_propuesta', 'descripcion_boceto', 'boceto_url'] },
  { title: '6. Evaluación, aprendizajes e impacto', keys: ['evaluacion', 'autoevaluacion', 'aprendizajes_logrados', 'dificultades', 'mejoras', 'impacto_comunidad', 'fuentes_consultadas'] },
  { title: '7. Configuración STEAM', keys: ['steam_template_slug', 'steam_route', 'steam_mode', 'steam_level'] },
]

function humanize(key: string) {
  return LABELS[key] ?? key.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())
}

const TONES = {
  violet: 'from-violet-600 to-fuchsia-500 bg-violet-50 text-violet-700',
  blue: 'from-blue-600 to-cyan-500 bg-blue-50 text-blue-700',
  emerald: 'from-emerald-600 to-teal-500 bg-emerald-50 text-emerald-700',
  amber: 'from-amber-500 to-orange-500 bg-amber-50 text-amber-700',
  rose: 'from-rose-600 to-pink-500 bg-rose-50 text-rose-700',
} as const

function Section({ id, icon, eyebrow, title, count, tone = 'violet', children }: { id: string; icon: string; eyebrow: string; title: string; count?: number; tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-28 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_-35px_rgba(15,23,42,0.35)] print:break-inside-avoid"><div className={`h-1.5 bg-gradient-to-r ${TONES[tone].split(' ').slice(0, 2).join(' ')}`} /><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7"><div className="flex gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${TONES[tone].split(' ').slice(2).join(' ')}`}>{icon}</span><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p><h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">{title}</h2></div></div>{count !== undefined && <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{count}</span>}</div><div className="space-y-5 p-5 sm:p-7">{children}</div></section>
}

function dateLabel(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function ProjectPortfolioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id: projectId } = await params
  const query = await searchParams
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')

  const admin = createAdminSupabaseClient()
  const targetUserId = query.estudiante || actor.id
  const isStaff = STAFF.includes(actor.role)
  if (!isStaff && targetUserId !== actor.id) redirect('/portafolio')

  const [{ data: project }, { data: targetProfile }, { data: collaboration }] = await Promise.all([
    admin.from('projects').select('*, courses(name), project_groups(id, group_name)').eq('id', projectId).single(),
    admin.from('profiles').select('id, full_name, email, curso, rut').eq('id', targetUserId).single(),
    admin.from('project_collaborators').select('id').eq('project_id', projectId).eq('user_id', targetUserId).eq('status', 'accepted').maybeSingle(),
  ])
  if (!project || !targetProfile) redirect('/portafolio')

  const { data: reportMembership } = await admin.from('project_report_members').select('id, project_reports!inner(project_id)').eq('user_id', targetUserId).eq('project_reports.project_id', projectId).limit(1).maybeSingle()
  const belongsToProject = project.owner_id === targetUserId || !!collaboration || !!reportMembership
  if (!belongsToProject && !isStaff) redirect('/portafolio')

  const [{ data: evidences }, { data: participantRows }, { data: surveyResponses }, { data: selfEvaluations }, { data: publicPages }, { data: report }, { data: workspace }] = await Promise.all([
    admin.from('evidences').select('*, profiles(full_name, email)').eq('project_id', projectId).order('created_at'),
    admin.from('followup_participants').select('followup_id').eq('user_id', targetUserId),
    admin.from('survey_responses').select('*, surveys(*, survey_questions(*)), survey_answers(*)').eq('project_id', projectId).eq('registered_user_id', targetUserId).order('created_at'),
    admin.from('self_evaluations').select('*, self_evaluation_formats(title, questions)').eq('project_id', projectId).eq('user_id', targetUserId).order('created_at'),
    admin.from('project_public_pages').select('*, project_public_blocks(*), project_public_assets(*)').eq('project_id', projectId).order('created_at'),
    admin.from('project_reports').select('*').eq('project_id', projectId).maybeSingle(),
    admin.from('steam_project_workspaces').select('*, steam_phase_entries(*), steam_journal_entries(*), steam_prototype_versions(*), steam_project_tests(*)').eq('project_id', projectId).maybeSingle(),
  ])

  const participantIds = [...new Set((participantRows ?? []).map(row => row.followup_id))]
  const { data: followups } = participantIds.length
    ? await admin.from('project_followups').select('*, teacher:profiles!project_followups_teacher_id_fkey(full_name, email), followup_items(*), followup_photos(*), followup_participants(*, profiles(full_name, email))').eq('project_id', projectId).in('id', participantIds).order('followup_date')
    : { data: [] as any[] }

  let reportSections: any[] = [], reportMembers: any[] = [], reportComments: any[] = [], reportEvaluation: any = null
  if (report) {
    const [sectionsResult, membersResult, commentsResult, evaluationResult] = await Promise.all([
      admin.from('project_report_sections').select('*').eq('report_id', report.id).order('sort_order'),
      admin.from('project_report_members').select('*, profiles(full_name, email)').eq('report_id', report.id),
      admin.from('project_report_comments').select('*, profiles(full_name, role)').eq('report_id', report.id).order('created_at'),
      admin.from('project_report_evaluations').select('*, project_report_rubrics(*, project_report_rubric_criteria(*)), project_report_scores(*, project_report_rubric_criteria(*))').eq('report_id', report.id).maybeSingle(),
    ])
    reportSections = sectionsResult.data ?? []
    reportMembers = membersResult.data ?? []
    reportComments = commentsResult.data ?? []
    reportEvaluation = evaluationResult.data
  }

  const usedProjectKeys = new Set(PROJECT_SECTIONS.flatMap(section => section.keys))
  const extraProjectFields = Object.entries(project).filter(([key, value]) => !SYSTEM_FIELDS.has(key) && !usedProjectKeys.has(key) && hasPortfolioContent(value))
  const moduleCounts = [workspace ? 1 : 0, evidences?.length ?? 0, followups?.length ?? 0, surveyResponses?.length ?? 0, selfEvaluations?.length ?? 0, publicPages?.length ?? 0, report ? 1 : 0]
  const completedModules = moduleCounts.filter(count => count > 0).length + 1
  const progress = Math.round((completedModules / 8) * 100)
  const navItems = [
    ['formulario', '📝', 'Plantilla'], ['steam', '🚀', 'Ruta STEAM'], ['evidencias', '📎', 'Evidencias'],
    ['seguimientos', '📈', 'Seguimiento'], ['encuestas', '🗳️', 'Encuestas'], ['autoevaluacion', '🪞', 'Autoevaluación'],
    ['pagina', '🌐', 'Página web'], ['informe', '📄', 'Informe'],
  ]

  return <div className="flex min-h-screen bg-[#f5f6fb] print:block print:bg-white">
    <div className="print:hidden"><Sidebar /></div>
    <main className="min-w-0 flex-1 px-3 pb-14 pt-16 sm:px-5 lg:px-8 lg:pt-7 print:m-0 print:p-0">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <Link href={query.portafolio ? `/portafolio/${query.portafolio}` : '/portafolio'} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-violet-700">← Volver al portafolio</Link>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">Actualización automática</span>
        </div>

        <header className="relative overflow-hidden rounded-[32px] border border-violet-100 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-sky-100 px-6 py-7 text-slate-900 shadow-xl shadow-violet-100/70 sm:px-9 sm:py-9 print:rounded-none print:bg-white">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-fuchsia-300/40 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-200/50 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-700 ring-1 ring-violet-200">Portafolio vivo</span><span className="rounded-full bg-emerald-100/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-200">{project.status ?? 'En construcción'}</span></div>
              <h1 className="mt-5 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{project.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">Una historia completa del proceso: desde la idea inicial hasta el resultado, la evaluación y las mejoras.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-600"><span className="rounded-full bg-white/80 px-3 py-2 ring-1 ring-white">👤 {targetProfile.full_name ?? targetProfile.email}</span><span className="rounded-full bg-white/80 px-3 py-2 ring-1 ring-white">🎓 {targetProfile.curso ?? project.courses?.name ?? 'Sin curso'}</span>{project.tipo_proyecto && <span className="rounded-full bg-white/80 px-3 py-2 ring-1 ring-white">✨ {project.tipo_proyecto}</span>}</div>
            </div>
            <PrintProjectPortfolioButton />
          </div>
          <div className="relative mt-8 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white"><p className="text-3xl font-black text-violet-700">{progress}%</p><p className="mt-1 text-xs text-slate-500">Portafolio reunido</p></div>
            <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white"><p className="text-3xl font-black text-blue-700">{completedModules}/8</p><p className="mt-1 text-xs text-slate-500">Módulos con contenido</p></div>
            <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white"><p className="text-3xl font-black text-emerald-700">{evidences?.length ?? 0}</p><p className="mt-1 text-xs text-slate-500">Evidencias registradas</p></div>
            <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white"><p className="text-3xl font-black text-fuchsia-700">{followups?.length ?? 0}</p><p className="mt-1 text-xs text-slate-500">Hitos de seguimiento</p></div>
          </div>
          <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400" style={{ width: `${progress}%` }} /></div>
        </header>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="sticky top-5 hidden rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200 xl:block print:hidden">
            <p className="px-3 pb-2 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Recorrido del proyecto</p>
            <nav className="space-y-1">{navItems.map(([anchor, icon, label], index) => <a key={anchor} href={`#${anchor}`} className="group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-white">{icon}</span><span className="flex-1">{label}</span><span className="text-[10px] text-slate-300">{String(index + 1).padStart(2, '0')}</span></a>)}</nav>
          </aside>

          <div className="min-w-0 space-y-6">
            <nav className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 xl:hidden print:hidden">{navItems.map(([anchor, icon, label]) => <a key={anchor} href={`#${anchor}`} className="whitespace-nowrap rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">{icon} {label}</a>)}</nav>

            <Section id="formulario" icon="📝" eyebrow="Capítulo 01" title="Idea y planificación inicial" tone="violet">
              <p className="max-w-3xl text-sm leading-6 text-slate-500">Aquí está la plantilla completa que dio origen al proyecto. Los apartados vacíos se ocultan para que la lectura sea clara.</p>
              <div className="space-y-4">{PROJECT_SECTIONS.map((section, sectionIndex) => {
                const fields = section.keys.filter(key => hasPortfolioContent(project[key]))
                if (!fields.length) return null
                return <details open key={section.title} className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60"><summary className="cursor-pointer list-none px-5 py-4 font-black text-slate-800 marker:hidden"><span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs text-violet-700 shadow-sm">{sectionIndex + 1}</span>{section.title.replace(/^\d+\.\s*/, '')}<span className="float-right text-slate-300 group-open:rotate-180">⌄</span></summary><div className="grid gap-3 border-t border-slate-200 bg-white p-4 md:grid-cols-2">{fields.map(key => <PortfolioField key={key} label={humanize(key)} value={project[key]} accent={sectionIndex % 2 ? 'blue' : 'violet'} />)}</div></details>
              })}</div>
              {extraProjectFields.length > 0 && <details className="rounded-2xl border border-slate-200"><summary className="cursor-pointer px-5 py-4 font-black text-slate-700">Otros datos registrados</summary><div className="grid gap-3 border-t p-4 md:grid-cols-2">{extraProjectFields.map(([key, value]) => <PortfolioField key={key} label={humanize(key)} value={value} />)}</div></details>}
            </Section>

            <Section id="steam" icon="🚀" eyebrow="Capítulo 02" title="Ruta STEAM, prototipos y pruebas" count={workspace ? 1 : 0} tone="blue">
              {!workspace ? <PortfolioEmpty icon="🚀" title="Ruta STEAM aún no iniciada" description="Cuando el equipo comience una ruta guiada, sus fases, bitácora, prototipos y pruebas aparecerán aquí." /> : <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><PortfolioField label="Plantilla" value={workspace.template_slug} accent="blue" /><PortfolioField label="Ruta" value={workspace.route_type} accent="blue" /><PortfolioField label="Fase actual" value={workspace.current_phase} accent="blue" /><PortfolioField label="Progreso" value={`${workspace.progress_percent ?? 0}%`} accent="blue" /></div>
                <div className="space-y-3">{(workspace.steam_phase_entries ?? []).sort((a:any,b:any)=>a.phase_number-b.phase_number).map((phase:any) => <details open={phase.status === 'completed' || phase.status === 'in_progress'} key={phase.id} className="overflow-hidden rounded-2xl border border-blue-100"><summary className="cursor-pointer bg-blue-50 px-5 py-4 font-black text-blue-950"><span className="mr-3 rounded-full bg-blue-600 px-2.5 py-1 text-xs text-white">Fase {phase.phase_number}</span>{humanize(phase.phase_key)} <span className="float-right text-xs font-bold text-blue-500">{humanize(phase.status ?? 'pendiente')}</span></summary><div className="grid gap-3 p-4"><PortfolioField label="Trabajo realizado" value={phase.content} accent="blue" /><PortfolioField label="Reflexión del estudiante" value={phase.student_reflection} accent="emerald" /><PortfolioField label="Retroalimentación docente" value={phase.teacher_feedback} accent="amber" /></div></details>)}</div>
                <div className="grid gap-4 lg:grid-cols-3"><PortfolioField label="Bitácora del equipo" value={workspace.steam_journal_entries} accent="blue" /><PortfolioField label="Versiones del prototipo" value={workspace.steam_prototype_versions} accent="violet" /><PortfolioField label="Pruebas realizadas" value={workspace.steam_project_tests} accent="emerald" /></div>
              </>}
            </Section>

            <Section id="evidencias" icon="📎" eyebrow="Capítulo 03" title="Galería de evidencias y aprendizajes" count={evidences?.length ?? 0} tone="emerald">
              {!evidences?.length ? <PortfolioEmpty icon="📎" title="Todavía no hay evidencias" description="Las fotografías, videos, documentos, enlaces y reflexiones del proyecto se reunirán automáticamente aquí." /> : <div className="grid gap-4 lg:grid-cols-2">{evidences.map((ev:any) => <article key={ev.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-start justify-between gap-3 bg-gradient-to-br from-emerald-50 to-cyan-50 p-5"><div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 shadow-sm">{ev.evidencia_tipo ?? ev.type ?? 'Evidencia'}</span><h3 className="mt-3 text-lg font-black text-slate-900">{ev.title}</h3><p className="mt-1 text-xs text-slate-500">{dateLabel(ev.created_at)} · {ev.profiles?.full_name ?? 'Autor no indicado'}</p></div><PortfolioAction href={`/evidencias/${ev.id}`}>Abrir →</PortfolioAction></div><div className="space-y-3 p-5"><PortfolioValue value={ev.file_url ?? ev.drive_url} emptyLabel="Sin archivo adjunto" /><PortfolioField label="Descripción" value={ev.description} accent="emerald" /><PortfolioField label="Lo que aprendí" value={ev.reflexion_aprendizaje} accent="emerald" /><PortfolioField label="Dificultad y solución" value={[ev.dificultad, ev.como_resolvi].filter(Boolean)} accent="amber" /></div></article>)}</div>}
            </Section>

            <Section id="seguimientos" icon="📈" eyebrow="Capítulo 04" title="Seguimiento, acuerdos y retroalimentación" count={followups?.length ?? 0} tone="amber">
              {!followups?.length ? <PortfolioEmpty icon="📈" title="Sin seguimientos vinculados" description="Las reuniones, criterios, fotografías y comentarios docentes aparecerán como una línea de progreso." /> : <div className="relative space-y-4 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-0.5 before:bg-amber-100">{followups.map((follow:any, index:number) => <article key={follow.id} className="relative ml-10 rounded-3xl border border-amber-100 bg-amber-50/40 p-5"><span className="absolute -left-[34px] top-5 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white ring-4 ring-[#f5f6fb]">{index + 1}</span><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{follow.subject ?? 'Sesión de seguimiento'}</h3><p className="mt-1 text-xs text-slate-500">{dateLabel(follow.followup_date)} · Docente: {follow.teacher?.full_name ?? 'No indicado'}</p></div><PortfolioAction href={`/seguimientos/${follow.id}`}>Ver seguimiento →</PortfolioAction></div><div className="mt-4 grid gap-3 md:grid-cols-2"><PortfolioField label="Observaciones" value={follow.observations} accent="amber" /><PortfolioField label="Retroalimentación" value={follow.feedback} accent="amber" /><PortfolioField label="Compromisos" value={follow.ticket} accent="violet" /><PortfolioField label="Criterios evaluados" value={follow.followup_items} accent="blue" /><PortfolioField label="Participantes" value={(follow.followup_participants ?? []).map((p:any)=>p.profiles?.full_name).filter(Boolean)} accent="emerald" /><PortfolioField label="Evidencias fotográficas" value={follow.followup_photos} accent="rose" /></div></article>)}</div>}
            </Section>

            <Section id="encuestas" icon="🗳️" eyebrow="Capítulo 05" title="Encuestas y respuestas" count={surveyResponses?.length ?? 0} tone="rose">
              {!surveyResponses?.length ? <PortfolioEmpty icon="🗳️" title="Sin encuestas respondidas" description="Las respuestas vinculadas a este proyecto se presentarán pregunta por pregunta, sin datos técnicos." /> : <div className="space-y-4">{surveyResponses.map((response:any) => { const survey = Array.isArray(response.surveys) ? response.surveys[0] : response.surveys; const questions = survey?.survey_questions ?? []; const questionMap = new Map(questions.map((q:any)=>[q.id,q])); return <article key={response.id} className="rounded-3xl border border-rose-100 bg-gradient-to-br from-white to-rose-50/50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-lg font-black text-slate-900">{survey?.title ?? 'Encuesta'}</h3><p className="mt-1 max-w-2xl text-sm text-slate-500">{survey?.description}</p></div>{response.achievement_percent != null && <div className="rounded-2xl bg-rose-600 px-4 py-3 text-center text-white"><p className="text-2xl font-black">{response.achievement_percent}%</p><p className="text-[10px] uppercase tracking-wide">Logro</p></div>}</div><div className="mt-4 grid gap-3 md:grid-cols-2">{(response.survey_answers ?? []).map((answer:any) => <div key={answer.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-rose-100"><p className="text-sm font-black text-slate-700">{(questionMap.get(answer.question_id) as any)?.prompt ?? 'Pregunta'}</p><div className="mt-2"><PortfolioValue value={answer?.value_json ?? answer?.value_number ?? answer?.value_text} /></div></div>)}</div><div className="mt-4"><PortfolioField label="Retroalimentación docente" value={response.feedback} accent="rose" /></div></article> })}</div>}
            </Section>

            <Section id="autoevaluacion" icon="🪞" eyebrow="Capítulo 06" title="Autoevaluación y reflexión personal" count={selfEvaluations?.length ?? 0} tone="violet">
              {!selfEvaluations?.length ? <PortfolioEmpty icon="🪞" title="Sin autoevaluaciones vinculadas" description="Cuando el estudiante reflexione sobre su participación, sus respuestas completas aparecerán aquí." /> : <div className="space-y-4">{selfEvaluations.map((evaluation:any) => { const format = Array.isArray(evaluation.self_evaluation_formats) ? evaluation.self_evaluation_formats[0] : evaluation.self_evaluation_formats; const questions = Array.isArray(format?.questions) ? format.questions : []; const answers = evaluation.answers ?? {}; return <article key={evaluation.id} className="rounded-3xl border border-violet-100 bg-violet-50/30 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900">{format?.title ?? 'Autoevaluación'}</h3><p className="mt-1 text-xs text-slate-500">{dateLabel(evaluation.created_at)} · {evaluation.status}</p></div><PortfolioAction href={`/autoevaluacion/respuestas/${evaluation.id}`}>Abrir original →</PortfolioAction></div><div className="mt-4 grid gap-3 md:grid-cols-2">{questions.length ? questions.map((question:any) => <PortfolioField key={question.id} label={question.prompt} value={answers[question.id]} accent="violet" />) : Object.entries(answers).map(([key,value]) => <PortfolioField key={key} label={humanize(key)} value={value} accent="violet" />)}</div></article>})}</div>}
            </Section>

            <Section id="pagina" icon="🌐" eyebrow="Capítulo 07" title="Página web y publicación del proyecto" count={publicPages?.length ?? 0} tone="blue">
              {!publicPages?.length ? <PortfolioEmpty icon="🌐" title="Página pública aún no creada" description="Cuando el equipo publique su proyecto, aquí se verá su portada, contenido, recursos y acceso directo." /> : <div className="grid gap-4 lg:grid-cols-2">{publicPages.map((page:any) => <article key={page.id} className="overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-100 via-white to-cyan-100 text-slate-900"><div className="relative p-6"><div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-cyan-300/35 blur-2xl" /><p className="relative text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">{page.is_public ? 'Publicada' : 'Borrador privado'}</p><h3 className="relative mt-2 text-2xl font-black">{page.title}</h3><p className="relative mt-2 text-sm leading-6 text-slate-600">{page.description}</p>{page.slug && <div className="relative mt-5"><PortfolioAction href={`/p/${page.slug}`}>Visitar página →</PortfolioAction></div>}</div><div className="space-y-3 border-t border-sky-100 bg-white/80 p-5 text-slate-800"><PortfolioField label="Contenido publicado" value={(page.project_public_blocks ?? []).sort((a:any,b:any)=>a.sort_order-b.sort_order)} accent="blue" /><PortfolioField label="Archivos y recursos" value={page.project_public_assets} accent="emerald" /></div></article>)}</div>}
            </Section>

            <Section id="informe" icon="📄" eyebrow="Capítulo 08" title="Informe final, comentarios y evaluación" count={report ? 1 : 0} tone="emerald">
              {!report ? <PortfolioEmpty icon="📄" title="Informe final aún no creado" description="El informe colaborativo y su evaluación aparecerán aquí sin necesidad de buscarlo en otro módulo." /> : <>
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-100 via-teal-50 to-cyan-100 p-6 text-slate-900"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Documento final · {humanize(report.status ?? 'borrador')}</p><h3 className="mt-2 text-2xl font-black">{report.title}</h3><p className="mt-1 text-xs text-emerald-700">Actualizado {dateLabel(report.updated_at)}</p></div><PortfolioAction href={`/informes/${report.id}`}>Abrir informe →</PortfolioAction></div>
                <PortfolioField label="Equipo del informe" value={reportMembers.map(member => ({ nombre: member.profiles?.full_name ?? member.profiles?.email, rol: humanize(member.member_role) }))} accent="emerald" />
                <div className="grid gap-4 lg:grid-cols-2">{reportSections.map((section, index) => <article key={section.id} className={`rounded-3xl border p-5 ${hasPortfolioContent(section.content) ? 'border-slate-200 bg-white shadow-sm' : 'border-dashed border-slate-200 bg-slate-50/60'}`}><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-700">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0"><h4 className="font-black text-slate-900">{section.title}</h4><div className="mt-3"><PortfolioValue value={section.content} emptyLabel="Pendiente por completar" /></div></div></div></article>)}</div>
                <PortfolioField label="Comentarios y retroalimentación" value={reportComments.map(comment => ({ autor: comment.profiles?.full_name, comentario: comment.body, estado: humanize(comment.status ?? ''), fecha: dateLabel(comment.created_at) }))} accent="amber" />
                {reportEvaluation && <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-cyan-50 p-5 ring-1 ring-emerald-100"><div className="flex items-center gap-3"><span className="text-3xl">🏅</span><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Evaluación final</p><h4 className="text-xl font-black text-emerald-950">Resultados y retroalimentación</h4></div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><PortfolioField label="Puntaje obtenido" value={`${reportEvaluation.earned_points ?? 0} / ${reportEvaluation.total_points ?? 0}`} accent="emerald" /><PortfolioField label="Nota final" value={reportEvaluation.final_grade} accent="emerald" /><PortfolioField label="Retroalimentación general" value={reportEvaluation.general_feedback} accent="blue" /><PortfolioField label="Rúbrica y criterios" value={reportEvaluation.project_report_scores} accent="violet" /></div></div>}
              </>}
            </Section>

            <footer className="rounded-3xl border border-violet-100 bg-gradient-to-r from-violet-100 via-fuchsia-50 to-sky-100 px-6 py-7 text-center text-sm text-slate-600"><p className="font-black text-slate-900">Un portafolio que crece con el proyecto</p><p className="mt-1">Cada formulario, evidencia y evaluación nueva se integra automáticamente en este recorrido.</p></footer>
          </div>
        </div>
      </div>
    </main>
  </div>
}
