import { NextResponse } from 'next/server'
import { AUTOEVALUACION_QUESTIONS } from '@/lib/autoevaluacion'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

type AnswerValue = string | string[]

type AutoevaluacionRequestBody = {
  student_name?: unknown
  course_id?: unknown
  project_name?: unknown
  intervention_place?: unknown
  confirmed?: unknown
  answers?: unknown
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeAnswers(rawAnswers: unknown) {
  const answers = rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)
    ? rawAnswers as Record<string, unknown>
    : {}

  const normalized: Record<string, AnswerValue> = {}
  for (const question of AUTOEVALUACION_QUESTIONS) {
    const value = answers[question.id]
    if (question.type === 'checkbox') {
      normalized[question.id] = Array.isArray(value)
        ? value.map(item => String(item).trim()).filter(Boolean)
        : []
    } else {
      normalized[question.id] = cleanText(value)
    }
  }
  return normalized
}

function validateAnswers(answers: Record<string, AnswerValue>) {
  for (const question of AUTOEVALUACION_QUESTIONS) {
    if (!question.required) continue
    const value = answers[question.id]
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return `Falta responder: ${question.prompt}`
    }
    if (question.type === 'rating' && !['1', '2', '3', '4'].includes(String(value))) {
      return `La valoración de “${question.prompt}” no es válida.`
    }
    if (question.type === 'single' && !question.options?.includes(String(value))) {
      return `La opción seleccionada en “${question.prompt}” no es válida.`
    }
  }
  return ''
}

export async function POST(request: Request) {
  const actor = await getSurveyActor()
  if (!actor) return NextResponse.json({ error: 'Debes iniciar sesión para responder la autoevaluación.' }, { status: 401 })

  const body = await request.json().catch(() => null) as AutoevaluacionRequestBody | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const studentName = cleanText(body.student_name)
  const courseId = cleanText(body.course_id)
  const projectName = cleanText(body.project_name)
  const interventionPlace = cleanText(body.intervention_place)
  const confirmed = Boolean(body.confirmed)
  const answers = normalizeAnswers(body.answers)

  if (!studentName) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
  if (!courseId) return NextResponse.json({ error: 'Selecciona un curso.' }, { status: 400 })
  if (!projectName) return NextResponse.json({ error: 'El nombre del proyecto es obligatorio.' }, { status: 400 })
  if (!interventionPlace) return NextResponse.json({ error: 'El lugar intervenido es obligatorio.' }, { status: 400 })
  if (!confirmed) return NextResponse.json({ error: 'Debes confirmar el envío de la autoevaluación.' }, { status: 400 })

  const validationError = validateAnswers(answers)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const admin = createAdminSupabaseClient()
  const { data: course } = await admin.from('courses').select('id').eq('id', courseId).single()
  if (!course) return NextResponse.json({ error: 'El curso seleccionado no existe.' }, { status: 400 })

  const { data, error } = await admin
    .from('self_evaluations')
    .insert({
      user_id: actor.id,
      course_id: courseId,
      student_name: studentName,
      project_name: projectName,
      intervention_place: interventionPlace,
      answers,
      confirmed,
      status: 'enviada',
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'No fue posible guardar la autoevaluación.' }, { status: 400 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
