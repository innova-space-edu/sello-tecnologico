import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'
import { analyzeMessageContent } from '@/lib/moderation-engine'
import { isSchoolWorkContext } from '@/lib/safe-school-context'

type SendMessageBody = {
  receiver_id?: unknown
  content?: unknown
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}

async function insertFlag(params: {
  senderId: string
  receiverId: string
  content: string
  moderation: ReturnType<typeof analyzeMessageContent>
}) {
  const admin = createAdminSupabaseClient()

  await admin.from('flagged_messages').insert({
    sender_id: params.senderId,
    receiver_id: params.receiverId,
    content: params.content,
    category: params.moderation.category,
    matched_words: params.moderation.matchedWords,
    reviewed: false,
  })
}

async function insertMessage(admin: ReturnType<typeof createAdminSupabaseClient>, senderId: string, receiverId: string, content: string) {
  return admin
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select('id')
    .single()
}

export async function POST(request: Request) {
  const actor = await getSurveyActor()
  if (!actor) {
    return NextResponse.json({ error: 'Debes iniciar sesión para enviar mensajes.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as SendMessageBody | null
  const receiverId = clean(body?.receiver_id)
  const content = clean(body?.content)

  if (!receiverId || !content) {
    return NextResponse.json({ error: 'Falta destinatario o mensaje.' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()

  const { data: sender } = await admin
    .from('profiles')
    .select('id, role, curso, blocked')
    .eq('id', actor.id)
    .single()

  if (!sender || sender.blocked) {
    return NextResponse.json({ error: 'Tu cuenta está bloqueada para enviar mensajes.' }, { status: 403 })
  }

  const { data: receiver } = await admin
    .from('profiles')
    .select('id, role, curso, blocked')
    .eq('id', receiverId)
    .single()

  if (!receiver) {
    return NextResponse.json({ error: 'El destinatario no existe.' }, { status: 404 })
  }

  if (sender.role === 'estudiante' && receiver.role === 'estudiante') {
    const sameCourse = sender.curso && receiver.curso &&
      sender.curso.trim().toLowerCase() === receiver.curso.trim().toLowerCase()

    if (!sameCourse) {
      return NextResponse.json({ error: 'Solo puedes enviar mensajes a estudiantes de tu mismo curso.' }, { status: 403 })
    }
  }

  const uidA = [actor.id, receiverId].sort()[0]
  const uidB = [actor.id, receiverId].sort()[1]

  const { data: blockedPair } = await admin
    .from('blocked_pairs')
    .select('id')
    .eq('user_a', uidA)
    .eq('user_b', uidB)
    .maybeSingle()

  if (blockedPair) {
    return NextResponse.json({ error: 'Esta conversación fue bloqueada por administración.' }, { status: 403 })
  }

  if (isSchoolWorkContext(content)) {
    const { data: message, error: messageError } = await insertMessage(admin, actor.id, receiverId, content)
    if (messageError || !message) {
      return NextResponse.json({ error: messageError?.message ?? 'No fue posible enviar el mensaje.' }, { status: 400 })
    }
    return NextResponse.json({ status: 'sent_school_work', id: message.id }, { status: 201 })
  }

  const moderation = analyzeMessageContent(content)

  if (moderation.action === 'block_user') {
    await insertFlag({ senderId: actor.id, receiverId, content, moderation })

    await admin.from('profiles').update({ blocked: true }).eq('id', actor.id)

    await admin.from('blocked_pairs').upsert({
      user_a: uidA,
      user_b: uidB,
      reason: `Moderación automática: ${moderation.category}`,
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_a,user_b' })

    return NextResponse.json({
      status: 'blocked',
      warning: moderation.warning ?? 'Mensaje bloqueado por seguridad escolar.',
    }, { status: 403 })
  }

  if (moderation.action === 'hold_for_review') {
    await insertFlag({ senderId: actor.id, receiverId, content, moderation })
    return NextResponse.json({
      status: 'held_for_review',
      warning: moderation.warning ?? 'Mensaje retenido para revisión.',
    }, { status: 202 })
  }

  const { data: message, error: messageError } = await insertMessage(admin, actor.id, receiverId, content)

  if (messageError || !message) {
    return NextResponse.json({ error: messageError?.message ?? 'No fue posible enviar el mensaje.' }, { status: 400 })
  }

  if (moderation.action === 'flag_and_send') {
    await insertFlag({ senderId: actor.id, receiverId, content, moderation })
  }

  return NextResponse.json({
    status: moderation.action === 'flag_and_send' ? 'sent_flagged' : 'sent',
    id: message.id,
    warning: moderation.warning,
  }, { status: 201 })
}
