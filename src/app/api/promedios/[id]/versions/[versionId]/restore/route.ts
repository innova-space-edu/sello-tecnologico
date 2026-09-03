import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string; versionId: string }> }

export async function POST(_request: Request, { params }: Context) {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const { id, versionId } = await params
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

  const { data: version } = await admin
    .from('promedios_workbook_versions')
    .select('id, version_no, storage_path')
    .eq('id', versionId)
    .eq('workbook_id', id)
    .maybeSingle()
  if (!version) return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404, headers: noStoreHeaders() })

  const { data: current } = await admin.storage.from('promedios-workbooks').download(workbook.storage_path)
  if (!current) return NextResponse.json({ error: 'No se pudo respaldar la versión actual' }, { status: 500, headers: noStoreHeaders() })

  const { data: latest } = await admin
    .from('promedios_workbook_versions')
    .select('version_no')
    .eq('workbook_id', id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  const backupNo = (latest?.version_no ?? 0) + 1
  const backupPath = `${workbook.owner_id}/${id}/versions/v${String(backupNo).padStart(4, '0')}.xlsx`
  const currentBytes = Buffer.from(await current.arrayBuffer())
  const { error: backupError } = await admin.storage.from('promedios-workbooks').upload(backupPath, currentBytes, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    cacheControl: '0',
    upsert: false,
  })
  if (backupError) return NextResponse.json({ error: backupError.message }, { status: 500, headers: noStoreHeaders() })
  await admin.from('promedios_workbook_versions').insert({
    workbook_id: id,
    version_no: backupNo,
    storage_path: backupPath,
    saved_by: actor.id,
  })

  const { data: oldFile, error: oldError } = await admin.storage.from('promedios-workbooks').download(version.storage_path)
  if (oldError || !oldFile) return NextResponse.json({ error: oldError?.message || 'No se pudo leer la versión' }, { status: 500, headers: noStoreHeaders() })
  const oldBytes = Buffer.from(await oldFile.arrayBuffer())
  const { error: restoreError } = await admin.storage.from('promedios-workbooks').upload(workbook.storage_path, oldBytes, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    cacheControl: '0',
    upsert: true,
  })
  if (restoreError) return NextResponse.json({ error: restoreError.message }, { status: 500, headers: noStoreHeaders() })

  await admin.from('promedios_workbooks').update({
    updated_at: new Date().toISOString(),
    last_saved_at: new Date().toISOString(),
    editor_key: crypto.randomUUID(),
  }).eq('id', id)
  await admin.from('promedios_editor_sessions').delete().eq('workbook_id', id)

  return NextResponse.json({ ok: true, restoredVersion: version.version_no }, { headers: noStoreHeaders() })
}
