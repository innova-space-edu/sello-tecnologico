import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const ALLOWED_EVENTS = new Set(['page_view', 'login', 'logout', 'register', 'eduai_open', 'report_view'])

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null
  return request.headers.get('x-real-ip') ?? null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const eventType = ALLOWED_EVENTS.has(body?.event_type) ? body.event_type : 'page_view'
    const pathname = typeof body?.pathname === 'string' ? body.pathname.slice(0, 300) : '/'
    const metadata = body?.metadata && typeof body.metadata === 'object' ? body.metadata : {}

    const supabaseAdmin = createAdminSupabaseClient()
    const { error } = await supabaseAdmin.from('user_access_logs').insert({
      user_id: user.id,
      event_type: eventType,
      pathname,
      user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      ip_address: getClientIp(request),
      metadata,
    })

    if (error) {
      console.warn('[access-log] no se pudo registrar:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.warn('[access-log] error:', error?.message ?? error)
    return NextResponse.json({ ok: false, error: error?.message ?? 'Error interno' }, { status: 200 })
  }
}
