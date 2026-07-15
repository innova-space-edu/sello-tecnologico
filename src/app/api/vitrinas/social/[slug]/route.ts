import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const EMOJIS = new Set(['❤️', '👏', '🔥', '🌱', '💡', '🚀', '😂', '😮'])

type Params = { params: Promise<{ slug: string }> }
type TargetType = 'page' | 'block' | 'asset'
type SocialBody = {
  action?: 'view' | 'like' | 'reaction' | 'comment'
  visitorKey?: string
  content?: string
  emoji?: string
  targetType?: TargetType
  targetId?: string | null
}

function cleanText(value: unknown, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

function normalizeTarget(targetType?: string | null, targetId?: string | null) {
  const type: TargetType = targetType === 'block' || targetType === 'asset' ? targetType : 'page'
  const id = cleanText(targetId, 120) || null
  return { type, id }
}

function withTarget(query: any, targetType: TargetType, targetId: string | null) {
  if (targetType === 'block' && targetId) return query.eq('block_id', targetId).is('asset_id', null)
  if (targetType === 'asset' && targetId) return query.eq('asset_id', targetId).is('block_id', null)
  return query.is('block_id', null).is('asset_id', null)
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

async function validateTarget(admin: ReturnType<typeof createAdminSupabaseClient>, pageId: string, targetType: TargetType, targetId: string | null) {
  if (targetType === 'page') return { block_id: null, asset_id: null, error: null }
  if (!targetId) return { block_id: null, asset_id: null, error: 'Falta identificador de la publicación.' }
  if (targetType === 'block') {
    const { data } = await admin.from('project_public_blocks').select('id').eq('id', targetId).eq('page_id', pageId).maybeSingle()
    if (!data?.id) return { block_id: null, asset_id: null, error: 'La publicación no pertenece a esta página.' }
    return { block_id: targetId, asset_id: null, error: null }
  }
  const { data } = await admin.from('project_public_assets').select('id').eq('id', targetId).eq('page_id', pageId).maybeSingle()
  if (!data?.id) return { block_id: null, asset_id: null, error: 'El archivo no pertenece a esta página.' }
  return { block_id: null, asset_id: targetId, error: null }
}

async function getPublishedPage(slug: string) {
  const admin = createAdminSupabaseClient()
  const { data: page } = await admin.from('project_public_pages').select('id, title, slug, description, theme_color, accent_color').eq('slug', slug).eq('is_public', true).eq('status', 'published').single()
  return { admin, page }
}

function reactionSnapshot(rows: any[], userId: string | null, visitorKey: string) {
  const reactions: Record<string, number> = { '❤️': 0, '👏': 0, '🔥': 0, '🌱': 0, '💡': 0, '🚀': 0, '😂': 0, '😮': 0 }
  rows.forEach(row => {
    const emoji = EMOJIS.has(row.reaction_emoji) ? row.reaction_emoji : '❤️'
    reactions[emoji] = (reactions[emoji] ?? 0) + 1
  })
  const own = rows.find(row => userId ? row.profile_id === userId : visitorKey && row.visitor_key === visitorKey)
  return {
    reactions,
    reactions_count: rows.length,
    viewer_reaction: own?.reaction_emoji || (own ? '❤️' : null),
  }
}

async function readReactions(admin: ReturnType<typeof createAdminSupabaseClient>, pageId: string, targetType: TargetType, targetId: string | null, userId: string | null, visitorKey: string) {
  const query = withTarget(admin.from('project_public_page_likes').select('reaction_emoji, profile_id, visitor_key').eq('page_id', pageId), targetType, targetId)
  const { data } = await query
  return reactionSnapshot(data ?? [], userId, visitorKey)
}

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params
  const url = new URL(request.url)
  const { type: targetType, id: targetId } = normalizeTarget(url.searchParams.get('targetType'), url.searchParams.get('targetId'))
  const visitorKey = cleanText(url.searchParams.get('visitorKey'), 120)
  const includeComments = url.searchParams.get('includeComments') !== '0'
  const includeTrending = url.searchParams.get('includeTrending') === '1'
  const user = await optionalUser()
  const { admin, page } = await getPublishedPage(slug)
  if (!page) return NextResponse.json({ error: 'Página no publicada.' }, { status: 404 })

  const target = await validateTarget(admin, page.id, targetType, targetId)
  if (target.error) return NextResponse.json({ error: target.error }, { status: 400 })

  const commentsQuery = withTarget(
    admin.from('project_public_page_comments').select('id, profile_id, visitor_name, content, created_at, profiles(full_name)', { count: 'exact' }).eq('page_id', page.id).eq('is_hidden', false).order('created_at', { ascending: false }).limit(includeComments ? (targetType === 'page' ? 8 : 30) : 0),
    targetType,
    targetId,
  )
  const viewsQuery = withTarget(admin.from('project_public_page_views').select('id', { count: 'exact', head: true }).eq('page_id', page.id), targetType, targetId)
  const trendingQuery = includeTrending
    ? admin.from('project_public_page_trending').select('id, title, slug, description, theme_color, accent_color, likes_count, views_count, comments_count, trend_score, published_at').order('trend_score', { ascending: false }).order('published_at', { ascending: false }).limit(8)
    : Promise.resolve({ data: [] as any[] })

  const [reactionData, viewsResult, commentsResult, trendingResult] = await Promise.all([
    readReactions(admin, page.id, targetType, targetId, user?.id ?? null, visitorKey),
    viewsQuery,
    commentsQuery,
    trendingQuery,
  ])

  return NextResponse.json({
    page,
    target: { type: targetType, id: targetId },
    stats: { likes: reactionData.reactions_count, views: viewsResult.count ?? 0, comments: commentsResult.count ?? 0 },
    liked: Boolean(reactionData.viewer_reaction),
    ...reactionData,
    comments: includeComments ? (commentsResult.data ?? []) : [],
    trending: trendingResult.data ?? [],
    authenticated: Boolean(user),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params
  const body = await request.json().catch(() => ({})) as SocialBody
  const user = await optionalUser()
  const { admin, page } = await getPublishedPage(slug)
  if (!page) return NextResponse.json({ error: 'Página no publicada.' }, { status: 404 })

  const visitorKey = cleanText(body.visitorKey, 120)
  const { type: targetType, id: targetId } = normalizeTarget(body.targetType, body.targetId)
  const target = await validateTarget(admin, page.id, targetType, targetId)
  if (target.error) return NextResponse.json({ error: target.error }, { status: 400 })

  if (body.action === 'view') {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    let recentQuery = withTarget(admin.from('project_public_page_views').select('id').eq('page_id', page.id).gte('created_at', thirtyMinutesAgo).limit(1), targetType, targetId)
    recentQuery = user ? recentQuery.eq('profile_id', user.id) : recentQuery.eq('visitor_key', visitorKey)
    const { data: recent } = await recentQuery
    const counted = !recent?.length
    if (counted) {
      await admin.from('project_public_page_views').insert({
        page_id: page.id,
        block_id: target.block_id,
        asset_id: target.asset_id,
        profile_id: user?.id ?? null,
        visitor_key: user ? null : (visitorKey || null),
        user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
      })
    }
    return NextResponse.json({ ok: true, counted })
  }

  if (body.action === 'like' || body.action === 'reaction') {
    if (!user && !visitorKey) return NextResponse.json({ error: 'No fue posible identificar al visitante.' }, { status: 400 })
    const emoji = body.action === 'like' ? '❤️' : cleanText(body.emoji, 8)
    if (!EMOJIS.has(emoji)) return NextResponse.json({ error: 'Reacción no válida.' }, { status: 400 })

    let existingQuery = withTarget(admin.from('project_public_page_likes').select('id, reaction_emoji').eq('page_id', page.id), targetType, targetId)
    existingQuery = user ? existingQuery.eq('profile_id', user.id) : existingQuery.eq('visitor_key', visitorKey)
    const { data: existing } = await existingQuery.maybeSingle()

    if (existing?.id && (existing.reaction_emoji || '❤️') === emoji) {
      await admin.from('project_public_page_likes').delete().eq('id', existing.id)
    } else if (existing?.id) {
      await admin.from('project_public_page_likes').update({ reaction_emoji: emoji }).eq('id', existing.id)
    } else {
      await admin.from('project_public_page_likes').insert({
        page_id: page.id,
        block_id: target.block_id,
        asset_id: target.asset_id,
        profile_id: user?.id ?? null,
        visitor_key: user ? null : visitorKey,
        reaction_emoji: emoji,
      })
    }
    return NextResponse.json({ ok: true, ...(await readReactions(admin, page.id, targetType, targetId, user?.id ?? null, visitorKey)) })
  }

  if (body.action === 'comment') {
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión para comentar.' }, { status: 401 })
    const content = cleanText(body.content, 600)
    if (content.length < 2) return NextResponse.json({ error: 'Escribe un comentario válido.' }, { status: 400 })
    const { error } = await admin.from('project_public_page_comments').insert({
      page_id: page.id,
      block_id: target.block_id,
      asset_id: target.asset_id,
      profile_id: user.id,
      visitor_name: null,
      content,
      is_hidden: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
}
