import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Context) {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const { id } = await params
  const admin = createAdminSupabaseClient()
  const { data: workbook } = await admin
    .from('promedios_workbooks')
    .select('id, title, owner_id, storage_path, original_filename')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle()

  if (!workbook || (actor.role !== 'admin' && workbook.owner_id !== actor.id)) {
    return NextResponse.json({ error: 'Libro no disponible' }, { status: 404, headers: noStoreHeaders() })
  }

  const { data, error } = await admin.storage.from('promedios-workbooks').download(workbook.storage_path)
  if (error || !data) return NextResponse.json({ error: error?.message || 'No se pudo descargar' }, { status: 500, headers: noStoreHeaders() })

  const bytes = Buffer.from(await data.arrayBuffer())
  const filename = (workbook.original_filename || `${workbook.title}.xlsx`).replace(/["\r\n]/g, '')
  return new NextResponse(bytes, {
    headers: noStoreHeaders({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(bytes.length),
    }),
  })
}
