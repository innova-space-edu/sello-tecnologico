import Sidebar from '@/components/Sidebar'
import PrintProjectPortfolioButton from '@/components/PrintProjectPortfolioButton'
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

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
}

function humanize(key: string) {
  return LABELS[key] ?? key.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())
}

function DisplayValue({ value }: { value: unknown }) {
  if (isEmpty(value)) return <span className="text-gray-400">Sin información</span>
  if (typeof value === 'boolean') return <span>{value ? 'Sí' : 'No'}</span>
  if (Array.isArray(value)) return <div className="flex flex-wrap gap-1.5">{value.map((item, index) => <span key={index} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{typeof item === 'object' ? JSON.stringify(item) : String(item)}</span>)}</div>
  if (typeof value === 'object') return <pre className="overflow-x-auto whitespace-pre-wrap font-sans text-sm">{JSON.stringify(value, null, 2)}</pre>
  const text = String(value)
  if (/^https?:\/\//.test(text)) return <a className="break-all text-blue-600 underline" href={text} target="_blank" rel="noreferrer">{text}</a>
  return <p className="whitespace-pre-wrap break-words">{text}</p>
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (isEmpty(value)) return null
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p><div className="text-sm leading-relaxed text-gray-700"><DisplayValue value={value} /></div></div>
}

function Section({ id, icon, title, count, children }: { id: string; icon: string; title: string; count?: number; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-24 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 print:break-inside-avoid"><div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 lg:px-6"><h2 className="font-bold text-blue-950">{icon} {title}</h2>{count !== undefined && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{count}</span>}</div><div className="space-y-4 p-5 lg:p-6">{children}</div></section>
}

function AnswerValue({ answer }: { answer: any }) {
  const value = answer?.value_json ?? answer?.value_number ?? answer?.value_text
  return <DisplayValue value={value} />
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
  const extraProjectFields = Object.entries(project).filter(([key, value]) => !SYSTEM_FIELDS.has(key) && !usedProjectKeys.has(key) && !isEmpty(value))
  const moduleCounts = [evidences?.length ?? 0, followups?.length ?? 0, surveyResponses?.length ?? 0, selfEvaluations?.length ?? 0, publicPages?.length ?? 0, report ? 1 : 0]
  const completedModules = moduleCounts.filter(count => count > 0).length + 1

  return <div className="flex min-h-screen bg-gray-50 print:block print:bg-white"><div className="print:hidden"><Sidebar /></div><main className="min-w-0 flex-1 p-4 pt-16 lg:ml-64 lg:p-8 lg:pt-8 print:m-0 print:p-0">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="print:hidden"><Link href={query.portafolio ? `/portafolio/${query.portafolio}` : '/portafolio'} className="text-sm text-blue-600 hover:underline">← Volver al portafolio</Link></div>
      <header className="rounded-2xl bg-gradient-to-r from-blue-950 via-blue-800 to-indigo-700 p-6 text-white print:bg-blue-900">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Expediente automático completo</p><h1 className="mt-2 text-2xl font-bold lg:text-3xl">{project.title}</h1><p className="mt-2 text-sm text-blue-100">{targetProfile.full_name ?? targetProfile.email} · {targetProfile.curso ?? project.courses?.name ?? 'Sin curso'}</p></div><PrintProjectPortfolioButton /></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-bold">{completedModules}/7</p><p className="text-xs text-blue-100">Módulos reunidos</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-bold">{evidences?.length ?? 0}</p><p className="text-xs text-blue-100">Evidencias</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-bold">{followups?.length ?? 0}</p><p className="text-xs text-blue-100">Seguimientos</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-bold">{project.status ?? '—'}</p><p className="text-xs text-blue-100">Estado actual</p></div></div>
      </header>

      <nav className="print:hidden flex gap-2 overflow-x-auto rounded-xl bg-white p-3 text-xs font-semibold shadow-sm">{[['formulario','Plantilla'],['steam','Ruta STEAM'],['evidencias','Evidencias'],['seguimientos','Seguimiento'],['encuestas','Encuestas'],['autoevaluacion','Autoevaluación'],['pagina','Página web'],['informe','Informe']].map(([anchor, label]) => <a key={anchor} href={`#${anchor}`} className="whitespace-nowrap rounded-lg bg-gray-50 px-3 py-2 text-blue-700 hover:bg-blue-50">{label}</a>)}</nav>

      <Section id="formulario" icon="📝" title="Plantilla inicial completa">
        <p className="text-sm text-gray-500">Se muestra todo el formulario guardado, sin resumir ni recortar respuestas.</p>
        {PROJECT_SECTIONS.map(section => {
          const fields = section.keys.filter(key => !isEmpty(project[key]))
          if (!fields.length) return null
          return <details open key={section.title} className="rounded-xl border border-gray-200 p-4"><summary className="cursor-pointer font-bold text-blue-900">{section.title}</summary><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{fields.map(key => <Field key={key} label={humanize(key)} value={project[key]} />)}</div></details>
        })}
        {extraProjectFields.length > 0 && <details open className="rounded-xl border border-gray-200 p-4"><summary className="cursor-pointer font-bold text-blue-900">8. Otros datos registrados</summary><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{extraProjectFields.map(([key, value]) => <Field key={key} label={humanize(key)} value={value} />)}</div></details>}
      </Section>

      <Section id="steam" icon="🚀" title="Ruta, fases y prototipos STEAM" count={workspace ? 1 : 0}>
        {!workspace ? <p className="text-sm text-gray-400">Este proyecto no utiliza una ruta guiada STEAM.</p> : <><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Field label="Plantilla" value={workspace.template_slug} /><Field label="Ruta" value={workspace.route_type} /><Field label="Fase actual" value={workspace.current_phase} /><Field label="Progreso" value={`${workspace.progress_percent}%`} /></div><div className="space-y-3">{(workspace.steam_phase_entries ?? []).sort((a:any,b:any)=>a.phase_number-b.phase_number).map((phase:any) => <details open key={phase.id} className="rounded-xl border p-4"><summary className="font-bold text-blue-900">Fase {phase.phase_number}: {phase.phase_key} · {phase.status}</summary><div className="mt-3 grid gap-3"><Field label="Formulario completo" value={phase.content} /><Field label="Reflexión del estudiante" value={phase.student_reflection} /><Field label="Retroalimentación docente" value={phase.teacher_feedback} /></div></details>)}</div><Field label="Bitácora completa" value={workspace.steam_journal_entries} /><Field label="Versiones de prototipo" value={workspace.steam_prototype_versions} /><Field label="Pruebas realizadas" value={workspace.steam_project_tests} /></>}
      </Section>

      <Section id="evidencias" icon="📎" title="Evidencias y reflexiones" count={evidences?.length ?? 0}>
        {!evidences?.length ? <p className="text-sm text-gray-400">Sin evidencias.</p> : evidences.map((ev:any) => <article key={ev.id} className="rounded-xl border border-gray-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold text-gray-800">{ev.title}</h3><p className="text-xs text-gray-400">{ev.evidencia_tipo ?? ev.type ?? 'Evidencia'} · {new Date(ev.created_at).toLocaleString('es-CL')} · {ev.profiles?.full_name ?? 'Autor no indicado'}</p></div><Link href={`/evidencias/${ev.id}`} className="print:hidden text-sm font-semibold text-blue-600">Abrir original →</Link></div><div className="mt-3 grid gap-3 md:grid-cols-2">{Object.entries(ev).filter(([key,value]) => !['id','project_id','created_by','profiles','created_at','updated_at'].includes(key) && !isEmpty(value)).map(([key,value]) => <Field key={key} label={humanize(key)} value={value} />)}</div></article>)}
      </Section>

      <Section id="seguimientos" icon="📈" title="Seguimiento del proyecto" count={followups?.length ?? 0}>
        {!followups?.length ? <p className="text-sm text-gray-400">Sin seguimientos asociados a este estudiante.</p> : followups.map((follow:any) => <article key={follow.id} className="rounded-xl border border-gray-200 p-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold text-gray-800">{follow.subject ?? 'Sesión de seguimiento'}</h3><p className="text-xs text-gray-400">{follow.followup_date} · {follow.overall_status ?? 'Sin estado'} · Docente: {follow.teacher?.full_name ?? '—'}</p></div><Link href={`/seguimientos/${follow.id}`} className="print:hidden text-sm font-semibold text-blue-600">Abrir original →</Link></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Observaciones" value={follow.observations} /><Field label="Retroalimentación" value={follow.feedback} /><Field label="Puntaje global" value={follow.score} /><Field label="Compromiso o ticket" value={follow.ticket} /></div><Field label="Criterios evaluados" value={follow.followup_items} /><Field label="Participantes" value={(follow.followup_participants ?? []).map((p:any)=>p.profiles?.full_name ?? p.user_id)} /><Field label="Evidencias fotográficas" value={follow.followup_photos} /></article>)}
      </Section>

      <Section id="encuestas" icon="🗳️" title="Encuestas y respuestas personales" count={surveyResponses?.length ?? 0}>
        {!surveyResponses?.length ? <p className="text-sm text-gray-400">Sin respuestas de encuesta vinculadas.</p> : surveyResponses.map((response:any) => { const survey = Array.isArray(response.surveys) ? response.surveys[0] : response.surveys; const questions = survey?.survey_questions ?? []; const questionMap = new Map(questions.map((q:any)=>[q.id,q])); return <article key={response.id} className="rounded-xl border border-gray-200 p-4"><h3 className="font-bold text-gray-800">{survey?.title ?? 'Encuesta'}</h3><p className="mt-1 text-sm text-gray-500">{survey?.description}</p><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4"><Field label="Puntaje" value={response.earned_points} /><Field label="Máximo" value={response.max_points} /><Field label="Logro" value={response.achievement_percent == null ? null : `${response.achievement_percent}%`} /><Field label="Nota" value={response.grade} /></div><Field label="Retroalimentación docente" value={response.feedback} /><div className="mt-3 space-y-2">{(response.survey_answers ?? []).map((answer:any) => <div key={answer.id} className="rounded-lg bg-gray-50 p-3"><p className="text-sm font-semibold text-gray-700">{(questionMap.get(answer.question_id) as any)?.prompt ?? 'Pregunta'}</p><div className="mt-1 text-sm text-gray-600"><AnswerValue answer={answer} /></div></div>)}</div></article> })}
      </Section>

      <Section id="autoevaluacion" icon="🪞" title="Autoevaluación completa" count={selfEvaluations?.length ?? 0}>
        {!selfEvaluations?.length ? <p className="text-sm text-gray-400">Sin autoevaluaciones vinculadas.</p> : selfEvaluations.map((evaluation:any) => { const format = Array.isArray(evaluation.self_evaluation_formats) ? evaluation.self_evaluation_formats[0] : evaluation.self_evaluation_formats; const questions = Array.isArray(format?.questions) ? format.questions : []; const answers = evaluation.answers ?? {}; return <article key={evaluation.id} className="rounded-xl border border-gray-200 p-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold text-gray-800">{format?.title ?? 'Autoevaluación'}</h3><p className="text-xs text-gray-400">{new Date(evaluation.created_at).toLocaleString('es-CL')} · {evaluation.status}</p></div><Link href={`/autoevaluacion/respuestas/${evaluation.id}`} className="print:hidden text-sm font-semibold text-blue-600">Abrir original →</Link></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Proyecto declarado" value={evaluation.project_name} /><Field label="Lugar o contexto" value={evaluation.intervention_place} /></div><div className="mt-3 space-y-2">{questions.length ? questions.map((question:any) => <div key={question.id} className="rounded-lg bg-gray-50 p-3"><p className="text-sm font-semibold text-gray-700">{question.prompt}</p><div className="mt-1 text-sm text-gray-600"><DisplayValue value={answers[question.id]} /></div></div>) : Object.entries(answers).map(([key,value]) => <Field key={key} label={humanize(key)} value={value} />)}</div></article>})}
      </Section>

      <Section id="pagina" icon="🌐" title="Página web del proyecto" count={publicPages?.length ?? 0}>
        {!publicPages?.length ? <p className="text-sm text-gray-400">Sin página web vinculada.</p> : publicPages.map((page:any) => <article key={page.id} className="rounded-xl border border-gray-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold text-gray-800">{page.title}</h3><p className="text-sm text-gray-500">{page.description}</p><p className="mt-1 text-xs text-gray-400">Estado: {page.status} · {page.is_public ? 'Pública' : 'Privada'}</p></div>{page.slug && <Link href={`/p/${page.slug}`} className="print:hidden text-sm font-semibold text-blue-600">Ver página →</Link>}</div><Field label="Bloques completos" value={(page.project_public_blocks ?? []).sort((a:any,b:any)=>a.sort_order-b.sort_order)} /><Field label="Archivos y recursos" value={page.project_public_assets} /></article>)}
      </Section>

      <Section id="informe" icon="📄" title="Informe final, comentarios y evaluación" count={report ? 1 : 0}>
        {!report ? <p className="text-sm text-gray-400">Sin informe final vinculado.</p> : <><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold text-gray-800">{report.title}</h3><p className="text-xs text-gray-400">Estado: {report.status} · Actualizado: {new Date(report.updated_at).toLocaleString('es-CL')}</p></div><Link href={`/informes/${report.id}`} className="print:hidden text-sm font-semibold text-blue-600">Abrir informe →</Link></div><Field label="Integrantes" value={reportMembers.map(member => ({ nombre: member.profiles?.full_name ?? member.profiles?.email, rol: member.member_role }))} /><div className="space-y-3">{reportSections.map(section => <article key={section.id} className="rounded-xl bg-gray-50 p-4"><h4 className="font-bold text-blue-900">{section.title}</h4><div className="mt-2"><DisplayValue value={section.content} /></div></article>)}</div><Field label="Comentarios y retroalimentación por sección" value={reportComments.map(comment => ({ autor: comment.profiles?.full_name, comentario: comment.body, estado: comment.status, fecha: comment.created_at }))} />{reportEvaluation && <div className="rounded-xl border border-green-200 bg-green-50 p-4"><h4 className="font-bold text-green-900">Evaluación final</h4><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Puntaje obtenido" value={`${reportEvaluation.earned_points ?? 0} / ${reportEvaluation.total_points ?? 0}`} /><Field label="Nota final" value={reportEvaluation.final_grade} /><Field label="Retroalimentación general" value={reportEvaluation.general_feedback} /><Field label="Rúbrica y criterios" value={reportEvaluation.project_report_scores} /></div></div>}</>}
      </Section>

      <footer className="rounded-xl bg-blue-50 p-4 text-center text-xs text-blue-700">Este expediente se actualiza automáticamente con toda la información registrada en el proyecto.</footer>
    </div>
  </main></div>
}
