import {createHash} from 'node:crypto'
import {NextResponse} from 'next/server'
import {requireAdminSession, AdminAuthorizationError} from '@/lib/admin-auth'
import {signEvidenceGet} from '@/lib/innova-storage/r2-sign.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const MAX_BYTES = 1_000_000
const headers = {'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff'}
const reply = (body: unknown, status=200) => NextResponse.json(body,{status,headers})
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const prefix = '/storage/v1/object/public/evidencias/'

function objectKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const u = new URL(value)
    if (u.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin || u.username || u.password || u.search || u.hash || !u.pathname.startsWith(prefix)) return null
    const key = decodeURIComponent(u.pathname.slice(prefix.length))
    if (!key || key.includes('\\') || /[\x00-\x1f\x7f]/.test(key) || key.split('/').some(s=>!s||s==='.'||s==='..')) return null
    return key
  } catch {return null}
}

// Disabled by default. Only a single administrator-selected record, no arbitrary object key.
// Server-side read: neither the signed URL nor the object bytes are sent to the browser.
export async function GET() {
  if (process.env.INNOVA_R2_PILOT_ENABLED !== 'true') return reply({error:'No disponible'},404)
  try {
    const {supabase,user} = await requireAdminSession()
    const {data:profile,error:profileError} = await supabase.from('profiles').select('role,blocked').eq('id',user.id).maybeSingle()
    if(profileError || profile?.role !== 'admin' || profile.blocked !== false) return reply({error:'Acceso denegado'},403)
    const id=process.env.INNOVA_R2_PILOT_EVIDENCE_ID || ''
    if (!uuid.test(id)) return reply({error:'Prueba no configurada'},503)
    const {data:row,error}=await supabase.from('evidences').select('id,file_url,file_size').eq('id',id).maybeSingle()
    if(error || !row) return reply({error:'Evidencia no disponible'},404)
    const key=objectKey(row.file_url)
    const size=Number(row.file_size)
    if(!key || !Number.isSafeInteger(size) || size<=0 || size>MAX_BYTES) return reply({error:'Evidencia fuera del límite de prueba'},422)
    const signed=signEvidenceGet({
      accountId:'84ed45de70a021c365e93b960c406d48',
      accessKeyId:process.env.INNOVA_R2_READ_ACCESS_KEY_ID || '',
      secretAccessKey:process.env.INNOVA_R2_READ_SECRET_ACCESS_KEY || '',
      key
    })
    const upstream=await fetch(signed,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)})
    if(!upstream.ok || !upstream.body) return reply({error:'R2 no disponible'},502)
    const reader=upstream.body.getReader()
    const hash=createHash('sha256')
    let total=0
    try {
      while(true) {
        const {done,value}=await reader.read()
        if(done) break
        total+=value.byteLength
        if(total>size || total>MAX_BYTES) {await reader.cancel();return reply({error:'Tamaño no coincide'},502)}
        hash.update(value)
      }
    } finally {reader.releaseLock()}
    if(total!==size) return reply({error:'Tamaño no coincide'},502)
    return reply({ok:true,backend:'r2',bytes:total,sha256:hash.digest('hex')})
  } catch(e) {
    if(e instanceof AdminAuthorizationError) return reply({error:'Acceso denegado'},e.status)
    return reply({error:'No se pudo completar la prueba'},503)
  }
}
