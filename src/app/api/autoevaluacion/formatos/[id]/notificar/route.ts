import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

function canManage(role?: string | null) {
  return ['admin', 'docente', 'coordinador'].includes(String(role ?? ''))
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

type Student = {
  id: string
  full_name?: string | null
  email?: string | null
  curso?: string | null
  role?: string | null
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !canManage(actor.role)) {
    return NextResponse.json({ error: 'No tienes permiso para enviar autoevaluaciones.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const target = cleanText((body as any)?.target)
  const courseId = cleanText((body as any)?.course_id)
  const studentId = cleanText((body as any)?.student_id)

  const admin = createAdminSupabaseClient()

  const { data: format } = await admin
    .from('self_evaluation_formats')
    .select('id, title, description')
    .eq('id', id)
    .eq('active', true)
    .single()

  if (!format) return NextResponse.json({ error: 'Formato de autoevaluación no encontrado.' }, { status: 404 })

  let students: Student[] = []
  let targetLabel = ''

  if (target === 'course') {
    if (!courseId) return NextResponse.json({ error: 'Selecciona un curso.' }, { status: 400 })

    const { data: course } = await admin.from('courses').select('id, name').eq('id', courseId).single()
    if (!course) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 })

    const [{ data: members }, { data: fallbackProfiles }] = await Promise.all([
      admin.from('course_members').select('user_id, profiles(id, full_name, email, curso, role)').eq('course_id', courseId),
      course.name
        ? admin.from('profiles').select('id, full_name, email, curso, role').eq('role', 'estudiante').eq('curso', course.name)
        : Promise.resolve({ data: [] as Student[] }),
    ])

    const fromMembers = (members ?? [])
      .map((row: any) => Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)
      .filter((profile: Student | null): profile is Student => Boolean(profile && profile.role === 'estudiante'))

    const merged = new Map<string, Student>()
    for (const student of [...fromMembers, ...((fallbackProfiles ?? []) as Student[])]) {
      if (student.id) merged.set(student.id, student)
    }
    students = [...merged.values()]
    targetLabel = course.name ?? 'curso seleccionado'
  } else if (target === 'student') {
    if (!studentId) return NextResponse.json({ error: 'Selecciona un estudiante.' }, { status: 400 })
    const { data: student } = await admin
      .from('profiles')
      .select('id, full_name, email, curso, role')
      .eq('id', studentId)
      .single()

    if (!student || student.role !== 'estudiante') {
      return NextResponse.json({ error: 'Estudiante no encontrado.' }, { status: 404 })
    }
    students = [student as Student]
    targetLabel = student.full_name ?? student.email ?? 'estudiante seleccionado'
  } else {
    return NextResponse.json({ error: 'Selecciona si enviarás por curso o por estudiante.' }, { status: 400 })
  }

  if (students.length === 0) {
    return NextResponse.json({ error: 'No se encontraron estudiantes para enviar la notificación.' }, { status: 400 })
  }

  const rows = students.map(student => ({
    user_id: student.id,
    title: 'Nueva autoevaluación asignada',
    message: `Tienes una autoevaluación disponible: ${format.title}. Ingresa a la sección Autoevaluación para responderla.`,
    type: 'self_evaluation',
    source_type: 'self_evaluation',
    source_id: format.id,
    dedupe_key: `self_evaluation:assigned:${format.id}:${student.id}`,
    is_read: false,
    read_at: null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from('user_notifications')
    .upsert(rows, { onConflict: 'dedupe_key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, count: students.length, target_label: targetLabel })
}
