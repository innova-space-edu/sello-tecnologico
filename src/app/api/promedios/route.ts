import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const admin = createAdminSupabaseClient()
  let query = admin
    .from('promedios_workbooks')
    .select('id, title, course_id, original_filename, display_mode, created_at, updated_at, last_saved_at, courses(name)')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })

  if (actor.role !== 'admin') query = query.eq('owner_id', actor.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })

  return NextResponse.json({ workbooks: data ?? [] }, { headers: noStoreHeaders() })
}
