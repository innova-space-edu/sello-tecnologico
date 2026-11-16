import {NextResponse} from 'next/server'
import {requireAdminSession,AdminAuthorizationError} from '@/lib/admin-auth'
import {createAdminSupabaseClient} from '@/lib/supabase-admin'
import {CREATIVE_BUCKET,CREATIVE_MAX_BYTES,CREATIVE_MIMES,CREATIVE_EXTENSIONS,shortText} from '@/lib/creative-space'
import {normalizeCreativeTags} from '@/lib/creative-space-public'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'no-store'}
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers})
async function administrator(){
 const {user}=await requireAdminSession()
 const db=createAdminSupabaseClient()
 const {data,error}=await db.from('profiles').select('role,blocked').eq('id',user.id).maybeSingle()
 if(error||data?.role!=='admin'||data.blocked)throw new AdminAuthorizationError('Acceso exclusivo de administración.',403)
 return {db,user}
}
function failure(e:unknown){return e instanceof AdminAuthorizationError?respond({error:e.message},e.status):respond({error:'No se pudo completar la operación.'},503)}
// Only a known object in the project's own evidence bucket is copied. Never fetch a user-provided URL.
function objectPath(url:unknown){
 try{
  if(typeof url!=='string')return null
  const u=new URL(url),base=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
  if(u.origin!==base.origin)return null
  const prefix='/storage/v1/object/public/evidencias/'
  if(!u.pathname.startsWith(prefix))return null
  const path=decodeURIComponent(u.pathname.slice(prefix.length))
  if(!path||path.split('/').some(p=>!p||p==='.'||p==='..')||path.includes('\\'))return null
  return path
 }catch{return null}
}
const columns='id,title,description,created_by,created_at,file_url,file_type,file_size,file_name,tags,type'
function compatible(row:any){
 const mime=String(row.file_type||'').toLowerCase(),path=objectPath(row.file_url)
 return Boolean(path&&CREATIVE_MIMES[mime]&&Number.isSafeInteger(row.file_size)&&row.file_size>0&&row.file_size<=CREATIVE_MAX_BYTES)
}
export async function GET(request:Request){
 try{
  const {db}=await administrator()
  const params=new URL(request.url).searchParams
  const previewId=params.get('preview')
  const batch=params.get('previews')
  if(batch!==null){
   const ids=[...new Set(batch.split(',').filter(Boolean))]
   if(!ids.length||ids.length>24||ids.some(id=>!/^[0-9a-f-]{36}$/i.test(id)))return respond({error:'Solicitud de vistas previas inválida.'},400)
   const {data:rows,error}=await db.from('evidences').select(columns).in('id',ids)
   if(error)throw error
   const media=(rows??[]).filter(row=>compatible(row))
   const paths=[...new Set(media.map(row=>objectPath(row.file_url)!))]
   if(!paths.length)return respond({previews:{}})
   const {data:links,error:signError}=await db.storage.from('evidencias').createSignedUrls(paths,300)
   if(signError)throw signError
   const byPath=new Map((links??[]).map(link=>[link.path,link.signedUrl]))
   return respond({previews:Object.fromEntries(media.flatMap(row=>{const url=byPath.get(objectPath(row.file_url)!);return url?[[row.id,url]]:[]}))})
  }
  if(previewId){
   if(!/^[0-9a-f-]{36}$/i.test(previewId))return respond({error:'Evidencia inválida.'},400)
   const {data:row,error}=await db.from('evidences').select(columns).eq('id',previewId).maybeSingle()
   if(error)throw error
   if(!row||!compatible(row)||!String(row.file_type).startsWith('image/'))return respond({error:'No hay una imagen compatible disponible para copiar. Selecciona una fotografía corregida.'},404)
   const {data,error:signError}=await db.storage.from('evidencias').createSignedUrl(objectPath(row.file_url)!,300)
   if(signError||!data?.signedUrl)return respond({error:'No se pudo abrir la evidencia.'},404)
   return respond({url:data.signedUrl})
  }
  const rows:any[]=[]
  for(let offset=0;;offset+=100){
   const {data,error}=await db.from('evidences').select(columns).order('created_at',{ascending:false}).order('id',{ascending:true}).range(offset,offset+99)
   if(error)throw error
   rows.push(...(data??[]));if((data??[]).length<100)break
  }
  const creators=new Map<string,string>()
  const ids=[...new Set(rows.map(r=>r.created_by).filter(Boolean))]
  for(let i=0;i<ids.length;i+=100){
   const {data,error}=await db.from('profiles').select('id,full_name').in('id',ids.slice(i,i+100))
   if(error)throw error
   for(const p of data??[])creators.set(p.id,p.full_name||'')
  }
  return respond({evidences:rows.map(r=>({id:r.id,title:r.title,description:r.description,registeredCreator:creators.get(r.created_by)||'',date:r.created_at,mime:r.file_type,kind:r.type,compatible:compatible(r),fileName:r.file_name||'',tags:normalizeCreativeTags(r.tags)||[]}))})
 }catch(e){return failure(e)}
}
export async function POST(request:Request){
 try{
  const {db}=await administrator()
  const body=await request.json().catch(()=>({}))
  if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id)||body.rightsConfirmed!==true||body.authorshipConfirmed!==true)return respond({error:'Confirma la autoría y los derechos antes de incorporar la evidencia.'},400)
  const author=shortText(body.author,121)
  const tags=body.tags===undefined?undefined:normalizeCreativeTags(body.tags)
  if(tags===null)return respond({error:'Etiquetas inválidas.'},400)
  if(author.length<2||author.length>120)return respond({error:'Indica el autor o autores reales.'},400)
  const {data:row,error}=await db.from('evidences').select(columns).eq('id',body.id).maybeSingle()
  if(error)throw error
  if(!row||!row.created_by||!compatible(row))return respond({error:'Formato no compatible o archivo no disponible. Incorpora una copia compatible desde Agregar evidencia.'},400)
  const mime=String(row.file_type).toLowerCase(),source=objectPath(row.file_url)!
  const ext=CREATIVE_EXTENSIONS[mime][0]
  const path=row.created_by+'/'+row.id+'.'+ext
  const {data:exists,error:lookupError}=await db.from('creative_space_works').select('id').eq('storage_path',path).maybeSingle()
  if(lookupError)throw lookupError
  if(exists)return respond({error:'Esta evidencia ya está incorporada. Edítala o recupérala desde la lista de obras.'},409)
  const {data:file,error:downloadError}=await db.storage.from('evidencias').download(source)
  if(downloadError||!file)return respond({error:'No se pudo recuperar el archivo original.'},404)
  if(file.size<=0||file.size>CREATIVE_MAX_BYTES||file.size!==row.file_size||(file.type&&file.type.split(';')[0]!==mime))return respond({error:'El archivo original no coincide con sus metadatos.'},400)
  const {error:uploadError}=await db.storage.from(CREATIVE_BUCKET).upload(path,file,{contentType:mime,upsert:false})
  if(uploadError)return respond({error:'No se pudo copiar la evidencia. Comprueba si ya existe.'},409)
  const {data:saved,error:insertError}=await db.from('creative_space_works').insert({uploader_id:row.created_by,author_name:author,title:shortText(body.title,160)||shortText(row.title,160)||'Evidencia de proyecto',description:shortText(typeof body.description==='string'?body.description:row.description,1200),tags:tags??normalizeCreativeTags(row.tags)??[],media_type:CREATIVE_MIMES[mime],mime_type:mime,file_name:shortText(row.file_name,200)||'evidencia.'+ext,file_size:file.size,storage_path:path,rights_confirmed:true,status:'pending'}).select('id').single()
  if(insertError){await db.storage.from(CREATIVE_BUCKET).remove([path]);throw insertError}
  return respond({ok:true,id:saved.id,message:'Evidencia incorporada a revisión privada. Aún no está publicada.'},201)
 }catch(e){return failure(e)}
}
