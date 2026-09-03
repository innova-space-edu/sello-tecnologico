import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

function appUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  return value.replace(/\/$/, '')
}

export async function GET(_request: Request, { params }: Context) {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const onlyofficeUrl = (process.env.ONLYOFFICE_URL || process.env.NEXT_PUBLIC_ONLYOFFICE_URL || '').replace(/\/$/, '')
  if (!onlyofficeUrl) {
    return NextResponse.json({
      error: 'Editor de Excel no configurado',
      code: 'ONLYOFFICE_NOT_CONFIGURED',
      hint: 'Configura ONLYOFFICE_URL en Vercel para habilitar la edición completa dentro de la página.',
    }, { status: 503, headers: noStoreHeaders() })
  }

  const { id } = await params
  const admin = createAdminSupabaseClient()
  const { data: workbook } = await admin
    .from('promedios_workbooks')
    .select('id, title, owner_id, storage_path, original_filename, editor_key')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle()

  if (!workbook || (actor.role !== 'admin' && workbook.owner_id !== actor.id)) {
    return NextResponse.json({ error: 'Libro no disponible' }, { status: 404, headers: noStoreHeaders() })
  }

  const { data: signed, error: signedError } = await admin.storage
    .from('promedios-workbooks')
    .createSignedUrl(workbook.storage_path, 60 * 60 * 4)
  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: signedError?.message || 'No se pudo abrir el archivo' }, { status: 500, headers: noStoreHeaders() })
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  const { error: sessionError } = await admin.from('promedios_editor_sessions').insert({
    token,
    workbook_id: workbook.id,
    user_id: actor.id,
    expires_at: expiresAt,
  })
  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500, headers: noStoreHeaders() })
  }

  const base = appUrl()
  if (!base) {
    return NextResponse.json({ error: 'Falta NEXT_PUBLIC_SITE_URL' }, { status: 503, headers: noStoreHeaders() })
  }

  return NextResponse.json({
    documentServerUrl: onlyofficeUrl,
    config: {
      document: {
        fileType: 'xlsx',
        key: workbook.editor_key,
        title: workbook.original_filename || `${workbook.title}.xlsx`,
        url: signed.signedUrl,
        permissions: {
          edit: true,
          download: true,
          print: true,
          copy: true,
          comment: true,
          fillForms: true,
        },
      },
      documentType: 'cell',
      editorConfig: {
        mode: 'edit',
        lang: 'es',
        callbackUrl: `${base}/api/promedios/editor/callback?token=${token}`,
        user: { id: actor.id, name: actor.fullName },
        customization: {
          autosave: true,
          forcesave: true,
          compactHeader: false,
          hideRightMenu: false,
          help: true,
        },
      },
      events: {},
    },
  }, { headers: noStoreHeaders() })
}
