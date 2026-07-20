import { NextResponse } from 'next/server'
import { AUTOEVALUACION_QUESTIONS, DEFAULT_AUTOEVALUACION_FORMAT_ID, AutoevaluacionQuestion, normalizeAutoevaluacionQuestions } from '@/lib/autoevaluacion'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

type AnswerValue = string | string[]

type AutoevaluacionRequestBody = {
  student_name?: unknown
  course_id?: unknown
  project_name?: unknown
  project_id?: unknown
  intervention_place?: unknown
  confirmed?: unknown
  answers?: unknown
  format_id?: unknown
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeAnswers(rawAnswers: unknown, questions: AutoevaluacionQuestion[]) {
  const answers = rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)
    ? rawAnswers as Record<string, unknown>
    : {}

  const normalized: Record<string, AnswerValue> = {}
  for (const question of questions) {
    const value = answers[question.id]
    normalized[question.id] = question.type === 'checkbox'
      ? (Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : [])
      : cleanText(value)
  }
  return normalized
}

function validateAnswers(answers: Record<string, AnswerValue>, questions: AutoevaluacionQuestion[]) {
  for (const question of questions) {
    if (!question.required) continue
    const value = answers[question.id]
    if (!value || (Array.isArray(value) && value.length === 0)) return `Falta responder: ${question.prompt}`
    if (question.type === 'rating' && !['1', '2', '3', '4'].includes(String(value))) return `Respuesta no valida: ${question.prompt}`
    if (question.type === 'single' && !question.options?.includes(String(value))) return `Opcion no valida: ${question.prompt}`
  }
  return ''
}

export async function POST(request: Request) {
  const actor = await getSurveyActor()
  if (!actor) return NextResponse.json({ error: 'Debes iniciar sesion para responder la autoevaluacion.' }, { status: 401 })

  const body = await request.json().catch(() => null) as AutoevaluacionRequestBody | null
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 })

  const studentName = cleanText(body.student_name)
  const courseId = cleanText(body.course_id)
  const projectName = cleanText(body.project_name)
  const projectId = cleanText(body.project_id)
  const interventionPlace = cleanText(body.intervention_place)
  const confirmed = Boolean(body.confirmed)
  const formatId = cleanText(body.format_id)

  const admin = createAdminSupabaseClient()
  let questions = AUTOEVALUACION_QUESTIONS
  let savedFormatId: string | null = null

  if (formatId && formatId !== DEFAULT_AUTOEVALUACION_FORMAT_ID) {
    const { data: format } = await admin
      .from('self_evaluation_formats')
      .select('id, questions')
      .eq('id', formatId)
      .eq('active', true)
      .single()

    if (!format) return NextResponse.json({ error: 'El formato seleccionado no existe o no esta activo.' }, { status: 400 })
    const dynamicQuestions = normalizeAutoevaluacionQuestions(format.questions)
    if (dynamicQuestions.length === 0) return NextResponse.json({ error: 'El formato seleccionado no tiene preguntas validas.' }, { status: 400 })
    questions = dynamicQuestions
    savedFormatId = format.id
  }

  const answers = normalizeAnswers(body.answers, questions)

  if (!studentName) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
  if (!courseId) return NextResponse.json({ error: 'Selecciona un curso.' }, { status: 400 })
  if (!projectName) return NextResponse.json({ error: 'El nombre del proyecto es obligatorio.' }, { status: 400 })
  if (!projectId) return NextResponse.json({ error: 'Selecciona el proyecto asociado.' }, { status: 400 })
  if (!interventionPlace) return NextResponse.json({ error: 'El lugar intervenido es obligatorio.' }, { status: 400 })
  if (!confirmed) return NextResponse.json({ error: 'Debes confirmar el envio de la autoevaluacion.' }, { status: 400 })

  const validationError = validateAnswers(answers, questions)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { data: course } = await admin.from('courses').select('id').eq('id', courseId).single()
  if (!course) return NextResponse.json({ error: 'El curso seleccionado no existe.' }, { status: 400 })

  const [{ data: ownedProject }, { data: collaboration }] = await Promise.all([
    admin.from('projects').select('id, course_id, title').eq('id', projectId).eq('owner_id', actor.id).maybeSingle(),
    admin.from('project_collaborators').select('project_id').eq('project_id', projectId).eq('user_id', actor.id).eq('status', 'accepted').maybeSingle(),
  ])
  const linkedProject = ownedProject ?? (collaboration ? (await admin.from('projects').select('id, course_id, title').eq('id', projectId).maybeSingle()).data : null)
  if (!linkedProject || linkedProject.course_id !== courseId) return NextResponse.json({ error: 'El proyecto seleccionado no pertenece al estudiante o al curso.' }, { status: 403 })

  const { data, error } = await admin
    .from('self_evaluations')
    .insert({
      user_id: actor.id,
      course_id: courseId,
      project_id: projectId,
      format_id: savedFormatId,
      student_name: studentName,
      project_name: projectName,
      intervention_place: interventionPlace,
      answers,
      confirmed,
      status: 'enviada',
    })
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'No fue posible guardar la autoevaluacion.' }, { status: 400 })

  return NextResponse.json({ id: data.id }, { status: 201 })
}
