import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import {
  CREATIVE_BUCKET, CREATIVE_MAX_BYTES, CREATIVE_MIMES, CREATIVE_EXTENSIONS,
  normalizeCreativeTags,
} from '@/lib/creative-space-public'
import { shortText } from '@/lib/creative-space'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }
const allowedRoles = new Set(['admin', 'docente', 'coordinador', 'utp', 'estudiante'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function currentAuthor() {
  const client = await createServerSupabaseClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return { user: null, admin: null }
  const admin = createAdminSupabaseClient()
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('role,blocked').eq('id', user.id).maybeSingle()
  if (profileError || !profile || profile.blocked || !allowedRoles.has(profile.role)) {
    return { user: null, admin: null }
  }
  return { user, admin }
}

export async function GET() {
  try {
    const { user, admin } = await currentAuthor()
    if (!user || !admin) return NextResponse.json({ error: 'Debes iniciar sesión con una cuenta habilitada.' }, { status: 401, headers: noStore })

    const { data, error } = await admin.from('creative_space_works')
      .select('id,title,author_name,description,tags,media_type,file_name,storage_path,status,created_at,updated_at')
      .eq('uploader_id', user.id).order('updated_at', { ascending: false }).limit(100)
    if (error) throw error
    const rows = data ?? []
    const { data: links } = rows.length
      ? await admin.storage.from(CREATIVE_BUCKET).createSignedUrls(rows.map(row => row.storage_path), 900)
      : { data: [] }
    const byPath = new Map((links ?? []).map(link => [link.path, link.signedUrl]))
    return NextResponse.json({
      works: rows.map(row => ({
        id: row.id, title: row.title, author: row.author_name,
        description: row.description, tags: row.tags ?? [],
        type: row.media_type, fileName: row.file_name,
        status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
        url: byPath.get(row.storage_path) ?? null,
      })),
    }, { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'No fue posible recuperar tus obras.' }, { status: 503, headers: noStore })
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, admin } = await currentAuthor()
    if (!user || !admin) return NextResponse.json({ error: 'Debes iniciar sesión con una cuenta habilitada.' }, { status: 401, headers: noStore })

    const body = await request.json().catch(() => ({}))
    const id = body.id
    const expectedUpdatedAt = body.expectedUpdatedAt
    const title = shortText(body.title, 161)
    const author = shortText(body.author, 121)
    const description = shortText(body.description, 1201)
    const tags = normalizeCreativeTags(body.tags)

    if (typeof id !== 'string' || !uuid.test(id) ||
        typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt)) ||
        title.length < 2 || title.length > 160 ||
        author.length < 2 || author.length > 120 || description.length > 1200 ||
        tags === null || body.rightsConfirmed !== true) {
      return NextResponse.json({ error: 'Revisa título, autor, etiquetas (hasta 8 de 24 caracteres) y la declaración de derechos.' },
        { status: 400, headers: noStore })
    }

    const { data: work, error: readError } = await admin.from('creative_space_works')
      .select('id,uploader_id,status,storage_path,updated_at').eq('id', id).maybeSingle()
    if (readError) throw readError
    if (!work || work.uploader_id !== user.id) {
      return NextResponse.json({ error: 'Solo puedes editar las obras que subiste.' }, { status: 403, headers: noStore })
    }
    if (work.updated_at !== expectedUpdatedAt) {
      return NextResponse.json({ error: 'La obra fue modificada. Actualiza la lista antes de editarla nuevamente.' },
        { status: 409, headers: noStore })
    }

    const replacement = body.replacement
    const replacing = replacement !== null && replacement !== undefined
    let nextFile: Record<string, unknown> = {}

    if (replacing) {
      if (typeof replacement !== 'object' || Array.isArray(replacement)) {
        return NextResponse.json({ error: 'Archivo de reemplazo inválido.' }, { status: 400, headers: noStore })
      }
      const path = shortText(replacement.path, 300)
      const fileName = shortText(replacement.fileName, 200)
      const mime = shortText(replacement.mime, 100).toLowerCase()
      const size = Number(replacement.size)
      const blob = path.split('/').pop() ?? ''
      const ext = blob.split('.').pop()?.toLowerCase() ?? ''
      if (path === work.storage_path || !path.startsWith(user.id + '/') ||
          path.split('/').length !== 2 || !/^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/i.test(blob) ||
          !fileName || !CREATIVE_MIMES[mime] || !CREATIVE_EXTENSIONS[mime]?.includes(ext) ||
          !Number.isSafeInteger(size) || size <= 0 || size > CREATIVE_MAX_BYTES) {
        return NextResponse.json({ error: 'El nuevo archivo no tiene un formato o tamaño válido.' },
          { status: 400, headers: noStore })
      }
      const { data: entries, error: storageError } = await admin.storage.from(CREATIVE_BUCKET)
        .list(user.id, { search: blob, limit: 100 })
      if (storageError) throw storageError
      const uploaded = (entries ?? []).find(entry => entry.name === blob)
      const storedSize = Number(uploaded?.metadata?.size)
      const storedMime = String(uploaded?.metadata?.mimetype ?? '').split(';')[0].toLowerCase()
      if (!uploaded || !Number.isFinite(storedSize) || storedSize !== size ||
          (storedMime && storedMime !== mime)) {
        return NextResponse.json({ error: 'El archivo nuevo no coincide con la carga verificada.' },
          { status: 400, headers: noStore })
      }
      nextFile = {
        storage_path: path, file_name: fileName, mime_type: mime,
        media_type: CREATIVE_MIMES[mime], file_size: size,
      }
    }

    // Edits to published or rejected works revoke publication and trigger moderation.
    // Reset institutional attestation: no old approval can silently cover new content.
    const { data: updated, error: updateError } = await admin.from('creative_space_works').update({
      title, author_name: author, description, tags,
      ...nextFile,
      rights_confirmed: true,
      status: 'pending', reviewed_at: null, reviewed_by: null, published_at: null,
      publication_basis: 'personal', institutional_attested_at: null,
      institutional_attested_by: null, updated_at: new Date().toISOString(),
    }).eq('id', id).eq('uploader_id', user.id).eq('updated_at', expectedUpdatedAt)
      .select('id').maybeSingle()

    if (updateError) throw updateError
    if (!updated) return NextResponse.json({
      error: 'La obra cambió mientras editabas. Actualiza la página y vuelve a intentar.',
    }, { status: 409, headers: noStore })

    if (replacing) {
      // Remove the old media only after the new database reference was committed.
      // A stale signed URL may otherwise point to a previously published asset.
      const { error: removeError } = await admin.storage.from(CREATIVE_BUCKET).remove([work.storage_path])
      if (removeError) console.error('Creative space: could not remove replaced asset', removeError.message)
    }
    return NextResponse.json({ ok: true, status: 'pending',
      message: 'Cambios guardados. La obra vuelve a revisión antes de exhibirse.' }, { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'No fue posible guardar los cambios.' }, { status: 503, headers: noStore })
  }
}
