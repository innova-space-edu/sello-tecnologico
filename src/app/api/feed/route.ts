import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import type { FeedCursor, FeedPost } from '@/components/social/types'

type FeedSort = 'recent' | 'trending'
type Relation<T> = T | T[] | null | undefined

function clean(value: string | null, max = 120) {
  return String(value ?? '').trim().slice(0, max)
}

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function firstRelation<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function encodeCursor(post: FeedPost) {
  const payload: FeedCursor = {
    itemKey: post.item_key,
    publishedAt: post.published_at,
    trendScore: post.trend_score,
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeCursor(value: string | null): FeedCursor | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as FeedCursor
    if (!parsed?.itemKey || !parsed?.publishedAt) return null
    return {
      itemKey: String(parsed.itemKey),
      publishedAt: String(parsed.publishedAt),
      trendScore: asNumber(parsed.trendScore),
    }
  } catch {
    return null
  }
}

function comparePosts(a: FeedPost, b: FeedPost, sort: FeedSort) {
  if (sort === 'trending' && b.trend_score !== a.trend_score) {
    return b.trend_score - a.trend_score
  }

  const byDate = new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  if (byDate !== 0) return byDate
  return b.item_key.localeCompare(a.item_key)
}

function isAfterCursor(post: FeedPost, cursor: FeedCursor, sort: FeedSort) {
  const cursorPost = {
    ...post,
    item_key: cursor.itemKey,
    published_at: cursor.publishedAt,
    trend_score: cursor.trendScore,
  }
  return comparePosts(post, cursorPost, sort) > 0
}

function matchesType(post: FeedPost, type: string) {
  if (!type || type === 'all') return true
  if (type === 'text') return post.item_type === 'block' && !['audio', 'video', 'image'].includes(post.media_type)
  if (type === 'file') return ['pdf', 'file'].includes(post.media_type)
  return post.media_type === type
}

function matchesSearch(post: FeedPost, query: string) {
  if (!query) return true
  const haystack = [
    post.page_title,
    post.page_description,
    post.author_name,
    post.project_title,
    post.course_name,
    post.title,
    post.content,
  ].join(' ').toLocaleLowerCase('es-CL')
  return haystack.includes(query.toLocaleLowerCase('es-CL'))
}

function normalizeViewPost(row: any): FeedPost {
  return {
    item_type: row.item_type === 'block' ? 'block' : 'asset',
    item_id: String(row.item_id),
    item_key: String(row.item_key ?? `${row.item_type}:${row.item_id}`),
    page_id: String(row.page_id),
    page_slug: String(row.page_slug),
    page_title: String(row.page_title ?? 'Página pública'),
    page_description: row.page_description ?? null,
    author_name: row.author_name ?? null,
    project_id: row.project_id ?? null,
    project_title: row.project_title ?? null,
    course_id: row.course_id ?? null,
    course_name: row.course_name ?? null,
    title: row.title ?? null,
    content: row.content ?? null,
    media_type: String(row.media_type ?? 'text'),
    block_type: row.block_type ?? null,
    asset_id: row.asset_id ?? null,
    published_at: String(row.published_at),
    theme_color: row.theme_color ?? '#2563eb',
    accent_color: row.accent_color ?? '#0ea5e9',
    background_color: row.background_color ?? '#f8fafc',
    text_color: row.text_color ?? '#0f172a',
    card_color: row.card_color ?? '#ffffff',
    likes_count: asNumber(row.likes_count),
    comments_count: asNumber(row.comments_count),
    views_count: asNumber(row.views_count),
    trend_score: asNumber(row.trend_score),
  }
}

function aggregate(rows: any[] | null, target: 'block_id' | 'asset_id') {
  const counts = new Map<string, number>()
  for (const row of rows ?? []) {
    const id = row?.[target]
    if (!id) continue
    counts.set(String(id), (counts.get(String(id)) ?? 0) + 1)
  }
  return counts
}

