import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { authorizeArchiveAccess, isArchiveCategory } from '@/lib/portfolio-archive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get('owner')
  const auth = await authorizeArchiveAccess(owner)
  if ('error' in auth) return fail(auth.error, auth.status)
  const params = request.nextUrl.searchParams
  const category = params.get('category') || 'todos'
  if (!isArchiveCategory(category)) return fail('Categoría inválida.', 400)
  const rawPage = Number(params.get('page') || '0')
  if (!Number.isSafeInteger(rawPage) || rawPage < 0 || rawPage > 1000) return fail('Página inválida.', 400)
  const search = (params.get('q') || '').trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '').slice(0, 70)
  const deleted = params.get('deleted') === 'true'
  const PAGE_SIZE = 24
  let query = auth.admin.from('portfolio_archive_items')
    .select('id,source_table,category,title,summary,source_created_at,captured_at,source_deleted,source_deleted_at,attachment_refs,capture_count', { count: 'exact' })
    .eq('owner_id', auth.ownerId)
  if (category !== 'todos') query = query.eq('category', category)
  if (deleted) query = query.eq('source_deleted', true)
  if (search) query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`)
  const { data, error, count } = await query
    .order('source_created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(rawPage * PAGE_SIZE, (rawPage + 1) * PAGE_SIZE - 1)
  if (error) return fail('No fue posible consultar el archivo.', 503)
  return NextResponse.json({
    items: data ?? [], total: count ?? 0, page: rawPage, pageSize: PAGE_SIZE,
    hasMore: (rawPage + 1) * PAGE_SIZE < (count ?? 0),
  }, { headers })
}
