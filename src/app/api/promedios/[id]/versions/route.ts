import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Context) {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const { id } = await params
  const admin = createAdminSupabaseClient()
  const { data: workbook } = await admin
    .from('promedios_workbooks')
    .select('id, owner_id')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle()

  if (!workbook || (actor.role !== 'admin' && workbook.owner_id !== actor.id)) {
    return NextResponse.json({ error: 'Libro no disponible' }, { status: 404, headers: noStoreHeaders() })
  }

  const { data, error } = await admin
    .from('promedios_workbook_versions')
    .select('id, version_no, created_at, saved_by, profiles:saved_by(full_name)')
    .eq('workbook_id', id)
    .order('version_no', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })
  return NextResponse.json({ versions: data ?? [] }, { headers: noStoreHeaders() })
}
