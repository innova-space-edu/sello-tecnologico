import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const admin = createAdminSupabaseClient()
  let query = admin.from('courses').select('id, name, level, year, created_by').order('name')

  if (actor.role === 'docente') {
    const { data: memberships } = await admin.from('course_members').select('course_id').eq('user_id', actor.id)
    const ids = new Set((memberships ?? []).map((m) => m.course_id))
    const { data: own } = await admin.from('courses').select('id').eq('created_by', actor.id)
    for (const course of own ?? []) ids.add(course.id)
    const allowed = [...ids]
    if (allowed.length === 0) return NextResponse.json({ courses: [] }, { headers: noStoreHeaders() })
    query = query.in('id', allowed)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })

  return NextResponse.json({ courses: data ?? [] }, { headers: noStoreHeaders() })
}