async function addFallbackStats(admin: ReturnType<typeof createAdminSupabaseClient>, posts: FeedPost[]) {
  const blockIds = posts.filter(post => post.item_type === 'block').map(post => post.item_id)
  const assetIds = posts.filter(post => post.item_type === 'asset').map(post => post.item_id)

  const empty = Promise.resolve({ data: [] as any[] })
  const [blockLikes, assetLikes, blockComments, assetComments, blockViews, assetViews] = await Promise.all([
    blockIds.length ? admin.from('project_public_page_likes').select('block_id').in('block_id', blockIds) : empty,
    assetIds.length ? admin.from('project_public_page_likes').select('asset_id').in('asset_id', assetIds) : empty,
    blockIds.length ? admin.from('project_public_page_comments').select('block_id').eq('is_hidden', false).in('block_id', blockIds) : empty,
    assetIds.length ? admin.from('project_public_page_comments').select('asset_id').eq('is_hidden', false).in('asset_id', assetIds) : empty,
    blockIds.length ? admin.from('project_public_page_views').select('block_id').in('block_id', blockIds) : empty,
    assetIds.length ? admin.from('project_public_page_views').select('asset_id').in('asset_id', assetIds) : empty,
  ])

  const maps = {
    blockLikes: aggregate(blockLikes.data, 'block_id'),
    assetLikes: aggregate(assetLikes.data, 'asset_id'),
    blockComments: aggregate(blockComments.data, 'block_id'),
    assetComments: aggregate(assetComments.data, 'asset_id'),
    blockViews: aggregate(blockViews.data, 'block_id'),
    assetViews: aggregate(assetViews.data, 'asset_id'),
  }

  return posts.map(post => {
    const isBlock = post.item_type === 'block'
    const likes = (isBlock ? maps.blockLikes : maps.assetLikes).get(post.item_id) ?? 0
    const comments = (isBlock ? maps.blockComments : maps.assetComments).get(post.item_id) ?? 0
    const views = (isBlock ? maps.blockViews : maps.assetViews).get(post.item_id) ?? 0
    return {
      ...post,
      likes_count: likes,
      comments_count: comments,
      views_count: views,
      trend_score: likes * 3 + comments * 2 + views,
    }
  })
}

async function readOptimizedFeed(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  sort: FeedSort,
  cursor: FeedCursor | null,
  candidateLimit: number,
  pageSlug: string,
  projectId: string,
  courseId: string,
) {
  let query = admin.from('public_social_feed').select('*')

  if (pageSlug) query = query.eq('page_slug', pageSlug)
  if (projectId) query = query.eq('project_id', projectId)
  if (courseId) query = query.eq('course_id', courseId)
  if (cursor && sort === 'recent') query = query.lte('published_at', cursor.publishedAt)

  query = sort === 'trending'
    ? query.order('trend_score', { ascending: false }).order('published_at', { ascending: false })
    : query.order('published_at', { ascending: false })

  const { data, error } = await query.limit(candidateLimit)
  if (error) return { posts: null, error }
  return { posts: (data ?? []).map(normalizeViewPost), error: null }
}

