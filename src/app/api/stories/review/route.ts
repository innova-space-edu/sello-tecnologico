import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const STAFF = ['admin','docente','coordinador','utp']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function actor() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin.from('profiles').select('id, role, full_name').eq('id', user.id).maybeSingle()
  if (!profile?.id || !STAFF.includes(profile.role)) return null
  return { user, profile, admin }
}

export async function GET(request: Request) {
  const current = await actor()
  if (!current) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })

  const url = new URL(request.url)
  const countOnly = url.searchParams.get('count') === '1'
  if (countOnly) {
    const { count } = await current.admin
      .from('community_stories')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'pending')
      .eq('visibility_status', 'published')
    return NextResponse.json({ count: count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const { data: stories, error } = await current.admin
    .from('community_stories')
    .select('*')
    .in('review_status', ['pending','flagged','correction_requested'])
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = stories ?? []
  const ids = rows.map((row: any) => row.id)
  const authorIds = Array.from(new Set(rows.map((row: any) => row.author_id).filter(Boolean)))
  const pageIds = Array.from(new Set(rows.map((row: any) => row.page_id).filter(Boolean)))
  const [itemsResult, profilesResult, pagesResult] = await Promise.all([
    ids.length ? current.admin.from('community_story_items').select('*').in('story_id', ids).order('sort_order') : Promise.resolve({ data: [] as any[] }),
    authorIds.length ? current.admin.from('profiles').select('id, full_name, email, role').in('id', authorIds) : Promise.resolve({ data: [] as any[] }),
    pageIds.length ? current.admin.from('project_public_pages').select('id, title, slug').in('id', pageIds) : Promise.resolve({ data: [] as any[] }),
  ])

  const items = itemsResult.data ?? []
  const profiles = new Map((profilesResult.data ?? []).map((row: any) => [row.id, row]))
  const pages = new Map((pagesResult.data ?? []).map((row: any) => [row.id, { ...row, title: String(row.title ?? '').replace(/^Vitrina:\s*/i, '') }]))
  const paths = items.map((item: any) => item.storage_path)
  const { data: signed } = paths.length ? await current.admin.storage.from('community-stories').createSignedUrls(paths, 60 * 30) : { data: [] as any[] }
  const urls = new Map((signed ?? []).map((row: any) => [row.path, row.signedUrl ?? '']))

  return NextResponse.json({
    stories: rows.map((row: any) => ({
      ...row,
      author: profiles.get(row.author_id) ?? null,
      page: row.page_id ? pages.get(row.page_id) ?? null : null,
      items: items.filter((item: any) => item.story_id === row.id).map((item: any) => ({ ...item, signed_url: urls.get(item.storage_path) ?? '' })),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

type ReviewBody = {
  id?: string
  action?: 'reviewed' | 'hide' | 'restore' | 'feature' | 'unfeature' | 'correction'
}

export async function POST(request: Request) {
  const current = await actor()
  if (!current) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as ReviewBody
  const id = String(body.id ?? '')
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Historia inválida.' }, { status: 400 })

  const now = new Date().toISOString()
  let updates: Record<string, unknown> = {}
  if (body.action === 'reviewed') updates = { review_status: 'reviewed', reviewed_by: current.user.id, reviewed_at: now }
  else if (body.action === 'hide') updates = { visibility_status: 'hidden', review_status: 'flagged', reviewed_by: current.user.id, reviewed_at: now }
  else if (body.action === 'restore') updates = { visibility_status: 'published', review_status: 'reviewed', reviewed_by: current.user.id, reviewed_at: now }
  else if (body.action === 'feature') updates = { is_featured: true, review_status: 'reviewed', reviewed_by: current.user.id, reviewed_at: now }
  else if (body.action === 'unfeature') updates = { is_featured: false }
  else if (body.action === 'correction') updates = { review_status: 'correction_requested', reviewed_by: current.user.id, reviewed_at: now }
  else return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })

  const { data, error } = await current.admin.from('community_stories').update(updates).eq('id', id).select('id, visibility_status, review_status, is_featured').maybeSingle()
  if (error || !data?.id) return NextResponse.json({ error: error?.message ?? 'Historia no encontrada.' }, { status: 400 })

  if (['reviewed','hide','restore','feature','correction'].includes(body.action ?? '')) {
    await current.admin.from('user_notifications').update({ is_read: true, read_at: now, updated_at: now }).eq('source_type', 'story').eq('source_id', id)
  }

  return NextResponse.json({ ok: true, story: data })
}
