import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canEditSurvey, getSurveyActor } from '@/lib/survey-auth'

const QUESTION_TYPES = ['text', 'single', 'multiple', 'appreciation', 'checklist', 'rating', 'number']

function normalizeOptionScores(options: string[], rawScores: unknown) {
  const scores = rawScores && typeof rawScores === 'object' && !Array.isArray(rawScores)
    ? rawScores as Record<string, unknown>
    : {}
  return Object.fromEntries(options.map(option => [option, Number(scores[option] ?? 0)]))
}

function calculateClosedMaxPoints(questionType: string, optionScores: Record<string, number>) {
  const values = Object.values(optionScores).map(Number).filter(Number.isFinite)
  if (['multiple', 'checklist'].includes(questionType)) return values.reduce((total, value) => total + Math.max(0, value), 0)
  return values.length > 0 ? Math.max(...values, 0) : 0
}

function normalizeQuestions(questions: any[], surveyId: string) {
  return questions.map((question: any, index: number) => {
    const requestedType = String(question.question_type ?? 'text')
    const questionType = QUESTION_TYPES.includes(requestedType) ? requestedType : 'text'
    const options: string[] = Array.isArray(question.options) ? question.options.map(String).map((option: string) => option.trim()).filter(Boolean) : []
    const isClosed = ['single', 'multiple', 'checklist'].includes(questionType)
    const optionScores = isClosed ? normalizeOptionScores(options, question.option_scores) : {}
    const maxPoints = isClosed ? calculateClosedMaxPoints(questionType, optionScores) : Number(question.max_points ?? 1)
    const correctAnswers = questionType === 'single'
      ? options.filter(option => Number(optionScores[option] ?? 0) === maxPoints && maxPoints > 0)
      : ['multiple', 'checklist'].includes(questionType)
        ? options.filter(option => Number(optionScores[option] ?? 0) > 0)
        : []

    return {
      survey_id: surveyId,
      prompt: String(question.prompt ?? '').trim(),
      section: String(question.section ?? 'General').trim() || 'General',
      question_type: questionType,
      required: Boolean(question.required),
      sort_order: index,
      options,
      appreciation_min_label: String(question.appreciation_min_label ?? 'Muy en desacuerdo').trim() || 'Muy en desacuerdo',
      appreciation_max_label: String(question.appreciation_max_label ?? 'Muy de acuerdo').trim() || 'Muy de acuerdo',
      max_points: maxPoints,
      correct_answers: correctAnswers,
      option_scores: optionScores,
    }
  }).filter((question: any) => question.prompt)
}

function validateQuestions(questions: any[]) {
  if (questions.length === 0) return 'Agrega al menos una pregunta válida.'
  for (const question of questions) {
    if (!Number.isFinite(question.max_points) || question.max_points <= 0) return `El item "${question.prompt}" debe tener un puntaje mayor que 0.`
    if (['single', 'multiple', 'checklist'].includes(question.question_type)) {
      if (question.options.length < 2) return `Agrega al menos dos opciones en "${question.prompt}".`
      if (new Set(question.options).size !== question.options.length) return `No repitas opciones en "${question.prompt}".`
      for (const option of question.options) {
        const score = Number(question.option_scores[option])
        if (!Number.isFinite(score) || score < 0) return `Asigna puntaje valido a cada opcion de "${question.prompt}".`
      }
    }
  }
  return ''
}

async function replaceStaff(admin: ReturnType<typeof createAdminSupabaseClient>, surveyId: string, actorId: string, staffIds: string[]) {
  const { error: deleteStaffError } = await admin.from('survey_course_staff').delete().eq('survey_id', surveyId)
  if (deleteStaffError) return deleteStaffError
  const allowedStaff = Array.from(new Set([actorId, ...staffIds]))
  const { error: staffError } = await admin.from('survey_course_staff').insert(allowedStaff.map(teacherId => ({ survey_id: surveyId, teacher_id: teacherId })))
  return staffError
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !(await canEditSurvey(actor, id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createAdminSupabaseClient()
  const [{ data: survey }, { data: questions }, { data: staff }, { count: responseCount }] = await Promise.all([
    admin.from('surveys').select('*').eq('id', id).single(),
    admin.from('survey_questions').select('*').eq('survey_id', id).order('sort_order'),
    admin.from('survey_course_staff').select('teacher_id').eq('survey_id', id),
    admin.from('survey_responses').select('*', { count: 'exact', head: true }).eq('survey_id', id),
  ])

  if (!survey) return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
  return NextResponse.json({ ...survey, questions: questions ?? [], staff_ids: (staff ?? []).map(row => row.teacher_id), response_count: responseCount ?? 0 })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !(await canEditSurvey(actor, id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const courseId = body.course_id ? String(body.course_id) : null
  const projectId = body.project_id ? String(body.project_id) : null
  const questions = Array.isArray(body.questions) ? body.questions : []
  const staffIds = Array.isArray(body.staff_ids) ? body.staff_ids.map(String) : []

  const admin = createAdminSupabaseClient()
  const { count: responseCount } = await admin.from('survey_responses').select('*', { count: 'exact', head: true }).eq('survey_id', id)

  if ((responseCount ?? 0) > 0) {
    const { error: updateError } = await admin.from('surveys').update({ is_active: body.is_active !== false, allow_anonymous: body.allow_anonymous !== false, updated_at: new Date().toISOString() }).eq('id', id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
    const staffError = await replaceStaff(admin, id, actor.id, staffIds)
    if (staffError) return NextResponse.json({ error: staffError.message }, { status: 400 })
    return NextResponse.json({ ok: true, locked: true })
  }

  const normalizedQuestions = normalizeQuestions(questions, id)
  const validationError = validateQuestions(normalizedQuestions)
  if (!title || !courseId || !projectId) return NextResponse.json({ error: 'Completa título, curso y proyecto.' }, { status: 400 })
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { data: project } = await admin.from('projects').select('id').eq('id', projectId).eq('course_id', courseId).maybeSingle()
  if (!project) return NextResponse.json({ error: 'El proyecto no pertenece al curso seleccionado.' }, { status: 400 })
  const { error: updateError } = await admin.from('surveys').update({ title, description: description || null, course_id: courseId, project_id: projectId, is_active: body.is_active !== false, allow_anonymous: body.allow_anonymous !== false, updated_at: new Date().toISOString() }).eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  const { error: deleteQuestionError } = await admin.from('survey_questions').delete().eq('survey_id', id)
  if (deleteQuestionError) return NextResponse.json({ error: deleteQuestionError.message }, { status: 400 })

  const { error: questionError } = await admin.from('survey_questions').insert(normalizedQuestions)
  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 400 })

  const staffError = await replaceStaff(admin, id, actor.id, staffIds)
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !(await canEditSurvey(actor, id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const admin = createAdminSupabaseClient()
  const { error } = await admin.from('surveys').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
