import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

export const runtime = 'nodejs'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const actor = await getSurveyActor()
  if (!actor) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const { id } = await params
  const admin = createAdminSupabaseClient()

  const { data: attachment } = await admin
    .from('message_attachments')
    .select('id, batch_id, storage_bucket, storage_path, file_name, uploader_id')
    .eq('id', id)
    .single()

  if (!attachment) {
    return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 })
  }

  let authorized = actor.role === 'admin' || attachment.uploader_id === actor.id

  if (!authorized && attachment.batch_id) {
    const { count } = await admin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', attachment.batch_id)
      .or(`sender_id.eq.${actor.id},receiver_id.eq.${actor.id}`)

    authorized = (count ?? 0) > 0
  }

  if (!authorized) {
    return NextResponse.json({ error: 'No tienes permiso para descargar este archivo.' }, { status: 403 })
  }

  const { data: signed, error } = await admin.storage
    .from(attachment.storage_bucket)
    .createSignedUrl(attachment.storage_path, 120, {
      download: attachment.file_name,
    })

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'No fue posible generar el enlace de descarga.' }, { status: 400 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
