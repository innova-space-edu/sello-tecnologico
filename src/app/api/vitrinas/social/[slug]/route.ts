import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

type Params = {
  params: Promise<{ slug: string }>
}

type SocialBody = {
  action?: 'view' | 'like' | 'comment'
  visitorKey?: string
  visitorName?: string
  content?: string
}

function cleanText(value: unknown, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
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

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params
  const { admin, page } = await getPublishedPage(slug)

  if (!page) {
    return NextResponse.json({ error: 'Página no publicada.' }, { status: 404 })
  }

  const [likesResult, viewsResult, commentsResult, trendingResult] = await Promise.all([
    admin.from('project_public_page_likes').select('id', { count: 'exact', head: true }).eq('page_id', page.id),
    admin.from('project_public_page_views').select('id', { count: 'exact', head: true }).eq('page_id', page.id),
    admin
      .from('project_public_page_comments')
      .select('id, visitor_name, content, created_at, profiles(full_name)')
      .eq('page_id', page.id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(30),
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
    stats: {
      likes: likesResult.count ?? 0,
      views: viewsResult.count ?? 0,
      comments: commentsResult.data?.length ?? 0,
    },
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

  if (body.action === 'view') {
    await admin.from('project_public_page_views').insert({
      page_id: page.id,
      visitor_key: visitorKey || null,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'like') {
    if (!visitorKey) {
      return NextResponse.json({ error: 'Falta identificador de visitante.' }, { status: 400 })
    }

    const { data: existing } = await admin
      .from('project_public_page_likes')
      .select('id')
      .eq('page_id', page.id)
      .eq('visitor_key', visitorKey)
      .maybeSingle()

    if (existing?.id) {
      await admin.from('project_public_page_likes').delete().eq('id', existing.id)
      return NextResponse.json({ ok: true, liked: false })
    }

    await admin.from('project_public_page_likes').insert({ page_id: page.id, visitor_key: visitorKey })
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
