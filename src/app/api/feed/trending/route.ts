import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

function cleanTitle(title: string) {
  return String(title ?? '').replace(/^Vitrina:\s*/i, '').trim()
}

export async function GET() {
  const admin = createAdminSupabaseClient()

  const { data, error } = await admin
    .from('project_public_page_trending')
    .select('id, title, slug, description, theme_color, accent_color, likes_count, views_count, comments_count, trend_score, published_at')
    .order('trend_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(8)

  if (!error) {
    return NextResponse.json({
      trending: (data ?? []).map((page: any) => ({
        ...page,
        title: cleanTitle(page.title),
        likes_count: Number(page.likes_count ?? 0),
        views_count: Number(page.views_count ?? 0),
        comments_count: Number(page.comments_count ?? 0),
        trend_score: Number(page.trend_score ?? 0),
      })),
    }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=90' } })
  }

  const { data: pages, error: fallbackError } = await admin
    .from('project_public_pages')
    .select('id, title, slug, description, theme_color, accent_color, published_at')
    .eq('is_public', true)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(8)

  if (fallbackError) {
    return NextResponse.json({ error: fallbackError.message }, { status: 500 })
  }

  return NextResponse.json({
    trending: (pages ?? []).map((page: any) => ({
      ...page,
      title: cleanTitle(page.title),
      likes_count: 0,
      views_count: 0,
      comments_count: 0,
      trend_score: 0,
    })),
  }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=90' } })
}
