import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const STORY_BUCKET = 'community-stories'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
])

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

async function getOptionalUser() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const admin = createAdminSupabaseClient()
  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20), 1), 30)
  const requestedId = clean(url.searchParams.get('id'), 80)
  const visitorKey = clean(url.searchParams.get('visitorKey'), 120)
  const user = await getOptionalUser()
  const now = new Date().toISOString()

  let query = admin
    .from('community_stories')
    .select('id, author_id, project_id, page_id, course_id, title, caption, visibility_status, review_status, is_featured, comments_enabled, expires_at, published_at')
    .eq('visibility_status', 'published')
    .or(`is_featured.eq.true,expires_at.gt.${now}`)
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit)

  if (requestedId && UUID_RE.test(requestedId)) query = query.eq('id', requestedId)

  const { data: storyRows, error: storyError } = await query
  if (storyError) return NextResponse.json({ error: storyError.message }, { status: 500 })

  const rows = (storyRows ?? []) as any[]
  if (rows.length === 0) return NextResponse.json({ stories: [] }, { headers: { 'Cache-Control': 'no-store' } })

  const storyIds = rows.map(row => row.id)
  const authorIds = Array.from(new Set(rows.map(row => row.author_id).filter(Boolean)))
  const projectIds = Array.from(new Set(rows.map(row => row.project_id).filter(Boolean)))
  const pageIds = Array.from(new Set(rows.map(row => row.page_id).filter(Boolean)))
  const courseIds = Array.from(new Set(rows.map(row => row.course_id).filter(Boolean)))

  const [itemsResult, reactionsResult, commentsResult, viewsResult, authorsResult, projectsResult, pagesResult, coursesResult] = await Promise.all([
    admin.from('community_story_items').select('*').in('story_id', storyIds).order('sort_order'),
    admin.from('community_story_reactions').select('story_id, emoji, profile_id, visitor_key').in('story_id', storyIds),
    admin.from('community_story_comments').select('id, story_id, profile_id, visitor_name, content, created_at').in('story_id', storyIds).eq('is_hidden', false).order('created_at', { ascending: false }).limit(150),
    admin.from('community_story_views').select('story_id').in('story_id', storyIds),
    authorIds.length ? admin.from('profiles').select('id, full_name').in('id', authorIds) : Promise.resolve({ data: [] as any[], error: null }),
    projectIds.length ? admin.from('projects').select('id, title').in('id', projectIds) : Promise.resolve({ data: [] as any[], error: null }),
    pageIds.length ? admin.from('project_public_pages').select('id, title, slug').in('id', pageIds) : Promise.resolve({ data: [] as any[], error: null }),
    courseIds.length ? admin.from('courses').select('id, name').in('id', courseIds) : Promise.resolve({ data: [] as any[], error: null }),
  ])

  const items = (itemsResult.data ?? []) as any[]
  const reactions = (reactionsResult.data ?? []) as any[]
  const comments = (commentsResult.data ?? []) as any[]
  const views = (viewsResult.data ?? []) as any[]
  const commentProfileIds = Array.from(new Set(comments.map(row => row.profile_id).filter(Boolean)))
  const { data: commentProfiles } = commentProfileIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', commentProfileIds)
    : { data: [] as any[] }

  const paths = Array.from(new Set(items.map(item => item.storage_path).filter(Boolean)))
  const { data: signedRows } = paths.length
    ? await admin.storage.from(STORY_BUCKET).createSignedUrls(paths, 60 * 60)
    : { data: [] as any[] }
  const signedByPath = new Map((signedRows ?? []).map((entry: any) => [entry.path, entry.signedUrl ?? '']))

  const authors = new Map(((authorsResult as any).data ?? []).map((row: any) => [row.id, row.full_name]))
  const projects = new Map(((projectsResult as any).data ?? []).map((row: any) => [row.id, row.title]))
  const pages = new Map(((pagesResult as any).data ?? []).map((row: any) => [row.id, String(row.title ?? '').replace(/^Vitrina:\s*/i, '')]))
  const courses = new Map(((coursesResult as any).data ?? []).map((row: any) => [row.id, row.name]))
  const commentNames = new Map((commentProfiles ?? []).map((row: any) => [row.id, row.full_name]))

  const stories = rows.map(row => {
    const storyReactions = reactions.filter(item => item.story_id === row.id)
    const reactionCounts: Record<string, number> = { '❤️': 0, '👏': 0, '🔥': 0, '🌱': 0, '💡': 0, '🚀': 0, '😂': 0, '😮': 0 }
    storyReactions.forEach(item => { reactionCounts[item.emoji] = (reactionCounts[item.emoji] ?? 0) + 1 })
    const viewerReaction = storyReactions.find(item => user ? item.profile_id === user.id : visitorKey && item.visitor_key === visitorKey)?.emoji ?? null
    const storyComments = comments
      .filter(item => item.story_id === row.id)
      .slice(0, 20)
      .map(item => ({
        id: item.id,
        content: item.content,
        visitor_name: item.visitor_name,
        author_name: item.profile_id ? (commentNames.get(item.profile_id) ?? 'Usuario') : (item.visitor_name || 'Visitante'),
        created_at: item.created_at,
      }))

    return {
      ...row,
      author_name: authors.get(row.author_id) ?? 'Comunidad Sello Tecnológico',
      project_title: row.project_id ? projects.get(row.project_id) ?? null : null,
      page_title: row.page_id ? pages.get(row.page_id) ?? null : null,
      course_name: row.course_id ? courses.get(row.course_id) ?? null : null,
      items: items
        .filter(item => item.story_id === row.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(item => ({
          id: item.id,
          media_type: item.media_type,
          file_name: item.file_name,
          mime_type: item.mime_type,
          file_size: item.file_size,
          width: item.width,
          height: item.height,
          duration_seconds: item.duration_seconds,
          sort_order: item.sort_order,
          signed_url: signedByPath.get(item.storage_path) ?? '',
        })),
      reactions: reactionCounts,
      reactions_count: storyReactions.length,
      comments_count: comments.filter(item => item.story_id === row.id).length,
      views_count: views.filter(item => item.story_id === row.id).length,
      viewer_reaction: viewerReaction,
      comments: storyComments,
    }
  })

  return NextResponse.json({ stories }, { headers: { 'Cache-Control': 'no-store' } })
}

