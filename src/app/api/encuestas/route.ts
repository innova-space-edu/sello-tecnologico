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

function normalizeQuestions(questions: any[]) {
  return questions.map((question: any, index: number) => {
    const questionType = String(question.question_type ?? 'text')
    const options = Array.isArray(question.options) ? question.options.map(String).map((option: string) => option.trim()).filter(Boolean) : []
    const correctAnswers = ['single', 'multiple'].includes(questionType) && Array.isArray(question.correct_answers)
      ? [...new Set(question.correct_answers.map(String).map((answer: string) => answer.trim()).filter(Boolean))]
      : []

    return {
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
  if (questions.length === 0) return 'Las preguntas deben tener texto.'

  for (const question of questions) {
    if (!Number.isFinite(question.max_points) || question.max_points <= 0) {
      return `El ítem “${question.prompt}” debe tener un puntaje mayor que 0.`
    }
    if (question.question_type === 'single') {
      if (question.correct_answers.length !== 1 || !question.options.includes(question.correct_answers[0])) {
        return `Selecciona una alternativa correcta en el ítem “${question.prompt}”.`
      }
    }
    if (question.question_type === 'multiple') {
      if (question.correct_answers.length === 0 || question.correct_answers.some((answer: string) => !question.options.includes(answer))) {
        return `Selecciona al menos una alternativa correcta en el ítem “${question.prompt}”.`
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
    await admin.from('survey_course_staff').insert(
      allowedStaff.map(teacherId => ({ survey_id: survey.id, teacher_id: teacherId }))
    )
  }

  return NextResponse.json({ id: survey.id, slug: survey.slug }, { status: 201 })
}
