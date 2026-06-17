import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

export const runtime = 'nodejs'

type TargetType = 'all' | 'course' | 'students' | 'staff' | 'selected'

const MAX_RECIPIENTS = 600
const MAX_FILES = 5
const MAX_FILE_SIZE = 25 * 1024 * 1024
const BUCKET = 'message-attachments'

function clean(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function parseSelectedIds(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? '[]'))
    return Array.isArray(parsed) ? parsed.map(item => String(item)).filter(Boolean) : []
  } catch {
    return []
  }
}

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 140)
}

async function resolveRecipients(params: {
  targetType: TargetType
  courseName: string
  selectedIds: string[]
  senderId: string
}) {
  const admin = createAdminSupabaseClient()

  let query = admin
    .from('profiles')
    .select('id, role, curso, full_name, email, blocked')
    .neq('id', params.senderId)
    .order('full_name', { ascending: true })

  if (params.targetType === 'course') {
    if (!params.courseName) return []
    query = query.ilike('curso', params.courseName)
  }

  if (params.targetType === 'students') {
    query = query.eq('role', 'estudiante')
  }

  if (params.targetType === 'staff') {
    query = query.in('role', ['docente', 'coordinador', 'utp', 'admin'])
  }

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
  if (!actor) {
    return NextResponse.json({ error: 'Debes iniciar sesión para enviar mensajes.' }, { status: 401 })
  }

  if (!['admin', 'docente'].includes(actor.role)) {
    return NextResponse.json({ error: 'Solo docentes y administradores pueden enviar mensajes grupales.' }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const targetType = clean(formData.get('target_type')) as TargetType
  if (!['all', 'course', 'students', 'staff', 'selected'].includes(targetType)) {
    return NextResponse.json({ error: 'Tipo de destinatario inválido.' }, { status: 400 })
  }

  const courseName = clean(formData.get('course_name'))
  const selectedIds = parseSelectedIds(formData.get('selected_user_ids'))
  const title = clean(formData.get('title'))
  const content = clean(formData.get('content'))

  if (!content) {
    return NextResponse.json({ error: 'El mensaje es obligatorio.' }, { status: 400 })
  }

  const files = formData
    .getAll('files')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Puedes adjuntar máximo ${MAX_FILES} archivos.` }, { status: 400 })
  }

  const tooLarge = files.find(file => file.size > MAX_FILE_SIZE)
  if (tooLarge) {
    return NextResponse.json({ error: `El archivo "${tooLarge.name}" supera los 25 MB.` }, { status: 400 })
  }

  const recipients = await resolveRecipients({
    targetType,
    courseName,
    selectedIds,
    senderId: actor.id,
  })

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No hay destinatarios válidos.' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()

  const { data: batch, error: batchError } = await admin
    .from('message_batches')
    .insert({
      sender_id: actor.id,
      target_type: targetType,
      course_name: targetType === 'course' ? courseName : null,
      selected_user_ids: targetType === 'selected' ? selectedIds : null,
      title: title || null,
      content,
      total_recipients: recipients.length,
      has_attachments: files.length > 0,
    })
    .select('id')
    .single()

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? 'No fue posible crear el envío grupal.' }, { status: 400 })
  }

  const uploadedAttachments: Array<{
    id: string
    file_name: string
  }> = []

  for (const file of files) {
    const safeName = sanitizeFileName(file.name || 'archivo')
    const storagePath = `${actor.id}/${batch.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `No fue posible subir "${file.name}": ${uploadError.message}` }, { status: 400 })
    }

    const { data: attachment, error: attachmentError } = await admin
      .from('message_attachments')
      .insert({
        batch_id: batch.id,
        uploader_id: actor.id,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        file_name: file.name || safeName,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
      })
      .select('id, file_name')
      .single()

    if (attachmentError || !attachment) {
      return NextResponse.json({ error: attachmentError?.message ?? 'No fue posible registrar el archivo.' }, { status: 400 })
    }

    uploadedAttachments.push(attachment)
  }

  const attachmentLines = uploadedAttachments.length
    ? '\n\nArchivos adjuntos:\n' + uploadedAttachments
        .map(item => `📎 ${item.file_name}: /api/mensajes/adjunto/${item.id}`)
        .join('\n')
    : ''

  const finalContent = title
    ? `📢 ${title}\n\n${content}${attachmentLines}`
    : `${content}${attachmentLines}`

  const rows = recipients.map(recipient => ({
    sender_id: actor.id,
    receiver_id: recipient.id,
    content: finalContent,
    batch_id: batch.id,
    message_kind: 'group',
  }))

  const { data: inserted, error: insertError } = await admin
    .from('messages')
    .insert(rows)
    .select('id')

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'No fue posible crear los mensajes.' }, { status: 400 })
  }

  return NextResponse.json({
    batch_id: batch.id,
    total_recipients: inserted.length,
    total_attachments: uploadedAttachments.length,
  }, { status: 201 })
}
