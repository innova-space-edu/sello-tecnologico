import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import {
  CREATIVE_BUCKET, CREATIVE_MAX_BYTES, CREATIVE_MIMES,
  CREATIVE_EXTENSIONS, eligiblePublicAuthors, shortText,
} from '@/lib/creative-space'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }
const allowedRoles = new Set(['admin', 'docente', 'coordinador', 'utp', 'estudiante'])

export async function GET() {
  try {
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin.from('creative_space_works')
      .select('id,uploader_id,author_name,title,description,media_type,storage_path,created_at,published_at,publication_basis')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(80)
    if (error) throw error

    const rows = data ?? []
    // Obras institucionales verificadas no dependen de consentimiento personal
    // del usuario que las subió. Las obras personales sí se revalidan siempre.
    const personal = rows.filter(row => row.publication_basis !== 'institutional')
    const allowed = await eligiblePublicAuthors(admin, personal.map(row => row.uploader_id))
    const visible = rows.filter(row =>
      row.publication_basis === 'institutional' || allowed.has(row.uploader_id))
    if (!visible.length) return NextResponse.json({ works: [] }, { headers: noStore })

    const { data: links, error: linkError } = await admin.storage
      .from(CREATIVE_BUCKET).createSignedUrls(visible.map(row => row.storage_path), 3600)
    if (linkError) throw linkError

    const byPath = new Map((links ?? []).map(link => [link.path, link.signedUrl]))
    const works = visible.flatMap(row => {
      const url = byPath.get(row.storage_path)
      return url ? [{
        id: row.id,
        author: row.author_name,
        title: row.title,
        description: row.description,
        type: row.media_type,
        url,
        date: row.published_at ?? row.created_at,
      }] : []
    })
    return NextResponse.json({ works }, { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'No fue posible consultar la exposición.' }, { status: 503, headers: noStore })
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401, headers: noStore })

  const { data: profile } = await supabase.from('profiles')
    .select('role,blocked').eq('id', user.id).maybeSingle()
  if (!profile || profile.blocked || !allowedRoles.has(profile.role)) {
    return NextResponse.json({ error: 'Tu cuenta no está habilitada para subir material.' }, { status: 403, headers: noStore })
  }

  const body = await request.json().catch(() => ({}))
  const title = shortText(body.title, 160)
  const author = shortText(body.author, 120)
  const description = shortText(body.description, 1200)
  const mime = shortText(body.mime, 100).toLowerCase()
  const path = shortText(body.path, 300)
  const name = shortText(body.fileName, 200)
  const size = Number(body.size)
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const filename = path.split('/').pop() ?? ''
  const validPath = path.startsWith(user.id + '/') &&
    path.split('/').length === 2 &&
    /^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/i.test(filename)

  if (title.length < 2 || author.length < 2 || body.rightsConfirmed !== true ||
      !validPath || !CREATIVE_MIMES[mime] || !CREATIVE_EXTENSIONS[mime]?.includes(extension) ||
      !Number.isSafeInteger(size) || size <= 0 || size > CREATIVE_MAX_BYTES || !name) {
    return NextResponse.json({
      error: 'Completa el título y el autor, confirma los derechos y selecciona un archivo válido (máximo 50 MB).',
    }, { status: 400, headers: noStore })
  }

  try {
    const admin = createAdminSupabaseClient()
    const { data: entries, error: uploadError } = await admin.storage
      .from(CREATIVE_BUCKET).list(user.id, { search: filename, limit: 100 })
    if (uploadError) throw uploadError
    const uploaded = (entries ?? []).find(entry => entry.name === filename)
    if (!uploaded) return NextResponse.json({ error: 'El archivo aún no se ha subido.' }, { status: 400, headers: noStore })
    const storedSize = Number(uploaded.metadata?.size)
    if (Number.isFinite(storedSize) && storedSize !== size) {
      return NextResponse.json({ error: 'El tamaño del archivo no coincide.' }, { status: 400, headers: noStore })
    }

    const { data: saved, error } = await admin.from('creative_space_works')
      .insert({
        uploader_id: user.id, author_name: author, title, description,
        media_type: CREATIVE_MIMES[mime], mime_type: mime,
        file_name: name, file_size: size, storage_path: path,
        rights_confirmed: true, status: 'pending',
      })
      .select('id').single()
    if (error) throw error
    return NextResponse.json({
      ok: true, id: saved.id,
      message: 'Obra recibida. Se mostrará en la galería cuando sea revisada y autorizada.',
    }, { status: 201, headers: noStore })
  } catch {
    return NextResponse.json({ error: 'No fue posible registrar el material. Intenta nuevamente.' }, { status: 503, headers: noStore })
  }
}
