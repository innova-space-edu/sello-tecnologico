/**
 * Evidence reconciliation: VERIFIES 10 large R2 videos by full streaming GET
 * before optionally registering them as ENABLED=FALSE in Supabase.
 * Never touches Supabase Storage source objects, R2 writes, or app URLs.
 */
import { createHash } from 'node:crypto'
import { signEvidenceGet } from '../../src/lib/innova-storage/r2-sign.mjs'

const SUPABASE='https://xfleqorozycfdmefdejs.supabase.co'
const ACCOUNT='84ed45de70a021c365e93b960c406d48'
const PREFIX='/storage/v1/object/public/evidencias/'
const MAX_BYTES=100_000_000
const EXPECTED_MISSING=10
const e=process.env
const isWrite=process.argv.includes('--register-disabled')
const headers={apikey:e.SUPABASE_SECRET_KEY||'',Accept:'application/json'}
let stage='preflight'
function fail(msg){throw new Error(msg)}
function report(msg){process.stdout.write('PASS: '+msg+'\n')}
async function api(url, opts={},expected=200){
 const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000),...opts})
 if(r.status!==expected) fail('HTTP '+r.status+' (esperado '+expected+')')
 return r
}
async function list(table,select){
 const url=SUPABASE+'/rest/v1/'+table+'?select='+encodeURIComponent(select)+'&limit=500'
 const rows=await (await api(url,{headers})).json()
 if(!Array.isArray(rows))fail('REST data shape')
 return rows
}
function objectKeyFromKnownLegacy(row){
 if(typeof row.file_url!=='string')fail('URL ausente')
 const u=new URL(row.file_url)
 if(u.origin!==SUPABASE||u.pathname.indexOf(PREFIX)!==0||u.username||u.password||u.search||u.hash)fail('URL fuera de bucket evidencias')
 const raw=u.pathname.slice(PREFIX.length)
 if(raw.length>1024||raw.includes('%2f')||raw.includes('%2F')||raw.includes('%5c')||raw.includes('%5C'))fail('encoded separator in key')
 const key=raw.split('/').map(v=>decodeURIComponent(v)).join('/')
 if(!key||key.includes('\\')||/[\x00-\x1f\x7f]/.test(key)||key.split('/').some(x=>!x||x==='.'||x==='..'))fail('invalid key')
 return key
}
async function verifyBytes(row){
 const key=objectKeyFromKnownLegacy(row)
 const size=Number(row.file_size)
 if(!Number.isSafeInteger(size)||size<1||size>MAX_BYTES)fail('tamaño fuera de límite')
 const url=signEvidenceGet({accountId:ACCOUNT,accessKeyId:e.R2_ACCESS_KEY_ID,
   secretAccessKey:e.R2_SECRET_ACCESS_KEY,key})
 const response=await api(url,{signal:AbortSignal.timeout(180000)})
 if(!response.body)fail('R2 sin body')
 const hash=createHash('sha256')
 let total=0
 for await (const bytes of response.body){
   total+=bytes.length
   if(total>size)fail('R2 entrega más bytes de los previstos')
   hash.update(bytes)
 }
 if(total!==size)fail('R2 no coincide en tamaño')
 return {evidence_id:row.id,project_id:row.project_id,created_by:row.created_by,
   legacy_url:row.file_url,source_key:key,size_bytes:size,sha256:hash.digest('hex'),
   mime_type:row.file_type,enabled:false}
}
async function main(){
 if(e.INNOVA_STORAGE_DELL_ENABLED!=='false'||e.SUPABASE_URL!==SUPABASE||
   e.R2_ACCOUNT_ID!==ACCOUNT||!e.SUPABASE_SECRET_KEY?.startsWith('sb_secret_')||
   !e.R2_ACCESS_KEY_ID||!e.R2_SECRET_ACCESS_KEY)fail('requiere claves privadas y gateway desactivado')
 if(isWrite && e.INNOVA_RECONCILE_CONFIRM!=='REGISTER_DISABLED_AFTER_HASH_VERIFY')fail('falta confirmación de registro deshabilitado')
 stage='inventario'
 const [items,existing]=await Promise.all([
   list('evidences','id,project_id,created_by,file_url,file_size,file_type'),
   list('innova_r2_evidence_registry','evidence_id')
 ])
 const has=new Set(existing.map(x=>x.evidence_id))
 const missing=items.filter(x=>x.file_url && !has.has(x.id))
 if(missing.length===0 && existing.length===133){ report('registro ya conciliado; no hay evidencias sin registrar'); return }
 if(missing.length!==EXPECTED_MISSING || existing.length!==123) fail('recuento distinto del inventario aprobado: '+missing.length+' faltantes, '+existing.length+' registradas')
 let bytes=0
 const verified=[]
 for(let i=0;i<missing.length;i++){
   const row=missing[i]
   if(!row.project_id||!row.created_by||!row.file_type)fail('faltan campos de asociación')
   stage='R2 video '+(i+1)+'/'+missing.length
   const record=await verifyBytes(row)
   bytes+=record.size_bytes
   verified.push(record)
   report('vídeo '+(i+1)+'/'+missing.length+' verificado: '+record.size_bytes+' bytes')
 }
 report('verificados '+verified.length+' archivos, '+bytes+' bytes, con SHA-256 de R2')
 if(!isWrite){report('modo solo lectura; registro Supabase sin cambios');return}
 stage='registro deshabilitado'
 // Single PostgREST bulk INSERT runs in one database transaction.
 // Never UPSERT and never enable records; any conflict aborts the full batch.
 await api(SUPABASE+'/rest/v1/innova_r2_evidence_registry',{
   method:'POST',
   headers:{...headers,'Content-Type':'application/json',Prefer:'return=minimal'},
   body:JSON.stringify(verified)
 },201)
 report('10 registros deshabilitados insertados en una sola transacción')
 const final=await list('innova_r2_evidence_registry','evidence_id,enabled')
 if(final.length!==existing.length+verified.length)fail('conteo final incorrecto')
 if(final.filter(x=>x.enabled===true).length!==1 || final.filter(x=>x.enabled===false).length!==132)fail('el registro final no es el esperado')
 report('Supabase conciliado; 133 registros, solo 1 habilitado')
}
main().catch(err=>{
 const code=/^HTTP \d{3} \(esperado \d{3}\)$/.test(err?.message||'')?' — '+err.message:''
 console.error('FAIL: '+stage+code)
 process.exitCode=1
})