type CreateStoryBody = {
  id?: string
  title?: string
  caption?: string
  pageId?: string | null
  projectId?: string | null
  courseId?: string | null
  items?: Array<{
    mediaType?: string
    storagePath?: string
    fileName?: string
    mimeType?: string
    fileSize?: number
    width?: number
    height?: number
    durationSeconds?: number
  }>
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión para publicar una historia.' }, { status: 401 })

  const admin = createAdminSupabaseClient()
  const body = await request.json().catch(() => ({})) as CreateStoryBody
  const storyId = clean(body.id, 80)
  if (!UUID_RE.test(storyId)) return NextResponse.json({ error: 'Identificador de historia inválido.' }, { status: 400 })

  const { data: profile } = await admin.from('profiles').select('id, blocked').eq('id', user.id).maybeSingle()
  if (!profile?.id || profile.blocked) return NextResponse.json({ error: 'Tu cuenta no está habilitada para publicar.' }, { status: 403 })

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 10) : []
  if (rawItems.length === 0) return NextResponse.json({ error: 'Selecciona al menos una imagen o video.' }, { status: 400 })

  const expectedPrefix = `${user.id}/${storyId}/`
  const items = rawItems.map((item, index) => {
    const mediaType = item.mediaType === 'video' ? 'video' : item.mediaType === 'image' ? 'image' : ''
    const storagePath = clean(item.storagePath, 500)
    const mimeType = clean(item.mimeType, 120)
    const fileSize = numberOrNull(item.fileSize)
    if (!mediaType || !storagePath.startsWith(expectedPrefix) || !ALLOWED_MIME.has(mimeType)) throw new Error('Uno de los archivos no es válido.')
    if (fileSize !== null && fileSize > 50 * 1024 * 1024) throw new Error('Cada archivo debe pesar como máximo 50 MB.')
    return {
      story_id: storyId,
      media_type: mediaType,
      storage_bucket: STORY_BUCKET,
      storage_path: storagePath,
      file_name: clean(item.fileName, 240) || `archivo-${index + 1}`,
      mime_type: mimeType,
      file_size: fileSize,
      width: numberOrNull(item.width),
      height: numberOrNull(item.height),
      duration_seconds: numberOrNull(item.durationSeconds),
      sort_order: index,
    }
  })

  let pageId = body.pageId && UUID_RE.test(body.pageId) ? body.pageId : null
  let projectId = body.projectId && UUID_RE.test(body.projectId) ? body.projectId : null
  let courseId = body.courseId && UUID_RE.test(body.courseId) ? body.courseId : null

  if (pageId) {
    const { data: page } = await admin.from('project_public_pages').select('id, project_id, course_id').eq('id', pageId).maybeSingle()
    if (!page?.id) pageId = null
    else {
      projectId = page.project_id ?? projectId
      courseId = page.course_id ?? courseId
    }
  }

  const storyRow = {
    id: storyId,
    author_id: user.id,
    page_id: pageId,
    project_id: projectId,
    course_id: courseId,
    title: clean(body.title, 120) || null,
    caption: clean(body.caption, 600) || null,
    visibility_status: 'published',
    review_status: 'pending',
    published_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  }

  const { error: storyError } = await admin.from('community_stories').insert(storyRow)
  if (storyError) return NextResponse.json({ error: storyError.message }, { status: 400 })

  const { error: itemsError } = await admin.from('community_story_items').insert(items)
  if (itemsError) {
    await admin.from('community_stories').delete().eq('id', storyId)
    await admin.storage.from(STORY_BUCKET).remove(items.map(item => item.storage_path))
    return NextResponse.json({ error: itemsError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, id: storyId, visibility_status: 'published', review_status: 'pending' }, { status: 201 })
}
