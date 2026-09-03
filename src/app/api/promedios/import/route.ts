import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canAccessCourse, getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_BYTES = 50 * 1024 * 1024

function cleanFilename(value: string) {
  const base = value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return (base || 'promedios.xlsx').slice(0, 120)
}

export async function POST(request: NextRequest) {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const form = await request.formData()
  const file = form.get('file')
  const title = String(form.get('title') ?? '').trim()
  const courseId = String(form.get('courseId') ?? '').trim() || null
  const displayMode = form.get('displayMode') === 'name' ? 'name' : 'alias'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Debes seleccionar un archivo .xlsx' }, { status: 400, headers: noStoreHeaders() })
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Solo se permiten archivos .xlsx' }, { status: 400, headers: noStoreHeaders() })
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo debe pesar entre 1 byte y 50 MB' }, { status: 400, headers: noStoreHeaders() })
  }
  if (!title || title.length > 160) {
    return NextResponse.json({ error: 'Ingresa un título de hasta 160 caracteres' }, { status: 400, headers: noStoreHeaders() })
  }
  if (courseId && !(await canAccessCourse(actor, courseId))) {
    return NextResponse.json({ error: 'No tienes acceso a ese curso' }, { status: 403, headers: noStoreHeaders() })
  }

  const id = crypto.randomUUID()
  const filename = cleanFilename(file.name)
  const storagePath = `${actor.id}/${id}/current.xlsx`
  const bytes = Buffer.from(await file.arrayBuffer())
  const admin = createAdminSupabaseClient()

  const { error: uploadError } = await admin.storage
    .from('promedios-workbooks')
    .upload(storagePath, bytes, { contentType: XLSX_MIME, upsert: false, cacheControl: '0' })
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500, headers: noStoreHeaders() })
  }

  const { error: insertError } = await admin.from('promedios_workbooks').insert({
    id,
    title,
    course_id: courseId,
    owner_id: actor.id,
    storage_path: storagePath,
    original_filename: filename,
    display_mode: displayMode,
  })

  if (insertError) {
    await admin.storage.from('promedios-workbooks').remove([storagePath])
    return NextResponse.json({ error: insertError.message }, { status: 500, headers: noStoreHeaders() })
  }

  return NextResponse.json({ id }, { status: 201, headers: noStoreHeaders() })
}
