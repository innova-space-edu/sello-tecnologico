import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_BYTES = 50 * 1024 * 1024

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Context) {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const { id } = await params
  const admin = createAdminSupabaseClient()
  const { data: workbook } = await admin
    .from('promedios_workbooks')
    .select('id, owner_id, storage_path')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle()

  if (!workbook || (actor.role !== 'admin' && workbook.owner_id !== actor.id)) {
    return NextResponse.json({ error: 'Libro no disponible' }, { status: 404, headers: noStoreHeaders() })
  }

  const body = Buffer.from(await request.arrayBuffer())
  if (body.length <= 0 || body.length > MAX_BYTES) {
    return NextResponse.json({ error: 'El libro debe pesar entre 1 byte y 50 MB' }, { status: 400, headers: noStoreHeaders() })
  }
  if (body[0] !== 0x50 || body[1] !== 0x4b) {
    return NextResponse.json({ error: 'El contenido recibido no es un archivo .xlsx válido' }, { status: 400, headers: noStoreHeaders() })
  }

  const { data: current, error: currentError } = await admin.storage
    .from('promedios-workbooks')
    .download(workbook.storage_path)
  if (currentError || !current) {
    return NextResponse.json({ error: currentError?.message || 'No se pudo respaldar el libro actual' }, { status: 500, headers: noStoreHeaders() })
  }

  const { data: latest } = await admin
    .from('promedios_workbook_versions')
    .select('version_no')
    .eq('workbook_id', id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle()

  const versionNo = (latest?.version_no ?? 0) + 1
  const versionPath = `${workbook.owner_id}/${id}/versions/v${String(versionNo).padStart(4, '0')}.xlsx`
  const currentBytes = Buffer.from(await current.arrayBuffer())
  const { error: versionUploadError } = await admin.storage
    .from('promedios-workbooks')
    .upload(versionPath, currentBytes, { contentType: XLSX_MIME, cacheControl: '0', upsert: false })
  if (versionUploadError) {
    return NextResponse.json({ error: versionUploadError.message }, { status: 500, headers: noStoreHeaders() })
  }

  const { error: versionInsertError } = await admin.from('promedios_workbook_versions').insert({
    workbook_id: id,
    version_no: versionNo,
    storage_path: versionPath,
    saved_by: actor.id,
  })
  if (versionInsertError) {
    await admin.storage.from('promedios-workbooks').remove([versionPath])
    return NextResponse.json({ error: versionInsertError.message }, { status: 500, headers: noStoreHeaders() })
  }

  const { error: uploadError } = await admin.storage
    .from('promedios-workbooks')
    .upload(workbook.storage_path, body, { contentType: XLSX_MIME, cacheControl: '0', upsert: true })
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500, headers: noStoreHeaders() })
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin.from('promedios_workbooks').update({
    updated_at: now,
    last_saved_at: now,
    editor_key: crypto.randomUUID(),
  }).eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500, headers: noStoreHeaders() })

  await admin.from('promedios_editor_sessions').delete().eq('workbook_id', id)

  return NextResponse.json({ ok: true, versionNo, savedAt: now }, { headers: noStoreHeaders() })
}
