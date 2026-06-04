import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canEditSurvey, getSurveyActor } from '@/lib/survey-auth'

async function getSurveyCourse(admin: ReturnType<typeof createAdminSupabaseClient>, surveyId: string) {
  const { data: survey } = await admin
    .from('surveys')
    .select('id, course_id, courses(name)')
    .eq('id', surveyId)
    .single()

  if (!survey) return null
  const courseName = Array.isArray(survey.courses) ? survey.courses[0]?.name ?? '' : (survey.courses as any)?.name ?? ''
  return { id: survey.id, courseId: survey.course_id, courseName }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !(await canEditSurvey(actor, id))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const admin = createAdminSupabaseClient()
  const survey = await getSurveyCourse(admin, id)
  if (!survey) return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })

  const { data: rows, error } = await admin
    .from('survey_students')
    .select('student_id')
    .eq('survey_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    survey_id: id,
    course_id: survey.courseId,
    course_name: survey.courseName,
    student_ids: (rows ?? []).map(row => row.student_id),
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !(await canEditSurvey(actor, id))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const studentIds = Array.isArray(body.student_ids) ? [...new Set(body.student_ids.map(String))] : []
  const admin = createAdminSupabaseClient()
  const survey = await getSurveyCourse(admin, id)
  if (!survey) return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })

  if (studentIds.length > 0) {
    const [{ data: profiles }, { data: members }] = await Promise.all([
      admin.from('profiles').select('id, role, curso').in('id', studentIds),
      admin.from('course_members').select('user_id').eq('course_id', survey.courseId).in('user_id', studentIds),
    ])

    const memberIds = new Set((members ?? []).map(row => row.user_id))
    const validIds = new Set((profiles ?? [])
      .filter(profile => profile.role === 'estudiante' && (memberIds.has(profile.id) || profile.curso === survey.courseName))
      .map(profile => profile.id))

    const invalidIds = studentIds.filter(studentId => !validIds.has(studentId))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'Uno o más estudiantes no pertenecen al curso seleccionado.' }, { status: 400 })
    }
  }

  const { error: deleteError } = await admin.from('survey_students').delete().eq('survey_id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

  if (studentIds.length > 0) {
    const { error: insertError } = await admin.from('survey_students').insert(
      studentIds.map(studentId => ({ survey_id: id, student_id: studentId }))
    )
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, student_ids: studentIds })
}
