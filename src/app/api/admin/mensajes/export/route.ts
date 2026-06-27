import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden exportar mensajes.' }, { status: 403 })
  }

  const admin = createAdminSupabaseClient()
  const pageSize = 1000
  let from = 0
  const lines: string[] = []

  while (true) {
    const { data, error } = await admin
      .from('messages')
      .select('id, sender_id, receiver_id, content, read, created_at, sender:profiles!messages_sender_id_fkey(full_name, email, role), receiver:profiles!messages_receiver_id_fkey(full_name, email, role)')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const rows = data ?? []
    for (const message of rows as any[]) {
      lines.push(JSON.stringify({
        id: message.id,
        created_at: message.created_at,
        content: message.content ?? '',
        read: Boolean(message.read),
        sender: {
          id: message.sender_id,
          name: message.sender?.full_name ?? null,
          email: message.sender?.email ?? null,
          role: message.sender?.role ?? null,
        },
        receiver: {
          id: message.receiver_id,
          name: message.receiver?.full_name ?? null,
          email: message.receiver?.email ?? null,
          role: message.receiver?.role ?? null,
        },
      }))
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const exportedAt = new Date().toISOString()
  const header = JSON.stringify({ type: 'metadata', exported_at: exportedAt, total_messages: lines.length, format: 'jsonl', purpose: 'moderation_review' })
  const body = `${header}\n${lines.join('\n')}\n`
  const filename = `mensajes-moderacion-${exportedAt.slice(0, 10)}.jsonl`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
