import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canAccessCourse, getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

const KINDS = new Set(['parcial', 'acumulativa', 'sumativa', 'formativa', 'diagnostica', 'otra'])
const ENTRY_MODES = new Set(['grade', 'points', 'percent'])
const PERIODS = new Set(['1S', '2S'])
const STATUSES = new Set(['normal', 'ausente', 'justificado', 'eximido', 'pendiente'])

function textValue(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round1(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

function chileGrade(percent: number, exigencia: number) {
  const p = Math.max(0, Math.min(100, percent))
  const e = Math.max(1, Math.min(99, exigencia))
  const value = p <= e
    ? 1 + (p / e) * 3
    : 4 + ((p - e) / (100 - e)) * 3
  return Math.max(1, Math.min(7, round1(value)))
}

async function getGradebook(admin: AdminClient, actor: NonNullable<Awaited<ReturnType<typeof getPromediosActor>>>, id: string) {
  const { data } = await admin
    .from('promedios_gradebooks')
    .select('id, course_id, owner_id, subject, period, school_year, passing_percent, min_grade, max_grade, passing_grade, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  if (data.owner_id !== actor.id && actor.role !== 'admin') return null
  if (!(await canAccessCourse(actor, data.course_id))) return null
  return data
}

export async function GET(request: NextRequest) {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const courseId = request.nextUrl.searchParams.get('courseId') ?? ''
  const subject = textValue(request.nextUrl.searchParams.get('subject'))
  const period = request.nextUrl.searchParams.get('period') ?? '1S'
  const schoolYear = Number(request.nextUrl.searchParams.get('schoolYear') || new Date().getFullYear())

  if (!courseId || !subject || !PERIODS.has(period) || !Number.isInteger(schoolYear)) {
    return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400, headers: noStoreHeaders() })
  }
  if (!(await canAccessCourse(actor, courseId))) {
    return NextResponse.json({ error: 'No tienes acceso a este curso' }, { status: 403, headers: noStoreHeaders() })
  }

  const admin = createAdminSupabaseClient()
  const { data: gradebook, error: bookError } = await admin
    .from('promedios_gradebooks')
    .select('id, course_id, owner_id, subject, period, school_year, passing_percent, min_grade, max_grade, passing_grade, created_at, updated_at')
    .eq('course_id', courseId)
    .eq('owner_id', actor.id)
    .eq('subject', subject)
    .eq('period', period)
    .eq('school_year', schoolYear)
    .maybeSingle()

  if (bookError) return NextResponse.json({ error: bookError.message }, { status: 500, headers: noStoreHeaders() })
  if (!gradebook) {
    return NextResponse.json({ gradebook: null, assessments: [], grades: [] }, { headers: noStoreHeaders() })
  }

  const { data: assessments, error: assessmentError } = await admin
    .from('promedios_assessments')
    .select('id, gradebook_id, title, kind, entry_mode, max_points, passing_percent, weight, counts_toward_average, assessment_date, sort_order, created_at, updated_at')
    .eq('gradebook_id', gradebook.id)
    .order('sort_order')
    .order('created_at')

  if (assessmentError) return NextResponse.json({ error: assessmentError.message }, { status: 500, headers: noStoreHeaders() })

  const ids = (assessments ?? []).map((item) => item.id)
  let grades: Array<Record<string, unknown>> = []
  if (ids.length) {
    const { data, error } = await admin
      .from('promedios_grades')
      .select('assessment_id, student_id, grade, raw_score, status, updated_at')
      .in('assessment_id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })
    grades = data ?? []
  }

  return NextResponse.json({ gradebook, assessments: assessments ?? [], grades }, { headers: noStoreHeaders() })
}

export async function POST(request: NextRequest) {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400, headers: noStoreHeaders() })

  const action = textValue(body.action, 40)
  const admin = createAdminSupabaseClient()

  if (action === 'ensure') {
    const courseId = textValue(body.courseId, 80)
    const subject = textValue(body.subject)
    const period = textValue(body.period, 10) || '1S'
    const schoolYear = numberValue(body.schoolYear) ?? new Date().getFullYear()
    const passingPercent = numberValue(body.passingPercent) ?? 60

    if (!courseId || !subject || !PERIODS.has(period) || !Number.isInteger(schoolYear)) {
      return NextResponse.json({ error: 'Faltan datos del libro de calificaciones' }, { status: 400, headers: noStoreHeaders() })
    }
    if (passingPercent <= 0 || passingPercent >= 100) {
      return NextResponse.json({ error: 'La exigencia debe estar entre 1% y 99%' }, { status: 400, headers: noStoreHeaders() })
    }
    if (!(await canAccessCourse(actor, courseId))) {
      return NextResponse.json({ error: 'No tienes acceso a este curso' }, { status: 403, headers: noStoreHeaders() })
    }

    const { data: existing, error: existingError } = await admin
      .from('promedios_gradebooks')
      .select('id')
      .eq('course_id', courseId)
      .eq('owner_id', actor.id)
      .eq('subject', subject)
      .eq('period', period)
      .eq('school_year', schoolYear)
      .maybeSingle()

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500, headers: noStoreHeaders() })
    if (existing) return NextResponse.json({ id: existing.id }, { headers: noStoreHeaders() })

    const { data, error } = await admin
      .from('promedios_gradebooks')
      .insert({
        course_id: courseId,
        owner_id: actor.id,
        subject,
        period,
        school_year: schoolYear,
        passing_percent: passingPercent,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })
    return NextResponse.json({ id: data.id }, { headers: noStoreHeaders() })
  }

  const gradebookId = textValue(body.gradebookId, 80)
  if (!gradebookId) return NextResponse.json({ error: 'Falta gradebookId' }, { status: 400, headers: noStoreHeaders() })
  const gradebook = await getGradebook(admin, actor, gradebookId)
  if (!gradebook) return NextResponse.json({ error: 'Libro no disponible' }, { status: 404, headers: noStoreHeaders() })

  if (action === 'settings') {
    const passingPercent = numberValue(body.passingPercent)
    if (passingPercent == null || passingPercent <= 0 || passingPercent >= 100) {
      return NextResponse.json({ error: 'La exigencia debe estar entre 1% y 99%' }, { status: 400, headers: noStoreHeaders() })
    }

    const { error } = await admin
      .from('promedios_gradebooks')
      .update({ passing_percent: passingPercent, updated_at: new Date().toISOString() })
      .eq('id', gradebook.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() })
  }

  if (action === 'assessment') {
    const assessment = (body.assessment ?? {}) as Record<string, unknown>
    const id = textValue(assessment.id, 80)
    const title = textValue(assessment.title)
    const kind = textValue(assessment.kind, 30) || 'parcial'
    const entryMode = textValue(assessment.entry_mode, 30) || 'grade'
    const weight = numberValue(assessment.weight) ?? 1
    const maxPoints = numberValue(assessment.max_points)
    const ownPassingPercent = numberValue(assessment.passing_percent)
    const countsTowardAverage = assessment.counts_toward_average !== false
    const assessmentDate = textValue(assessment.assessment_date, 20) || null

    if (!title || !KINDS.has(kind) || !ENTRY_MODES.has(entryMode) || weight <= 0) {
      return NextResponse.json({ error: 'Datos de evaluación inválidos' }, { status: 400, headers: noStoreHeaders() })
    }
    if (entryMode === 'points' && (maxPoints == null || maxPoints <= 0)) {
      return NextResponse.json({ error: 'Debes indicar el puntaje máximo' }, { status: 400, headers: noStoreHeaders() })
    }
    if (ownPassingPercent != null && (ownPassingPercent <= 0 || ownPassingPercent >= 100)) {
      return NextResponse.json({ error: 'La exigencia propia debe estar entre 1% y 99%' }, { status: 400, headers: noStoreHeaders() })
    }

    const payload = {
      title,
      kind,
      entry_mode: entryMode,
      max_points: entryMode === 'points' ? maxPoints : null,
      passing_percent: ownPassingPercent,
      weight,
      counts_toward_average: countsTowardAverage,
      assessment_date: assessmentDate,
      updated_at: new Date().toISOString(),
    }

    if (id) {
      const { data, error } = await admin
        .from('promedios_assessments')
        .update(payload)
        .eq('id', id)
        .eq('gradebook_id', gradebook.id)
        .select('id')
        .maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })
      if (!data) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404, headers: noStoreHeaders() })
      return NextResponse.json({ id: data.id }, { headers: noStoreHeaders() })
    }

    const { data: last } = await admin
      .from('promedios_assessments')
      .select('sort_order')
      .eq('gradebook_id', gradebook.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await admin
      .from('promedios_assessments')
      .insert({ ...payload, gradebook_id: gradebook.id, sort_order: (last?.sort_order ?? -1) + 1 })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })
    return NextResponse.json({ id: data.id }, { headers: noStoreHeaders() })
  }

  if (action === 'deleteAssessment') {
    const assessmentId = textValue(body.assessmentId, 80)
    if (!assessmentId) return NextResponse.json({ error: 'Falta assessmentId' }, { status: 400, headers: noStoreHeaders() })

    const { error } = await admin
      .from('promedios_assessments')
      .delete()
      .eq('id', assessmentId)
      .eq('gradebook_id', gradebook.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() })
  }

  if (action === 'saveGrades') {
    const entries = Array.isArray(body.entries) ? body.entries as Array<Record<string, unknown>> : []
    if (entries.length > 10000) {
      return NextResponse.json({ error: 'Demasiadas notas en una sola operación' }, { status: 400, headers: noStoreHeaders() })
    }
    if (entries.length === 0) return NextResponse.json({ ok: true, saved: 0 }, { headers: noStoreHeaders() })

    const assessmentIds = [...new Set(entries.map((item) => textValue(item.assessment_id, 80)).filter(Boolean))]
    const studentIds = [...new Set(entries.map((item) => textValue(item.student_id, 80)).filter(Boolean))]

    const [{ data: assessments, error: assessmentError }, { data: members, error: memberError }] = await Promise.all([
      admin
        .from('promedios_assessments')
        .select('id, entry_mode, max_points, passing_percent')
        .eq('gradebook_id', gradebook.id)
        .in('id', assessmentIds),
      admin
        .from('course_members')
        .select('user_id')
        .eq('course_id', gradebook.course_id)
        .in('user_id', studentIds),
    ])

    if (assessmentError) return NextResponse.json({ error: assessmentError.message }, { status: 500, headers: noStoreHeaders() })
    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500, headers: noStoreHeaders() })

    const assessmentMap = new Map((assessments ?? []).map((item) => [item.id, item]))
    const memberSet = new Set((members ?? []).map((item) => item.user_id))
    if (assessmentMap.size !== assessmentIds.length || memberSet.size !== studentIds.length) {
      return NextResponse.json({ error: 'La selección contiene estudiantes o evaluaciones fuera del curso' }, { status: 400, headers: noStoreHeaders() })
    }

    const rows = entries.map((item) => {
      const assessmentId = textValue(item.assessment_id, 80)
      const studentId = textValue(item.student_id, 80)
      const status = STATUSES.has(textValue(item.status, 30)) ? textValue(item.status, 30) : 'normal'
      const assessment = assessmentMap.get(assessmentId)!
      let rawScore = numberValue(item.raw_score)
      let grade = numberValue(item.grade)

      if (status !== 'normal') {
        rawScore = null
        grade = null
      } else if (assessment.entry_mode === 'grade') {
        if (grade != null) grade = Math.max(1, Math.min(7, round1(grade)))
        rawScore = null
      } else {
        if (rawScore != null) {
          const percent = assessment.entry_mode === 'points'
            ? (rawScore / Number(assessment.max_points || 1)) * 100
            : rawScore
          grade = chileGrade(percent, Number(assessment.passing_percent ?? gradebook.passing_percent))
        } else {
          grade = null
        }
      }

      return {
        assessment_id: assessmentId,
        student_id: studentId,
        grade,
        raw_score: rawScore,
        status,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      }
    })

    const { error } = await admin.from('promedios_grades').upsert(rows, { onConflict: 'assessment_id,student_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })

    await admin.from('promedios_gradebooks').update({ updated_at: new Date().toISOString() }).eq('id', gradebook.id)
    return NextResponse.json({ ok: true, saved: rows.length }, { headers: noStoreHeaders() })
  }

  return NextResponse.json({ error: 'Acción no soportada' }, { status: 400, headers: noStoreHeaders() })
}
