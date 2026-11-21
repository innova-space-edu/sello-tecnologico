import {createHash} from 'node:crypto'
import {createServerSupabaseClient} from '@/lib/supabase-server'
import {createAdminSupabaseClient} from '@/lib/supabase-admin'
import {matchesEvidence,safeMediaType} from '@/lib/innova-storage/read-guard.mjs'
import {signEvidenceGet} from '@/lib/innova-storage/r2-sign.mjs'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}
const error=(status:number)=>Response.json({error:'Archivo no disponible'},{status,headers})
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='feat/innova-storage-r2-migration'||process.env.INNOVA_R2_READ_PREVIEW_ENABLED!=='true') return error(404)
  try {
    const {id}=await params
    if(!uuid.test(id))return error(404)
    const supabase=await createServerSupabaseClient()
    const {data:{user},error:authError}=await supabase.auth.getUser()
    if(authError||!user)return error(401)
    const {data:profile,error:profileError}=await supabase.from('profiles').select('role,blocked').eq('id',user.id).maybeSingle()
    if(profileError||!profile||profile.blocked!==false)return error(403)
    // The user's own RLS applies to the record; never authorize through service_role.
    const {data:row,error:rowError}=await supabase.from('evidences').select('id,project_id,created_by,file_url,file_size,file_type').eq('id',id).maybeSingle()
    if(rowError||!row)return error(404)
    const admin=createAdminSupabaseClient()
    const {data:entry,error:entryError}=await admin.from('innova_r2_evidence_registry').select('*').eq('evidence_id',id).maybeSingle()
    if(entryError)return error(503)
    if(!matchesEvidence(row,entry,user.id,profile.role))return error(404)
    const {data:reserved,error:reserveError}=await admin.rpc('innova_reserve_r2_preview_read',{p_user_id:user.id,p_evidence_id:id})
    if(reserveError)return error(503)
    if(reserved!==true)return error(429)
    const size=Number(entry.size_bytes)
    const signed=signEvidenceGet({accountId:'84ed45de70a021c365e93b960c406d48',accessKeyId:process.env.INNOVA_R2_READ_ACCESS_KEY_ID||'',secretAccessKey:process.env.INNOVA_R2_READ_SECRET_ACCESS_KEY||'',key:entry.source_key})
    const upstream=await fetch(signed,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)})
    if(!upstream.ok||!upstream.body)return error(502)
    const reader=upstream.body.getReader()
    const hash=createHash('sha256')
    const bytes=new Uint8Array(size)
    let pos=0
    try {
      while(true) {
        const {done,value}=await reader.read()
        if(done)break
        if(pos+value.byteLength>size){await reader.cancel();return error(502)}
        bytes.set(value,pos)
        hash.update(value)
        pos+=value.byteLength
      }
    } finally {reader.releaseLock()}
    if(pos!==size||hash.digest('hex')!==entry.sha256)return error(502)
    const mime=safeMediaType(entry.mime_type)
    return new Response(bytes,{headers:{...headers,'Content-Type':mime,'Content-Length':String(size),'Content-Disposition':mime==='application/octet-stream'?'attachment; filename="evidencia"':'inline'}})
  } catch {return error(503)}
}
