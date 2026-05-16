import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const reportType = typeof body?.report_type === 'string' ? body.report_type.slice(0, 80) : 'reportes-admin'
    const filters = body?.filters && typeof body.filters === 'object' ? body.filters : {}
    const summary = body?.summary && typeof body.summary === 'object' ? body.summary : {}

    const supabaseAdmin = createAdminSupabaseClient()
    const { error } = await supabaseAdmin.from('report_downloads').insert({
      user_id: user.id,
      report_type: reportType,
      filters,
      summary,
      user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
    })

    if (error) {
      console.warn('[report-download] no se pudo registrar:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.warn('[report-download] error:', error?.message ?? error)
    return NextResponse.json({ ok: false, error: error?.message ?? 'Error interno' }, { status: 200 })
  }
}
