import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'
import { analyzeMessageContent, moderationEngineVersion } from '@/lib/moderation-engine'

export async function POST(request: Request) {
  const actor = await getSurveyActor()
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administración puede reanalizar mensajes.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { limit?: number }
  const limit = Math.min(Math.max(Number(body.limit ?? 500), 1), 2000)

  const admin = createAdminSupabaseClient()

  const { data: messages, error } = await admin
    .from('messages')
    .select('id, sender_id, receiver_id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  let analyzed = 0
  let createdFlags = 0
  let safe = 0

  for (const message of messages ?? []) {
    analyzed += 1
    const moderation = analyzeMessageContent(message.content ?? '')

    if (moderation.action === 'allow') {
      safe += 1
      continue
    }

    const { data: existing } = await admin
      .from('flagged_messages')
      .select('id')
      .eq('message_id', message.id)
      .maybeSingle()

    if (existing) continue

    await admin.from('flagged_messages').insert({
      message_id: message.id,
      sender_id: message.sender_id,
      receiver_id: message.receiver_id,
      content: message.content,
      category: moderation.category,
      matched_words: moderation.matchedWords,
      severity: moderation.severity,
      confidence: moderation.confidence,
      action: moderation.action,
      engine_version: moderationEngineVersion(),
      moderation_payload: moderation,
      reviewed: false,
    })

    createdFlags += 1
  }

  return NextResponse.json({
    analyzed,
    safe,
    created_flags: createdFlags,
    engine_version: moderationEngineVersion(),
  })
}
