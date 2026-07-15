import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const EMOJIS = new Set(['❤️','👏','🔥','🌱','💡','🚀','😂','😮'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

async function optionalUser() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
  } catch {
    return null
  }
}

async function snapshot(admin: ReturnType<typeof createAdminSupabaseClient>, storyId: string, userId: string | null, visitorKey: string) {
  const [reactionsResult, commentsResult, viewsResult] = await Promise.all([
    admin.from('community_story_reactions').select('emoji, profile_id, visitor_key').eq('story_id', storyId),
    admin.from('community_story_comments').select('id, profile_id, visitor_name, content, created_at').eq('story_id', storyId).eq('is_hidden', false).order('created_at', { ascending: false }).limit(20),
    admin.from('community_story_views').select('id', { count: 'exact', head: true }).eq('story_id', storyId),
  ])

  const reactions = reactionsResult.data ?? []
  const counts: Record<string, number> = { '❤️': 0, '👏': 0, '🔥': 0, '🌱': 0, '💡': 0, '🚀': 0, '😂': 0, '😮': 0 }
  reactions.forEach((row: any) => { counts[row.emoji] = (counts[row.emoji] ?? 0) + 1 })
  const viewerReaction = reactions.find((row: any) => userId ? row.profile_id === userId : visitorKey && row.visitor_key === visitorKey)?.emoji ?? null

  const rawComments = commentsResult.data ?? []
  const profileIds = Array.from(new Set(rawComments.map((row: any) => row.profile_id).filter(Boolean)))
  const { data: profiles } = profileIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] as any[] }
  const names = new Map((profiles ?? []).map((row: any) => [row.id, row.full_name]))

  return {
    reactions: counts,
    reactions_count: reactions.length,
    viewer_reaction: viewerReaction,
    comments_count: rawComments.length,
    views_count: viewsResult.count ?? 0,
    comments: rawComments.map((row: any) => ({
      id: row.id,
      content: row.content,
      visitor_name: row.visitor_name,
      author_name: row.profile_id ? (names.get(row.profile_id) ?? 'Usuario') : (row.visitor_name || 'Visitante'),
      created_at: row.created_at,
    })),
  }
}

type Params = { params: Promise<{ id: string }> }
type SocialBody = {
  action?: 'view' | 'reaction' | 'comment' | 'report'
  visitorKey?: string
  emoji?: string
  content?: string
  reason?: string
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Historia inválida.' }, { status: 400 })

  const body = await request.json().catch(() => ({})) as SocialBody
  const visitorKey = clean(body.visitorKey, 120)
  const user = await optionalUser()
  if (!user && !visitorKey && body.action !== 'comment') return NextResponse.json({ error: 'No fue posible identificar al visitante.' }, { status: 400 })

  const admin = createAdminSupabaseClient()
  const { data: story } = await admin.from('community_stories').select('id, visibility_status, is_featured, expires_at, comments_enabled').eq('id', id).maybeSingle()
  const active = story?.visibility_status === 'published' && (story.is_featured || new Date(story.expires_at).getTime() > Date.now())
  if (!story?.id || !active) return NextResponse.json({ error: 'La historia ya no está disponible.' }, { status: 404 })

  if (body.action === 'view') {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    let existingQuery = admin.from('community_story_views').select('id').eq('story_id', id).gte('created_at', since).limit(1)
    existingQuery = user ? existingQuery.eq('profile_id', user.id) : existingQuery.eq('visitor_key', visitorKey)
    const { data: existing } = await existingQuery
    if (!existing?.length) {
      await admin.from('community_story_views').insert({ story_id: id, profile_id: user?.id ?? null, visitor_key: user ? null : visitorKey, user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null })
    }
    return NextResponse.json({ ok: true, ...(await snapshot(admin, id, user?.id ?? null, visitorKey)) })
  }

  if (body.action === 'reaction') {
    const emoji = clean(body.emoji, 8)
    if (!EMOJIS.has(emoji)) return NextResponse.json({ error: 'Reacción no válida.' }, { status: 400 })
    let query = admin.from('community_story_reactions').select('id, emoji').eq('story_id', id)
    query = user ? query.eq('profile_id', user.id) : query.eq('visitor_key', visitorKey)
    const { data: existing } = await query.maybeSingle()
    if (existing?.id && existing.emoji === emoji) await admin.from('community_story_reactions').delete().eq('id', existing.id)
    else if (existing?.id) await admin.from('community_story_reactions').update({ emoji, updated_at: new Date().toISOString() }).eq('id', existing.id)
    else await admin.from('community_story_reactions').insert({ story_id: id, profile_id: user?.id ?? null, visitor_key: user ? null : visitorKey, emoji })
    return NextResponse.json({ ok: true, ...(await snapshot(admin, id, user?.id ?? null, visitorKey)) })
  }

  if (body.action === 'comment') {
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión para comentar.' }, { status: 401 })
    if (!story.comments_enabled) return NextResponse.json({ error: 'Los comentarios están desactivados.' }, { status: 403 })
    const content = clean(body.content, 600)
    if (content.length < 2) return NextResponse.json({ error: 'Escribe un comentario válido.' }, { status: 400 })
    const { error } = await admin.from('community_story_comments').insert({ story_id: id, profile_id: user.id, visitor_key: null, visitor_name: null, content })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, ...(await snapshot(admin, id, user.id, visitorKey)) })
  }

  if (body.action === 'report') {
    const reason = clean(body.reason, 500)
    if (reason.length < 3) return NextResponse.json({ error: 'Indica el motivo del reporte.' }, { status: 400 })
    await admin.from('community_story_reports').insert({ story_id: id, profile_id: user?.id ?? null, visitor_key: user ? null : visitorKey, reason })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
}
