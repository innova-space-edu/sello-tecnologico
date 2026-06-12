import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canManageSurveys, getSurveyActor } from '@/lib/survey-auth'

function makeSlug(title: string) {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'encuesta'
  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

function normalizeOptionScores(options: string[], rawScores: unknown) {
  const scores = rawScores && typeof rawScores === 'object' && !Array.isArray(rawScores)
    ? rawScores as Record<string, unknown>
    : {}
  return Object.fromEntries(options.map(option => [option, Number(scores[option] ?? 0)]))
}

function calculateClosedMaxPoints(questionType: string, optionScores: Record<string, number>) {
  const values = Object.values(optionScores).map(Number).filter(Number.isFinite)
  if (questionType === 'multiple') return values.reduce((total, value) => total + Math.max(0, value), 0)
  return values.length > 0 ? Math.max(...values, 0) : 0
}

function normalizeQuestions(questions: any[]) {
  return questions.map((question: any, index: number) => {
    const questionType = String(question.question_type ?? 'text')
    const options: string[] = Array.isArray(question.options) ? question.options.map(String).map((option: string) => option.trim()).filter(Boolean) : []
    const isClosed = ['single', 'multiple'].includes(questionType)
    const optionScores = isClosed ? normalizeOptionScores(options, question.option_scores) : {}
    const maxPoints = isClosed ? calculateClosedMaxPoints(questionType, optionScores) : Number(question.max_points ?? 1)
    const correctAnswers = questionType === 'single'
      ? options.filter(option => Number(optionScores[option] ?? 0) === maxPoints && maxPoints > 0)
      : questionType === 'multiple'
        ? options.filter(option => Number(optionScores[option] ?? 0) > 0)
        : []

    return {
      prompt: String(question.prompt ?? '').trim(),
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
  if (questions.length === 0) return 'Las preguntas deben tener texto.'

  for (const question of questions) {
    if (!Number.isFinite(question.max_points) || question.max_points <= 0) {
      return `El ítem “${question.prompt}” debe tener un puntaje máximo mayor que 0.`
    }
    if (['single', 'multiple'].includes(question.question_type)) {
      if (question.options.length < 2) return `Agrega al menos dos alternativas en el ítem “${question.prompt}”.`
      if (new Set(question.options).size !== question.options.length) return `No repitas alternativas en el ítem “${question.prompt}”.`
      for (const option of question.options) {
        const score = Number(question.option_scores[option])
        if (!Number.isFinite(score) || score < 0) return `Asigna un puntaje válido, igual o mayor que 0, a cada alternativa del ítem “${question.prompt}”.`
      }
    }
  }
  return ''
}

export async function POST(request: Request) {
  const actor = await getSurveyActor()
  if (!canManageSurveys(actor)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const courseId = body.course_id ? String(body.course_id) : null
  const isActive = body.is_active !== false
  const allowAnonymous = body.allow_anonymous !== false
  const questions = Array.isArray(body.questions) ? body.questions : []
  const staffIds = Array.isArray(body.staff_ids) ? body.staff_ids.map(String) : []
  const studentIds = Array.isArray(body.student_ids) ? [...new Set(body.student_ids.map(String))] : []

  if (!title) return NextResponse.json({ error: 'El título es obligatorio.' }, { status: 400 })
  if (!courseId) return NextResponse.json({ error: 'Selecciona un curso.' }, { status: 400 })
  if (questions.length === 0) return NextResponse.json({ error: 'Agrega al menos una pregunta.' }, { status: 400 })

  const normalizedQuestions = normalizeQuestions(questions)
  const validationError = validateQuestions(normalizedQuestions)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const admin = createAdminSupabaseClient()
  const { data: survey, error } = await admin
    .from('surveys')
    .insert({
      title,
      description: description || null,
      slug: makeSlug(title),
      course_id: courseId,
      creator_id: actor!.id,
      is_active: isActive,
      allow_anonymous: allowAnonymous,
    })
    .select('id, slug')
    .single()

  if (error || !survey) {
    return NextResponse.json({ error: error?.message ?? 'No fue posible crear la encuesta.' }, { status: 400 })
  }

  const { error: questionError } = await admin.from('survey_questions').insert(
    normalizedQuestions.map(question => ({ ...question, survey_id: survey.id }))
  )
  if (questionError) {
    await admin.from('surveys').delete().eq('id', survey.id)
    return NextResponse.json({ error: questionError.message }, { status: 400 })
  }

  const allowedStaff = Array.from(new Set([actor!.id, ...staffIds]))
  if (allowedStaff.length > 0) {
    const { error: staffError } = await admin.from('survey_course_staff').insert(
      allowedStaff.map(teacherId => ({ survey_id: survey.id, teacher_id: teacherId }))
    )
    if (staffError) return NextResponse.json({ error: staffError.message }, { status: 400 })
  }

  if (studentIds.length > 0) {
    const { error: studentError } = await admin.from('survey_students').insert(
      studentIds.map(studentId => ({ survey_id: survey.id, student_id: studentId }))
    )
    if (studentError) return NextResponse.json({ error: studentError.message }, { status: 400 })
  }

  return NextResponse.json({ id: survey.id, slug: survey.slug }, { status: 201 })
}
