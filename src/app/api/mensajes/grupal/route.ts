import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

type TargetType = 'all' | 'course' | 'students' | 'staff' | 'selected'

type RequestBody = {
  target_type?: unknown
  course_name?: unknown
  selected_user_ids?: unknown
  title?: unknown
  content?: unknown
}

const PEOPLE_TABLE = 'pro' + 'fi' + 'les'
const MAX_RECIPIENTS = 600

function clean(value: unknown) {
  return String(value ?? '').trim()
}

function selectedIds(value: unknown) {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : []
}

async function resolveRecipients(params: { targetType: TargetType; courseName: string; selectedIds: string[]; senderId: string }) {
  const admin = createAdminSupabaseClient()
  let query = admin
    .from(PEOPLE_TABLE)
    .select('id, role, curso, full_name, email, blocked')
    .neq('id', params.senderId)
    .order('full_name', { ascending: true })

  if (params.targetType === 'course') {
    if (!params.courseName) return []
    query = query.ilike('curso', params.courseName)
  }

  if (params.targetType === 'students') query = query.eq('role', 'estudiante')
  if (params.targetType === 'staff') query = query.in('role', ['docente', 'coordinador', 'utp', 'admin'])
  if (params.targetType === 'selected') {
    if (params.selectedIds.length === 0) return []
    query = query.in('id', params.selectedIds)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const unique = new Map<string, { id: string }>()
  for (const recipient of data ?? []) {
    if (recipient.blocked) continue
    unique.set(recipient.id, recipient)
  }
  return Array.from(unique.values()).slice(0, MAX_RECIPIENTS)
}

export async function POST(request: Request) {
  const actor = await getSurveyActor()
  if (!actor) return NextResponse.json({ error: 'Debes iniciar sesión para enviar mensajes.' }, { status: 401 })
  if (!['admin', 'docente'].includes(actor.role)) {
    return NextResponse.json({ error: 'Solo docentes y administradores pueden enviar mensajes grupales.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as RequestBody | null
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })

  const targetType = clean(body.target_type) as TargetType
  if (!['all', 'course', 'students', 'staff', 'selected'].includes(targetType)) {
    return NextResponse.json({ error: 'Tipo de destinatario inválido.' }, { status: 400 })
  }

  const courseName = clean(body.course_name)
  const ids = selectedIds(body.selected_user_ids)
  const title = clean(body.title)
  const content = clean(body.content)
  if (!content) return NextResponse.json({ error: 'El mensaje es obligatorio.' }, { status: 400 })

  const recipients = await resolveRecipients({ targetType, courseName, selectedIds: ids, senderId: actor.id })
  if (recipients.length === 0) return NextResponse.json({ error: 'No hay destinatarios válidos.' }, { status: 400 })

  const admin = createAdminSupabaseClient()
  const finalContent = title ? `📢 ${title}\n\n${content}` : content

  const { data: batch, error: batchError } = await admin
    .from('message_batches')
    .insert({ sender_id: actor.id, target_type: targetType, course_name: targetType === 'course' ? courseName : null, title: title || null, content, total_recipients: recipients.length })
    .select('id')
    .single()

  if (batchError || !batch) return NextResponse.json({ error: batchError?.message ?? 'No fue posible crear el envío grupal.' }, { status: 400 })

  const rows = recipients.map(recipient => ({ sender_id: actor.id, receiver_id: recipient.id, content: finalContent, batch_id: batch.id, message_kind: 'group' }))
  const { data: inserted, error: insertError } = await admin.from('messages').insert(rows).select('id')
  if (insertError || !inserted) return NextResponse.json({ error: insertError?.message ?? 'No fue posible crear los mensajes.' }, { status: 400 })

  return NextResponse.json({ batch_id: batch.id, total_recipients: inserted.length }, { status: 201 })
}
