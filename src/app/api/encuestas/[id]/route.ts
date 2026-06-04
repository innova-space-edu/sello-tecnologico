import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canEditSurvey, getSurveyActor } from '@/lib/survey-auth'

function normalizeQuestions(questions: any[], surveyId: string) {
  return questions.map((question: any, index: number) => ({
    survey_id: surveyId,
    prompt: String(question.prompt ?? '').trim(),
    question_type: String(question.question_type ?? 'text'),
    required: Boolean(question.required),
    sort_order: index,
    options: Array.isArray(question.options) ? question.options.map(String).filter(Boolean) : [],
    appreciation_min_label: String(question.appreciation_min_label ?? 'Muy en desacuerdo').trim() || 'Muy en desacuerdo',
    appreciation_max_label: String(question.appreciation_max_label ?? 'Muy de acuerdo').trim() || 'Muy de acuerdo',
  })).filter((question: any) => question.prompt)
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !(await canEditSurvey(actor, id))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const admin = createAdminSupabaseClient()
  const [{ data: survey }, { data: questions }, { data: staff }] = await Promise.all([
    admin.from('surveys').select('*').eq('id', id).single(),
    admin.from('survey_questions').select('*').eq('survey_id', id).order('sort_order'),
    admin.from('survey_course_staff').select('teacher_id').eq('survey_id', id),
  ])

  if (!survey) return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
  return NextResponse.json({ ...survey, questions: questions ?? [], staff_ids: (staff ?? []).map(row => row.teacher_id) })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !(await canEditSurvey(actor, id))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const courseId = body.course_id ? String(body.course_id) : null
  const questions = Array.isArray(body.questions) ? body.questions : []
  const staffIds = Array.isArray(body.staff_ids) ? body.staff_ids.map(String) : []
  const normalizedQuestions = normalizeQuestions(questions, id)

  if (!title || !courseId) {
    return NextResponse.json({ error: 'Completa título y curso.' }, { status: 400 })
  }
  if (normalizedQuestions.length === 0) {
    return NextResponse.json({ error: 'Agrega al menos una pregunta válida.' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { error: updateError } = await admin.from('surveys').update({
    title,
    description: description || null,
    course_id: courseId,
    is_active: body.is_active !== false,
    allow_anonymous: body.allow_anonymous !== false,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  const [{ error: deleteQuestionError }, { error: deleteStaffError }] = await Promise.all([
    admin.from('survey_questions').delete().eq('survey_id', id),
    admin.from('survey_course_staff').delete().eq('survey_id', id),
  ])
  if (deleteQuestionError || deleteStaffError) {
    return NextResponse.json({ error: deleteQuestionError?.message ?? deleteStaffError?.message }, { status: 400 })
  }

  const { error: questionError } = await admin.from('survey_questions').insert(normalizedQuestions)
  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 400 })

  const allowedStaff = Array.from(new Set([actor.id, ...staffIds]))
  const { error: staffError } = await admin.from('survey_course_staff').insert(
    allowedStaff.map(teacherId => ({ survey_id: id, teacher_id: teacherId }))
  )
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !(await canEditSurvey(actor, id))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const admin = createAdminSupabaseClient()
  const { error } = await admin.from('surveys').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
