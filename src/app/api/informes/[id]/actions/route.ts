import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const STAFF_ROLES = ['admin', 'docente', 'coordinador', 'utp']

type ActionName = 'submit' | 'start_review' | 'request_changes' | 'finalize' | 'evaluated' | 'rubric_published'

const ALLOWED_STATES: Record<ActionName, string[]> = {
  submit: ['draft', 'changes_requested'],
  start_review: ['submitted'],
  request_changes: ['submitted', 'in_review', 'evaluated'],
  finalize: ['in_review', 'evaluated'],
  evaluated: ['submitted', 'in_review', 'evaluated'],
  rubric_published: ['draft', 'submitted', 'in_review', 'changes_requested', 'evaluated', 'finalized'],
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({})) as { action?: ActionName; message?: string }
  const action = body.action
  if (!action || !ALLOWED_STATES[action]) return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminSupabaseClient()
  const [{ data: report }, { data: profile }] = await Promise.all([
    admin.from('project_reports').select('id, title, created_by, course_id, status').eq('id', id).single(),
    admin.from('profiles').select('role, full_name').eq('id', user.id).single(),
  ])
  if (!report) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
  if (!ALLOWED_STATES[action].includes(report.status)) {
    return NextResponse.json({ error: `La acción no está disponible mientras el informe está en estado ${report.status}.` }, { status: 409 })
  }

  const isLeader = report.created_by === user.id
  const isStaff = STAFF_ROLES.includes(profile?.role ?? '')
  const now = new Date().toISOString()

  let status = report.status
  let title = ''
  let message = body.message?.trim() ?? ''
  let recipients: string[] = []

  if (action === 'submit') {
    if (!isLeader) return NextResponse.json({ error: 'Solo el jefe del grupo puede enviar el informe' }, { status: 403 })
    status = 'submitted'
    title = 'Nuevo informe enviado'
    message ||= `${report.title} fue enviado por el equipo y está listo para revisión.`
    const { data: staff } = await admin.from('profiles').select('id').in('role', STAFF_ROLES)
    recipients = (staff ?? []).map(row => row.id)
  } else {
    if (!isStaff) return NextResponse.json({ error: 'Solo docentes o administradores pueden realizar esta acción' }, { status: 403 })
    const { data: members } = await admin.from('project_report_members').select('user_id').eq('report_id', id)
    recipients = Array.from(new Set([report.created_by, ...(members ?? []).map(row => row.user_id)]))

    if (action === 'start_review') {
      status = 'in_review'
      title = 'Informe en revisión'
      message ||= `${profile?.full_name ?? 'Un docente'} comenzó la revisión de ${report.title}.`
    }
    if (action === 'request_changes') {
      status = 'changes_requested'
      title = 'Cambios solicitados en el informe'
      message ||= `Revisa la retroalimentación del informe ${report.title} y realiza las correcciones solicitadas.`
    }
    if (action === 'finalize') {
      status = 'finalized'
      title = 'Informe finalizado'
      message ||= `${report.title} fue marcado como finalizado.`
    }
    if (action === 'evaluated') {
      status = 'evaluated'
      title = 'Informe evaluado'
      message ||= `La evaluación de ${report.title} ya está disponible con su puntaje y nota final.`
    }
    if (action === 'rubric_published') {
      title = 'Rúbrica publicada'
      message ||= `Ya puedes revisar la rúbrica del informe ${report.title}.`
      if (report.course_id) {
        const { data: courseMembers } = await admin.from('course_members').select('user_id').eq('course_id', report.course_id)
        recipients = (courseMembers ?? []).map(row => row.user_id)
      }
    }
  }

  if (action !== 'rubric_published') {
    const payload: Record<string, unknown> = { status, updated_at: now }
    if (action === 'submit') payload.submitted_at = now
    if (action === 'evaluated') payload.evaluated_at = now
    const { error } = await admin.from('project_reports').update(payload).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (recipients.length) {
    const notifications = recipients.map(userId => ({
      user_id: userId,
      title,
      message,
      type: action === 'rubric_published' ? 'report_rubric' : 'project_report',
      source_type: 'report',
      source_id: id,
      dedupe_key: `report:${action}:${id}:${userId}`,
      is_read: false,
      read_at: null,
      updated_at: now,
    }))
    await admin.from('user_notifications').upsert(notifications, { onConflict: 'dedupe_key' })
  }

  return NextResponse.json({ ok: true, status })
}
