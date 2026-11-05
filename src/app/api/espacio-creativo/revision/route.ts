import { NextResponse } from 'next/server'
import { AdminAuthorizationError, requireAdminSession } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { CREATIVE_BUCKET, eligiblePublicAuthors } from '@/lib/creative-space'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function failure(error: unknown) {
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return NextResponse.json({ error: 'No fue posible completar la revisión.' }, { status: 503 })
}

export async function GET() {
  try {
    await requireAdminSession()
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin.from('creative_space_works')
      .select('id,uploader_id,author_name,title,description,media_type,storage_path,status,created_at,rights_confirmed')
      .in('status', ['pending','published'])
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    const rows = data ?? []
    const { data: urls, error: signError } = rows.length
      ? await admin.storage.from(CREATIVE_BUCKET).createSignedUrls(rows.map(row => row.storage_path), 1200)
      : { data: [], error: null }
    if (signError) throw signError
    const byPath = new Map((urls ?? []).map(url => [url.path, url.signedUrl]))
    return NextResponse.json({
      works: rows.map(row => ({
        id: row.id, title: row.title, author: row.author_name, description: row.description,
        type: row.media_type, status: row.status, date: row.created_at,
        url: byPath.get(row.storage_path) ?? null,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return failure(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireAdminSession()
    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    const action = body.action === 'publish' ? 'published'
      : body.action === 'reject' ? 'rejected' : ''
    if (!/^[0-9a-f-]{36}$/i.test(id) || !action) {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data: work, error: workError } = await admin.from('creative_space_works')
      .select('id,uploader_id,rights_confirmed,status')
      .eq('id', id).maybeSingle()
    if (workError || !work || !['pending', 'published'].includes(work.status)) {
      return NextResponse.json({ error: 'Obra no disponible para revisión.' }, { status: 404 })
    }
    if (action === 'published') {
      if (!work.rights_confirmed) {
        return NextResponse.json({ error: 'Falta la declaración de derechos.' }, { status: 409 })
      }
      const approved = await eligiblePublicAuthors(admin, [work.uploader_id])
      if (!approved.has(work.uploader_id)) {
        return NextResponse.json({
          error: 'No existe autorización vigente para exhibición pública. Verifica la decisión del titular o representante.',
        }, { status: 409 })
      }
    }
    const { error } = await admin.from('creative_space_works').update({
      status: action, reviewed_at: new Date().toISOString(), reviewed_by: user.id,
      published_at: action === 'published' ? new Date().toISOString() : null,
    }).eq('id', id).in('status', ['pending','published'])
    if (error) throw error
    return NextResponse.json({ ok: true, status: action }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return failure(error)
  }
}
