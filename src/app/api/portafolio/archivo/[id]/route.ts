import { NextResponse } from 'next/server'
import { authorizeArchiveAccess, isArchiveId } from '@/lib/portfolio-archive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  if (!isArchiveId(id)) return NextResponse.json({ error: 'Registro inválido.' }, { status: 400, headers })
  const auth = await authorizeArchiveAccess(new URL(request.url).searchParams.get('owner'))
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status, headers })
  const { data, error } = await auth.admin.from('portfolio_archive_items')
    .select('id,category,source_table,source_id,title,summary,snapshot,attachment_refs,source_created_at,captured_at,source_deleted,source_deleted_at,capture_count')
    .eq('id', id).eq('owner_id', auth.ownerId).maybeSingle()
  if (error) return NextResponse.json({ error: 'No fue posible recuperar el registro.' }, { status: 503, headers })
  if (!data) return NextResponse.json({ error: 'Registro no encontrado.' }, { status: 404, headers })
  return NextResponse.json({ item: data }, { headers })
}
