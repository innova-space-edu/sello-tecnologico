import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

type Params = {
  params: Promise<{ slug: string }>
}

type TargetType = 'page' | 'block' | 'asset'

type SocialBody = {
  action?: 'view' | 'like' | 'comment'
  visitorKey?: string
  visitorName?: string
  content?: string
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
  if (targetType === 'block' && targetId) {
    return query.eq('block_id', targetId).is('asset_id', null)
  }

  if (targetType === 'asset' && targetId) {
    return query.eq('asset_id', targetId).is('block_id', null)
  }

  return query.is('block_id', null).is('asset_id', null)
}

async function validateTarget(admin: ReturnType<typeof createAdminSupabaseClient>, pageId: string, targetType: TargetType, targetId: string | null) {
  if (targetType === 'page') return { block_id: null, asset_id: null, error: null }

  if (!targetId) {
    return { block_id: null, asset_id: null, error: 'Falta identificador de la publicación.' }
  }

  if (targetType === 'block') {
    const { data } = await admin
      .from('project_public_blocks')
      .select('id')
      .eq('id', targetId)
      .eq('page_id', pageId)
      .maybeSingle()

    if (!data?.id) return { block_id: null, asset_id: null, error: 'La publicación no pertenece a esta página.' }
    return { block_id: targetId, asset_id: null, error: null }
  }

  const { data } = await admin
    .from('project_public_assets')
    .select('id')
    .eq('id', targetId)
    .eq('page_id', pageId)
    .maybeSingle()

  if (!data?.id) return { block_id: null, asset_id: null, error: 'El archivo no pertenece a esta página.' }
  return { block_id: null, asset_id: targetId, error: null }
}

async function getPublishedPage(slug: string) {
  const admin = createAdminSupabaseClient()
  const { data: page } = await admin
    .from('project_public_pages')
    .select('id, title, slug, description, theme_color, accent_color')
    .eq('slug', slug)
    .eq('is_public', true)
    .eq('status', 'published')
    .single()

  return { admin, page }
}

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params
  const url = new URL(request.url)
  const { type: targetType, id: targetId } = normalizeTarget(url.searchParams.get('targetType'), url.searchParams.get('targetId'))
  const visitorKey = cleanText(url.searchParams.get('visitorKey'), 120)
  const { admin, page } = await getPublishedPage(slug)

  if (!page) {
    return NextResponse.json({ error: 'Página no publicada.' }, { status: 404 })
  }

  const target = await validateTarget(admin, page.id, targetType, targetId)
  if (target.error) {
    return NextResponse.json({ error: target.error }, { status: 400 })
  }

  const likesQuery = withTarget(
    admin.from('project_public_page_likes').select('id', { count: 'exact', head: true }).eq('page_id', page.id),
    targetType,
    targetId,
  )
  const viewsQuery = withTarget(
    admin.from('project_public_page_views').select('id', { count: 'exact', head: true }).eq('page_id', page.id),
    targetType,
    targetId,
  )
  const commentsQuery = withTarget(
    admin
      .from('project_public_page_comments')
      .select('id, visitor_name, content, created_at, profiles(full_name)', { count: 'exact' })
      .eq('page_id', page.id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(30),
    targetType,
    targetId,
  )

  const likedQuery = visitorKey
    ? withTarget(
        admin
          .from('project_public_page_likes')
          .select('id')
          .eq('page_id', page.id)
          .eq('visitor_key', visitorKey)
          .limit(1),
        targetType,
        targetId,
      )
    : null

  const [likesResult, viewsResult, commentsResult, likedResult, trendingResult] = await Promise.all([
    likesQuery,
    viewsQuery,
    commentsQuery,
    likedQuery ?? Promise.resolve({ data: [] }),
    admin
      .from('project_public_page_trending')
      .select('id, title, slug, description, theme_color, accent_color, likes_count, views_count, comments_count, trend_score')
      .neq('slug', slug)
      .order('trend_score', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(8),
  ])

  return NextResponse.json({
    page,
    target: { type: targetType, id: targetId },
    stats: {
      likes: likesResult.count ?? 0,
      views: viewsResult.count ?? 0,
      comments: commentsResult.count ?? 0,
    },
    liked: Boolean(likedResult?.data?.length),
    comments: commentsResult.data ?? [],
    trending: trendingResult.data ?? [],
  })
}

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params
  const body = await request.json().catch(() => ({})) as SocialBody
  const { admin, page } = await getPublishedPage(slug)

  if (!page) {
    return NextResponse.json({ error: 'Página no publicada.' }, { status: 404 })
  }

  const visitorKey = cleanText(body.visitorKey, 120)
  const { type: targetType, id: targetId } = normalizeTarget(body.targetType, body.targetId)
  const target = await validateTarget(admin, page.id, targetType, targetId)

  if (target.error) {
    return NextResponse.json({ error: target.error }, { status: 400 })
  }

  if (body.action === 'view') {
    await admin.from('project_public_page_views').insert({
      page_id: page.id,
      block_id: target.block_id,
      asset_id: target.asset_id,
      visitor_key: visitorKey || null,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'like') {
    if (!visitorKey) {
      return NextResponse.json({ error: 'Falta identificador de visitante.' }, { status: 400 })
    }

    const { data: existing } = await withTarget(
      admin
        .from('project_public_page_likes')
        .select('id')
        .eq('page_id', page.id)
        .eq('visitor_key', visitorKey),
      targetType,
      targetId,
    ).maybeSingle()

    if (existing?.id) {
      await admin.from('project_public_page_likes').delete().eq('id', existing.id)
      return NextResponse.json({ ok: true, liked: false })
    }

    const { error } = await admin.from('project_public_page_likes').insert({
      page_id: page.id,
      block_id: target.block_id,
      asset_id: target.asset_id,
      visitor_key: visitorKey,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, liked: true })
  }

  if (body.action === 'comment') {
    const content = cleanText(body.content, 600)
    const visitorName = cleanText(body.visitorName, 80) || 'Visitante'

    if (!content || content.length < 2) {
      return NextResponse.json({ error: 'Escribe un comentario válido.' }, { status: 400 })
    }

    const { error } = await admin.from('project_public_page_comments').insert({
      page_id: page.id,
      block_id: target.block_id,
      asset_id: target.asset_id,
      visitor_name: visitorName,
      content,
      is_hidden: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
}
