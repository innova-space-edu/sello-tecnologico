import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'promedios-workbooks'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function allowedOrigins() {
  const values = [process.env.ONLYOFFICE_URL, process.env.NEXT_PUBLIC_ONLYOFFICE_URL, process.env.ONLYOFFICE_DOWNLOAD_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return new Set(values.map((value) => {
    try { return new URL(value).origin } catch { return value }
  }))
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 1 }, { status: 403, headers: noStoreHeaders() })

  const admin = createAdminSupabaseClient()
  const { data: session } = await admin
    .from('promedios_editor_sessions')
    .select('token, workbook_id, user_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 1 }, { status: 403, headers: noStoreHeaders() })
  }

  let body: { status?: number; url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 1 }, { status: 400, headers: noStoreHeaders() })
  }

  const status = Number(body.status)
  if (![2, 6].includes(status)) {
    return NextResponse.json({ error: 0 }, { headers: noStoreHeaders() })
  }

  if (!body.url) return NextResponse.json({ error: 1 }, { status: 400, headers: noStoreHeaders() })

  let downloadUrl: URL
  try { downloadUrl = new URL(body.url) } catch {
    return NextResponse.json({ error: 1 }, { status: 400, headers: noStoreHeaders() })
  }
  const origins = allowedOrigins()
  if (origins.size > 0 && !origins.has(downloadUrl.origin)) {
    return NextResponse.json({ error: 1 }, { status: 403, headers: noStoreHeaders() })
  }

  const { data: workbook } = await admin
    .from('promedios_workbooks')
    .select('id, owner_id, storage_path')
    .eq('id', session.workbook_id)
    .is('archived_at', null)
    .maybeSingle()
  if (!workbook) return NextResponse.json({ error: 1 }, { status: 404, headers: noStoreHeaders() })

  const response = await fetch(downloadUrl, { cache: 'no-store', redirect: 'follow' })
  if (!response.ok) return NextResponse.json({ error: 1 }, { status: 502, headers: noStoreHeaders() })
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length === 0 || bytes.length > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 1 }, { status: 400, headers: noStoreHeaders() })
  }

  const { data: latestVersion } = await admin
    .from('promedios_workbook_versions')
    .select('version_no')
    .eq('workbook_id', workbook.id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (latestVersion?.version_no ?? 0) + 1
  const versionPath = `${workbook.owner_id}/${workbook.id}/versions/v${String(nextVersion).padStart(4, '0')}.xlsx`

  const { error: copyError } = await admin.storage.from(BUCKET).copy(workbook.storage_path, versionPath)
  if (!copyError) {
    await admin.from('promedios_workbook_versions').insert({
      workbook_id: workbook.id,
      version_no: nextVersion,
      storage_path: versionPath,
      saved_by: session.user_id,
    })
  }

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(workbook.storage_path, bytes, {
    contentType: XLSX_MIME,
    cacheControl: '0',
    upsert: true,
  })
  if (uploadError) return NextResponse.json({ error: 1 }, { status: 500, headers: noStoreHeaders() })

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_saved_at: new Date().toISOString(),
  }
  if (status === 2) update.editor_key = crypto.randomUUID()
  await admin.from('promedios_workbooks').update(update).eq('id', workbook.id)

  if (status === 2) {
    await admin.from('promedios_editor_sessions').delete().eq('token', token)
  }

  return NextResponse.json({ error: 0 }, { headers: noStoreHeaders() })
}
