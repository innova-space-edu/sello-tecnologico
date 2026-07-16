import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const STAFF_ROLES = ['admin', 'docente', 'coordinador', 'utp']

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminSupabaseClient()
  const [{ data: report }, { data: profile }, { data: membership }] = await Promise.all([
    admin.from('project_reports').select('id, project_id, course_id, created_by').eq('id', id).single(),
    admin.from('profiles').select('role').eq('id', user.id).single(),
    admin.from('project_report_members').select('id').eq('report_id', id).eq('user_id', user.id).maybeSingle(),
  ])

  if (!report) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
  const allowed = report.created_by === user.id || Boolean(membership) || STAFF_ROLES.includes(profile?.role ?? '')
  if (!allowed) return NextResponse.json({ error: 'Sin acceso al informe' }, { status: 403 })

  const [{ data: project }, { data: evidences }, { data: surveys }, { data: pages }] = await Promise.all([
    admin.from('projects').select('*').eq('id', report.project_id).single(),
    admin.from('evidences').select('id, title, description, file_url, file_type, type, evidencia_tipo, created_at').eq('project_id', report.project_id).order('created_at', { ascending: false }),
    report.course_id
      ? admin.from('surveys').select('id, title, description, slug, created_at').eq('course_id', report.course_id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    admin.from('project_public_pages').select('id, title, description, slug, status, is_public, updated_at').eq('project_id', report.project_id).order('updated_at', { ascending: false }),
  ])

  const surveyIds = (surveys ?? []).map((survey: any) => survey.id)
  const { data: responseRows } = surveyIds.length
    ? await admin.from('survey_responses').select('survey_id').in('survey_id', surveyIds)
    : { data: [] as any[] }
  const responseCount = (responseRows ?? []).reduce<Record<string, number>>((acc, row: any) => {
    acc[row.survey_id] = (acc[row.survey_id] ?? 0) + 1
    return acc
  }, {})

  const resources: any[] = []
  if (project) {
    const projectFields: Array<[string, string, unknown]> = [
      ['project-summary', 'Descripción general del proyecto', project.description],
      ['project-question', 'Pregunta guía', project.pregunta_guia],
      ['project-context', 'Contexto del problema', project.contexto_problema],
      ['project-justification', 'Justificación', project.justificacion],
      ['project-learning', 'Objetivos de aprendizaje', project.objetivos_aprendizaje],
      ['project-methodology', 'Metodología', project.metodologia],
      ['project-organization', 'Organización del trabajo', project.organizacion_trabajo],
      ['project-achievements', 'Aprendizajes logrados', project.aprendizajes_logrados],
      ['project-difficulties', 'Dificultades encontradas', project.dificultades],
      ['project-improvements', 'Mejoras propuestas', project.mejoras],
      ['project-impact', 'Impacto en la comunidad', project.impacto_comunidad],
    ]
    resources.push({
      id: project.id,
      kind: 'project',
      title: project.title,
      description: project.description ?? 'Información principal del proyecto.',
      url: `/proyectos/${project.id}`,
      metadata: { text: project.description ?? '' },
    })
    for (const [suffix, title, value] of projectFields) {
      if (typeof value === 'string' && value.trim()) {
        resources.push({ id: `${project.id}-${suffix}`, kind: 'project', title, description: value, metadata: { text: value } })
      }
    }
  }

  for (const evidence of evidences ?? []) {
    resources.push({
      id: evidence.id,
      kind: 'evidence',
      title: evidence.title,
      description: evidence.description,
      url: evidence.file_url,
      mimeType: evidence.file_type,
      metadata: { type: evidence.type, stage: evidence.evidencia_tipo, createdAt: evidence.created_at },
    })
  }

  for (const survey of surveys ?? []) {
    const count = responseCount[survey.id] ?? 0
    resources.push({
      id: survey.id,
      kind: 'survey',
      title: survey.title,
      description: `${survey.description ?? 'Encuesta del curso.'} Respuestas registradas: ${count}.`,
      url: survey.slug ? `/formularios/${survey.slug}` : `/encuestas/${survey.id}`,
      metadata: { responseCount: count, text: `Encuesta: ${survey.title}. Respuestas registradas: ${count}.` },
    })
  }

  for (const page of pages ?? []) {
    resources.push({
      id: page.id,
      kind: 'page',
      title: page.title,
      description: page.description ?? `Página del proyecto en estado ${page.status}.`,
      url: page.slug ? `/p/${page.slug}` : null,
      metadata: { status: page.status, isPublic: page.is_public },
    })
  }

  return NextResponse.json({ resources })
}
