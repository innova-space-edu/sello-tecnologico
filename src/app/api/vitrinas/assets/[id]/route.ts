import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const admin = createAdminSupabaseClient()

  const { data: asset } = await admin
    .from('project_public_assets')
    .select('id, page_id, storage_bucket, storage_path, file_name')
    .eq('id', id)
    .single()

  if (!asset) {
    return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 })
  }

  const { data: page } = await admin
    .from('project_public_pages')
    .select('id, status, is_public, created_by')
    .eq('id', asset.page_id)
    .single()

  if (!page) {
    return NextResponse.json({ error: 'Página no encontrada.' }, { status: 404 })
  }

  let authorized = page.is_public === true && page.status === 'published'

  if (!authorized) {
    const actor = await getSurveyActor()
    authorized = Boolean(actor && (
      actor.id === page.created_by ||
      ['admin', 'docente', 'coordinador', 'utp'].includes(actor.role)
    ))
  }

  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  }

  const { data: signed, error } = await admin.storage
    .from(asset.storage_bucket)
    .createSignedUrl(asset.storage_path, 300)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'No fue posible generar el enlace.' }, { status: 400 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