async function readFallbackFeed(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  sort: FeedSort,
  cursor: FeedCursor | null,
  candidateLimit: number,
  pageSlug: string,
  projectId: string,
  courseId: string,
) {
  let pageQuery = admin
    .from('project_public_pages')
    .select('id, title, slug, description, theme_color, accent_color, background_color, text_color, card_color, project_id, course_id, published_at, updated_at, projects(id, title), courses(id, name), profiles!project_public_pages_created_by_fkey(full_name)')
    .eq('is_public', true)
    .eq('status', 'published')

  if (pageSlug) pageQuery = pageQuery.eq('slug', pageSlug)
  if (projectId) pageQuery = pageQuery.eq('project_id', projectId)
  if (courseId) pageQuery = pageQuery.eq('course_id', courseId)

  const { data: pageRows, error: pageError } = await pageQuery.limit(250)
  if (pageError) throw pageError

  const pages = pageRows ?? []
  const pageIds = pages.map((page: any) => page.id)
  if (pageIds.length === 0) return []

  const pageMap = new Map(pages.map((page: any) => [String(page.id), page]))

  let blockQuery = admin
    .from('project_public_blocks')
    .select('id, page_id, type, title, content, created_at, updated_at')
    .in('page_id', pageIds)
    .order('created_at', { ascending: false })
    .limit(candidateLimit)

  let assetQuery = admin
    .from('project_public_assets')
    .select('id, page_id, file_name, file_type, title, description, created_at')
    .in('page_id', pageIds)
    .order('created_at', { ascending: false })
    .limit(candidateLimit)

  if (cursor && sort === 'recent') {
    blockQuery = blockQuery.lte('created_at', cursor.publishedAt)
    assetQuery = assetQuery.lte('created_at', cursor.publishedAt)
  }

  const [{ data: blocks, error: blockError }, { data: assets, error: assetError }] = await Promise.all([blockQuery, assetQuery])
  if (blockError) throw blockError
  if (assetError) throw assetError

  const makeBase = (page: any) => {
    const project = firstRelation<any>(page?.projects)
    const course = firstRelation<any>(page?.courses)
    const profile = firstRelation<any>(page?.profiles)
    return {
      page_id: String(page.id),
      page_slug: String(page.slug),
      page_title: String(page.title ?? 'Página pública').replace(/^Vitrina:\s*/i, '').trim(),
      page_description: page.description ?? null,
      author_name: profile?.full_name ?? 'Sello Tecnológico',
      project_id: page.project_id ?? project?.id ?? null,
      project_title: project?.title ?? null,
      course_id: page.course_id ?? course?.id ?? null,
      course_name: course?.name ?? null,
      theme_color: page.theme_color ?? '#2563eb',
      accent_color: page.accent_color ?? '#0ea5e9',
      background_color: page.background_color ?? '#f8fafc',
      text_color: page.text_color ?? '#0f172a',
      card_color: page.card_color ?? '#ffffff',
    }
  }

  const blockPosts: FeedPost[] = (blocks ?? []).flatMap((block: any) => {
    const page = pageMap.get(String(block.page_id))
    if (!page) return []
    const mediaType = block.type === 'audio' || block.type === 'podcast_episode'
      ? 'audio'
      : block.type === 'video'
        ? 'video'
        : block.type === 'gallery'
          ? 'image'
          : block.type === 'file_download'
            ? 'file'
            : 'text'
    return [{
      ...makeBase(page),
      item_type: 'block' as const,
      item_id: String(block.id),
      item_key: `block:${block.id}`,
      title: block.title ?? null,
      content: block.content ?? null,
      media_type: mediaType,
      block_type: block.type ?? 'text',
      asset_id: null,
      published_at: String(block.created_at ?? block.updated_at ?? page.published_at ?? page.updated_at),
      likes_count: 0,
      comments_count: 0,
      views_count: 0,
      trend_score: 0,
    }]
  })

  const assetPosts: FeedPost[] = (assets ?? []).flatMap((asset: any) => {
    const page = pageMap.get(String(asset.page_id))
    if (!page) return []
    return [{
      ...makeBase(page),
      item_type: 'asset' as const,
      item_id: String(asset.id),
      item_key: `asset:${asset.id}`,
      title: asset.title ?? asset.file_name ?? null,
      content: asset.description ?? null,
      media_type: asset.file_type ?? 'file',
      block_type: null,
      asset_id: String(asset.id),
      published_at: String(asset.created_at ?? page.published_at ?? page.updated_at),
      likes_count: 0,
      comments_count: 0,
      views_count: 0,
      trend_score: 0,
    }]
  })

  return addFallbackStats(admin, [...blockPosts, ...assetPosts])
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Math.min(Math.max(asNumber(url.searchParams.get('limit')) || 10, 4), 20)
  const sort: FeedSort = url.searchParams.get('sort') === 'trending' ? 'trending' : 'recent'
  const cursor = decodeCursor(url.searchParams.get('cursor'))
  const search = clean(url.searchParams.get('q'), 100)
  const type = clean(url.searchParams.get('type'), 20) || 'all'
  const pageSlug = clean(url.searchParams.get('page'), 120)
  const projectId = clean(url.searchParams.get('project'), 80)
  const courseId = clean(url.searchParams.get('course'), 80)
  const candidateLimit = sort === 'trending' ? 240 : Math.min(limit * 8, 120)
  const admin = createAdminSupabaseClient()

  try {
    const optimized = await readOptimizedFeed(admin, sort, cursor, candidateLimit, pageSlug, projectId, courseId)
    const sourcePosts = optimized.posts ?? await readFallbackFeed(admin, sort, cursor, candidateLimit, pageSlug, projectId, courseId)

    const filtered = sourcePosts
      .filter(post => matchesType(post, type))
      .filter(post => matchesSearch(post, search))
      .sort((a, b) => comparePosts(a, b, sort))
      .filter(post => !cursor || isAfterCursor(post, cursor, sort))

    const posts = filtered.slice(0, limit)
    const hasMore = filtered.length > limit
    const nextCursor = hasMore && posts.length > 0 ? encodeCursor(posts[posts.length - 1]) : null

    return NextResponse.json({ posts, hasMore, nextCursor }, {
      headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' },
    })
  } catch (error: any) {
    console.error('Error loading public social feed', error)
    return NextResponse.json({ error: error?.message ?? 'No fue posible cargar la comunidad.' }, { status: 500 })
  }
}
