import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import {
  CREATIVE_BUCKET, CREATIVE_MAX_BYTES, CREATIVE_MIMES,
  CREATIVE_EXTENSIONS, eligiblePublicAuthors, shortText,
} from '@/lib/creative-space'
import { normalizeCreativeTags } from '@/lib/creative-space-public'
import {isTemporaryExample,exampleRemainingSeconds,TEMPORARY_EXAMPLE_AUTHOR,TEMPORARY_EXAMPLE_TAG} from '@/lib/creative-temporary-example'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }
const allowedRoles = new Set(['admin'])

export async function GET() {
  try {
    const admin = createAdminSupabaseClient()
    const all: any[] = []
    for(let offset=0;;offset+=100){
    const { data, error } = await admin.from('creative_space_works')
      .select('id,uploader_id,author_name,title,description,media_type,storage_path,created_at,published_at,publication_basis,tags,rights_confirmed,reviewed_by,institutional_attested_at,institutional_attested_by')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .order('id', { ascending: true }).range(offset,offset+99)
    if (error) throw error
    all.push(...(data??[])); if((data??[]).length<100)break
    }
    const rows = all
    // Obras institucionales verificadas no dependen de consentimiento personal
    // del usuario que las subió. Las obras personales sí se revalidan siempre.
    const personal = rows.filter(row => row.publication_basis !== 'institutional')
    const allowed = new Set<string>()
    for(let i=0;i<personal.length;i+=100){for(const id of await eligiblePublicAuthors(admin,personal.slice(i,i+100).map(row=>row.uploader_id)))allowed.add(id)}
    // Only a self-reviewed, rights-confirmed personal upload can use the admin attestation.
    // Recheck the protected role on every public read, never trust a client-supplied role.
    const adminAttested=personal.filter(row=>row.rights_confirmed===true&&row.reviewed_by===row.uploader_id&&row.institutional_attested_by===row.uploader_id&&Boolean(row.institutional_attested_at))
    const activeAdmins=new Set<string>()
    const adminIds=[...new Set(adminAttested.map(row=>row.uploader_id as string))]
    for(let i=0;i<adminIds.length;i+=100){
      const {data,error}=await admin.from('profiles').select('id,role,blocked').in('id',adminIds.slice(i,i+100))
      if(error)throw error
      for(const p of data??[])if(p.role==='admin'&&!p.blocked)activeAdmins.add(p.id)
    }
    const ownAttestedIds=new Set(adminAttested.filter(row=>activeAdmins.has(row.uploader_id)).map(row=>row.id))
    const visible = rows.filter(row => isTemporaryExample(row.tags)
      ? row.publication_basis==='institutional' && row.author_name===TEMPORARY_EXAMPLE_AUTHOR && row.media_type==='image' && exampleRemainingSeconds(row.created_at)>0
      : row.publication_basis === 'institutional' || allowed.has(row.uploader_id) || ownAttestedIds.has(row.id))
    if (!visible.length) return NextResponse.json({ works: [] }, { headers: noStore })

    const regular=visible.filter(row=>!isTemporaryExample(row.tags))
    const {data:links,error:linkError}=regular.length?await admin.storage.from(CREATIVE_BUCKET).createSignedUrls(regular.map(row=>row.storage_path),300):{data:[],error:null}
    if(linkError)throw linkError
    const byPath=new Map((links??[]).map(link=>[link.path,link.signedUrl]))
    for(const row of visible.filter(row=>isTemporaryExample(row.tags))){
      const ttl=Math.min(300,exampleRemainingSeconds(row.created_at))
      if(ttl<=0)continue
      const {data,error}=await admin.storage.from(CREATIVE_BUCKET).createSignedUrl(row.storage_path,ttl)
      if(!error&&data?.signedUrl)byPath.set(row.storage_path,data.signedUrl)
    }
    const works = visible.flatMap(row => {
      const url = byPath.get(row.storage_path)
      return url ? [{
        id: row.id,
        author: row.author_name,
        title: row.title,
        description: row.description,
        tags: row.tags ?? [],
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
    return NextResponse.json({ error: 'Solo administración puede agregar evidencias a la galería.' }, { status: 403, headers: noStore })
  }

  const body = await request.json().catch(() => ({}))
  const temporary=body.temporaryExample===true
  const title = shortText(body.title, 160)
  const author = shortText(body.author, 120)
  const description = shortText(body.description, 1200)
  const mime = shortText(body.mime, 100).toLowerCase()
  const path = shortText(body.path, 300)
  const name = shortText(body.fileName, 200)
  const size = Number(body.size)
  const tags = body.tags === undefined ? [] : normalizeCreativeTags(body.tags)
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const filename = path.split('/').pop() ?? ''
  const validPath = path.startsWith(user.id + '/') &&
    path.split('/').length === 2 &&
    /^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/i.test(filename)

  if (title.length < 2 || author.length < 2 || body.rightsConfirmed !== true ||
      !validPath || tags === null || isTemporaryExample(tags) || !CREATIVE_MIMES[mime] || !CREATIVE_EXTENSIONS[mime]?.includes(extension) ||
      !Number.isSafeInteger(size) || size <= 0 || size > CREATIVE_MAX_BYTES || !name) {
    return NextResponse.json({
      error: 'Completa el título y el autor, confirma los derechos y selecciona un archivo válido (máximo 50 MB).',
    }, { status: 400, headers: noStore })
  }

  try {
    const admin = createAdminSupabaseClient()
    if(temporary){
      if(body.anonymizedCopyVerified!==true||body.authorshipAndPermissionsVerified!==true||author!==TEMPORARY_EXAMPLE_AUTHOR||mime!=='image/jpeg'||description||tags.length||name!=='ejemplo-temporal.jpg'||typeof body.sourceId!=='string'||! /^[0-9a-f-]{36}$/i.test(body.sourceId))return NextResponse.json({error:'Confirma la anonimización y los derechos de la copia, y utiliza la versión JPEG preparada por el editor.'},{status:400,headers:noStore})
      if(body.sourceKind==='evidence'){
        const {data:source,error:sourceError}=await admin.from('evidences').select('id,file_type,type').eq('id',body.sourceId).maybeSingle()
        if(sourceError||!source||!(String(source.file_type||'').startsWith('image/')||source.type==='foto'))return NextResponse.json({error:'La evidencia original no es una fotografía disponible.'},{status:409,headers:noStore})
      }else if(body.sourceKind==='work'){
        const {data:source,error:sourceError}=await admin.from('creative_space_works').select('id,status,media_type,storage_path,tags').eq('id',body.sourceId).maybeSingle()
        if(sourceError||!source||source.status!=='pending'||source.media_type!=='image'||source.storage_path===path||isTemporaryExample(source.tags))return NextResponse.json({error:'La obra original ya no está disponible para este proceso.'},{status:409,headers:noStore})
      }else return NextResponse.json({error:'Origen de la copia inválido.'},{status:400,headers:noStore})
    }
    const { data: entries, error: uploadError } = await admin.storage
      .from(CREATIVE_BUCKET).list(user.id, { search: filename, limit: 100 })
    if (uploadError) throw uploadError
    const uploaded = (entries ?? []).find(entry => entry.name === filename)
    if (!uploaded) return NextResponse.json({ error: 'El archivo aún no se ha subido.' }, { status: 400, headers: noStore })
    const storedSize = Number(uploaded.metadata?.size)
    const storedMime=String(uploaded.metadata?.mimetype??'').split(';')[0].toLowerCase()
    if(temporary&&(!Number.isFinite(storedSize)||storedMime!=='image/jpeg'))return NextResponse.json({error:'No se pudo verificar el archivo JPEG.'},{status:400,headers:noStore})
    if (Number.isFinite(storedSize) && storedSize !== size) {
      return NextResponse.json({ error: 'El tamaño del archivo no coincide.' }, { status: 400, headers: noStore })
    }

    const { data: saved, error } = await admin.from('creative_space_works')
      .insert({
        uploader_id: user.id, author_name: author, title, description, tags,
        media_type: CREATIVE_MIMES[mime], mime_type: mime,
        file_name: name, file_size: size, storage_path: path,
        rights_confirmed: true, status: 'pending',
        ...(temporary?{tags:[TEMPORARY_EXAMPLE_TAG]}:{}),
      })
      .select('id').single()
    if (error) throw error
    return NextResponse.json({
      ok: true, id: saved.id,
      message: temporary?'Copia anónima preparada y pendiente de aprobación. El original no se modifica.':'Obra recibida. Se mostrará en la galería cuando sea revisada y autorizada.',
    }, { status: 201, headers: noStore })
  } catch {
    return NextResponse.json({ error: 'No fue posible registrar el material. Intenta nuevamente.' }, { status: 503, headers: noStore })
  }
}
