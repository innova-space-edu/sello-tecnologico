import { NextResponse } from 'next/server'
import { AdminAuthorizationError, requireAdminSession } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  try {
    await requireAdminSession()
    const db = createAdminSupabaseClient()
    const { data: surveys, error } = await db.from('online_surveys')
      .select('id,creator_id,title,description,questions,status,slug,created_at,reviewed_at')
      .in('status', ['pending_review', 'rejected'])
      .order('created_at', { ascending: false }).limit(100)
    if (error) return NextResponse.json({ error: 'No se pudieron consultar las encuestas pendientes.' }, { status: 503, headers })
    const authors = [...new Set((surveys ?? []).map(row => row.creator_id))]
    const { data: profiles, error: peopleError } = authors.length
      ? await db.from('profiles').select('id,full_name,role').in('id', authors)
      : { data: [], error: null }
    if (peopleError) return NextResponse.json({ error: 'No se pudieron comprobar los autores.' }, { status: 503, headers })
    const names = new Map((profiles ?? []).map(row => [row.id, { name: row.full_name || 'Usuario', role: row.role }]))
    return NextResponse.json({
      surveys: (surveys ?? []).map(row => ({
        ...row, author_name: names.get(row.creator_id)?.name || 'Usuario',
        author_role: names.get(row.creator_id)?.role || 'Sin rol',
      })),
    }, { headers })
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status, headers })
    return NextResponse.json({ error: 'Administración no disponible.' }, { status: 503, headers })
  }
}
