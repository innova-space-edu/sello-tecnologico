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
    const { user } = await requireAdminSession()
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin.from('creative_space_works')
      .select('id,uploader_id,author_name,title,description,tags,media_type,storage_path,status,created_at,rights_confirmed,publication_basis')
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
        id: row.id, title: row.title, author: row.author_name, description: row.description, tags: row.tags ?? [],
        type: row.media_type, status: row.status, date: row.created_at,
        publicationBasis: row.publication_basis,
        canMarkInstitutional: row.status === 'pending' && row.uploader_id === user.id,
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
      .select('id,uploader_id,rights_confirmed,status,updated_at')
      .eq('id', id).maybeSingle()
    if (workError || !work || !['pending', 'published'].includes(work.status)) {
      return NextResponse.json({ error: 'Obra no disponible para revisión.' }, { status: 404 })
    }
    // La vía institucional solo puede declararla el administrador que cargó
    // el material y exige confirmación manual de ausencia de datos personales.
    const institutional = action === 'published' && body.institutionalNoPersonalData === true
    if (action === 'published') {
      if (work.status !== 'pending') {
        return NextResponse.json({ error: 'Esta obra ya fue revisada.' }, { status: 409 })
      }
      if (!work.rights_confirmed) {
        return NextResponse.json({ error: 'Falta la declaración de derechos.' }, { status: 409 })
      }
      if (institutional) {
        if (work.uploader_id !== user.id) {
          return NextResponse.json({
            error: 'Solo quien subió la obra puede certificar su carácter institucional.',
          }, { status: 403 })
        }
      } else {
        const approved = await eligiblePublicAuthors(admin, [work.uploader_id])
        if (!approved.has(work.uploader_id)) {
          return NextResponse.json({
            code: 'PUBLIC_SHOWCASE_CONSENT_REQUIRED',
            error: 'No existe autorización vigente para exhibición pública. En obras personales revisa Mis consentimientos; en obras de menores se necesita autorización familiar.',
          }, { status: 409 })
        }
      }
    }
    const reviewedAt = new Date().toISOString()
    const changes = {
      status: action,
      reviewed_at: reviewedAt,
      reviewed_by: user.id,
      published_at: action === 'published' ? reviewedAt : null, updated_at: reviewedAt,
      ...(action === 'published' ? {
        publication_basis: institutional ? 'institutional' : 'personal',
        institutional_attested_at: institutional ? reviewedAt : null,
        institutional_attested_by: institutional ? user.id : null,
      } : {}),
    }
    const { data: saved, error } = await admin.from('creative_space_works').update(changes)
      .eq('id', id).eq('status', action === 'published' ? 'pending' : work.status)
      .eq('updated_at', work.updated_at).select('id').maybeSingle()
    if (error) throw error
    if (!saved) return NextResponse.json({
      error: 'La obra cambió durante la revisión. Actualiza la lista antes de continuar.',
    }, { status: 409 })
    return NextResponse.json({ ok: true, status: action }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return failure(error)
  }
}
