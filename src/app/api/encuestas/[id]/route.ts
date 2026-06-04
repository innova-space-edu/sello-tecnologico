import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canEditSurvey, getSurveyActor } from '@/lib/survey-auth'

function normalizeQuestions(questions: any[], surveyId: string) {
  return questions.map((question: any, index: number) => {
    const questionType = String(question.question_type ?? 'text')
    const options = Array.isArray(question.options) ? question.options.map(String).map((option: string) => option.trim()).filter(Boolean) : []
    const correctAnswers = ['single', 'multiple'].includes(questionType) && Array.isArray(question.correct_answers)
      ? [...new Set(question.correct_answers.map(String).map((answer: string) => answer.trim()).filter(Boolean))]
      : []
    return {
      survey_id: surveyId,
      prompt: String(question.prompt ?? '').trim(),
      question_type: questionType,
      required: Boolean(question.required),
      sort_order: index,
      options,
      appreciation_min_label: String(question.appreciation_min_label ?? 'Muy en desacuerdo').trim() || 'Muy en desacuerdo',
      appreciation_max_label: String(question.appreciation_max_label ?? 'Muy de acuerdo').trim() || 'Muy de acuerdo',
      max_points: Number(question.max_points ?? 1),
      correct_answers: correctAnswers,
    }
  }).filter((question: any) => question.prompt)
}

function validateQuestions(questions: any[]) {
  if (questions.length === 0) return 'Agrega al menos una pregunta válida.'
  for (const question of questions) {
    if (!Number.isFinite(question.max_points) || question.max_points <= 0) return `El ítem “${question.prompt}” debe tener un puntaje mayor que 0.`
    if (question.question_type === 'single' && (question.correct_answers.length !== 1 || !question.options.includes(question.correct_answers[0]))) return `Selecciona una alternativa correcta en el ítem “${question.prompt}”.`
    if (question.question_type === 'multiple' && (question.correct_answers.length === 0 || question.correct_answers.some((answer: string) => !question.options.includes(answer)))) return `Selecciona al menos una alternativa correcta en el ítem “${question.prompt}”.`
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
  const questions = Array.isArray(body.questions) ? body.questions : []
  const staffIds = Array.isArray(body.staff_ids) ? body.staff_ids.map(String) : []

  const admin = createAdminSupabaseClient()
  const { count: responseCount } = await admin.from('survey_responses').select('*', { count: 'exact', head: true }).eq('survey_id', id)

  if ((responseCount ?? 0) > 0) {
    const { error: updateError } = await admin.from('surveys').update({
      is_active: body.is_active !== false,
      allow_anonymous: body.allow_anonymous !== false,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
    const staffError = await replaceStaff(admin, id, actor.id, staffIds)
    if (staffError) return NextResponse.json({ error: staffError.message }, { status: 400 })
    return NextResponse.json({ ok: true, locked: true })
  }

  const normalizedQuestions = normalizeQuestions(questions, id)
  const validationError = validateQuestions(normalizedQuestions)
  if (!title || !courseId) return NextResponse.json({ error: 'Completa título y curso.' }, { status: 400 })
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { error: updateError } = await admin.from('surveys').update({ title, description: description || null, course_id: courseId, is_active: body.is_active !== false, allow_anonymous: body.allow_anonymous !== false, updated_at: new Date().toISOString() }).eq('id', id)
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
