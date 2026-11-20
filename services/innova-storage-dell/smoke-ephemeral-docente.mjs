/**
 * One-shot REAL end-to-end negative test with a NEW disposable DOCENTE.
 *
 * No emails to real people; private Supabase Auth Admin API creates an
 * auto-confirmed, random, never-delivered test identity @colprovidencia.cl.
 * CreaLab's existing auth.users trigger makes profiles.role='docente'.
 *
 * No user credentials/tokens/R2 signatures are printed or written to files.
 * Only the already-stored sb_secret and sb_publishable keys are used.
 * The disposable Auth user is removed in finally, including on test failures.
 * A SIGKILL/host crash can prevent cleanup; operator must then remove the
 * uniquely named innova-storage-qa-* account using Supabase dashboard.
 */
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { createHandler, loadConfig } from './server.mjs'

const SUPABASE = 'https://xfleqorozycfdmefdejs.supabase.co'
const R2_ACCOUNT = '84ed45de70a021c365e93b960c406d48'
const PILOT = 'cb497fe7-f927-401c-81e2-bf09d4256cc6'
const GLOBAL = '00000000-0000-0000-0000-000000000000'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CONFIRM = 'EXPLICITLY_AUTHORIZED_EPHEMERAL_TEST_ACCOUNT'
const report = message => console.log('PASS: ' + message)
let stage = 'preflight'
let createdId = null
let createdEmail = null
let testPassed = false
let cleanupOk = false

function failure(message) {
  throw new Error(message)
}
function validatedStatusError(code) {
  const e = new Error('HTTP status mismatch')
  e.status = code
  return e
}
async function api(url, init={}, expected=200) {
  const r = await fetch(url, {
    cache:'no-store', redirect:'error', signal:AbortSignal.timeout(20000), ...init
  })
  if (r.status !== expected) throw validatedStatusError(r.status)
  return r
}
async function json(url, init={}, expected=200) {
  return (await api(url,init,expected)).json()
}
function secretHeaders(c) { return { apikey:c.secretKey,Accept:'application/json' } }
function publicHeaders(c,token) {
  return { apikey:c.publicKey,Authorization:'Bearer '+token,Accept:'application/json' }
}
function authAdmin(c) { return { ...secretHeaders(c),'Content-Type':'application/json' } }
async function profileRows(c,id,headers) {
  const u=new URL(SUPABASE+'/rest/v1/profiles')
  u.searchParams.set('id','eq.'+id)
  u.searchParams.set('select','id,role,blocked')
  u.searchParams.set('limit','1')
  return json(u,{headers})
}
async function pilotRegistry(c) {
  const u=new URL(SUPABASE+'/rest/v1/innova_r2_evidence_registry')
  u.searchParams.set('evidence_id','eq.'+PILOT)
  u.searchParams.set('select','created_by,enabled,evidence_id')
  u.searchParams.set('limit','1')
  return json(u,{headers:secretHeaders(c)})
}
async function quotaSnapshot(c,id,day) {
  const month=day.slice(0,7)+'-01'
  const queries=[
    ['day',day,GLOBAL],
    ['month',month,GLOBAL],
    ['user_day',day,id]
  ]
  return Promise.all(queries.map(async ([kind,start,subject])=>{
    const u=new URL(SUPABASE+'/rest/v1/innova_r2_read_usage')
    u.searchParams.set('period_kind','eq.'+kind)
    u.searchParams.set('period_start','eq.'+start)
    u.searchParams.set('subject','eq.'+subject)
    u.searchParams.set('select','operations,bytes')
    const data=await json(u,{headers:secretHeaders(c)})
    if (!Array.isArray(data) || data.length>1) failure('invalid quota data')
    return JSON.stringify(data)
  }))
}
async function cleanup(c) {
  if (!createdId) return true
  stage='eliminación de cuenta temporal'
  let deleted=false
  for (let attempt=0;attempt<2 && !deleted;attempt++) {
    try {
      const r=await fetch(SUPABASE+'/auth/v1/admin/users/'+createdId,{
        method:'DELETE',
        headers:authAdmin(c),
        cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)
      })
      deleted=r.status===200||r.status===204||r.status===404
    } catch {
      // One bounded retry for transient network failure.
    }
  }
  if (!deleted) return false
  // Confirm the auth trigger's profile row is gone; CASCADE on auth.users.
  try {
    const rows=await profileRows(c,createdId,secretHeaders(c))
    return Array.isArray(rows)&&rows.length===0
  } catch {
    return false
  }
}
async function main() {
  const env=process.env
  if(env.INNOVA_STORAGE_DELL_ENABLED!=='false'||env.SUPABASE_URL!==SUPABASE||
      env.R2_ACCOUNT_ID!==R2_ACCOUNT||env.INNOVA_EPHEMERAL_TEST_ACK!==CONFIRM) {
    failure('disabled-only, correct-project or explicit test acknowledgment missing')
  }
  const c=loadConfig({...env,INNOVA_STORAGE_DELL_ENABLED:'true',HOST:'127.0.0.1'})
  const origin=[...c.origins][0]
  if(!origin?.startsWith('https://')) failure('no allowed HTTPS origin')
  const suffix=randomBytes(10).toString('hex')
  createdEmail='innova-storage-qa-'+suffix+'@colprovidencia.cl'
  const password=randomBytes(32).toString('base64url')+'A7!'
  const day=new Date().toISOString().slice(0,10)

  stage='creación de cuenta temporal Supabase Auth'
  let user
  const response=await api(SUPABASE+'/auth/v1/admin/users',{
    method:'POST',
    headers:authAdmin(c),
    body:JSON.stringify({
      email:createdEmail,
      password,
      email_confirm:true,
      user_metadata:{full_name:'INNOVA Storage QA temporal'}
    })
  })
  user=await response.json()
  createdId=user?.id
  if(!UUID.test(String(createdId||''))) failure('Auth Admin did not return a user ID')
  user=null
  report('cuenta docente temporal creada con contraseña aleatoria (sin correo de invitación)')

  try {
    stage='inicio de sesión temporal'
    let session=await json(SUPABASE+'/auth/v1/token?grant_type=password',{
      method:'POST',
      headers:{apikey:c.publicKey,'Content-Type':'application/json'},
      body:JSON.stringify({email:createdEmail,password})
    })
    let token=session?.access_token
    const uid=session?.user?.id
    session=null
    if(typeof token!=='string'||token.length<40||uid!==createdId) failure('invalid test login')
    report('sesión temporal válida; JWT únicamente en memoria')

    stage='perfil docente y condición de no autor'
    const profile=await profileRows(c,createdId,publicHeaders(c,token))
    if(!Array.isArray(profile)||profile.length!==1||profile[0].role!=='docente'||
       profile[0].blocked!==false) failure('not an unblocked docente profile')
    const registry=await pilotRegistry(c)
    if(!Array.isArray(registry)||registry.length!==1||registry[0].enabled!==true||
       registry[0].created_by===createdId) failure('pilot not enabled or test user is author')
    report('rol docente confirmado, sin privilegios administrativos y ajeno al archivo piloto')

    stage='control de cuotas anterior'
    const before=await quotaSnapshot(c,createdId,day)

    stage='denegación por API Dell real'
    const server=createServer({maxHeaderSize:8192},createHandler(c))
    try {
      await new Promise((resolve,reject)=>{
        server.once('error',reject)
        server.listen(0,'127.0.0.1',resolve)
      })
      const response=await fetch('http://127.0.0.1:'+server.address().port+
        '/v1/evidences/'+PILOT+'/authorize',{
        method:'POST',cache:'no-store',redirect:'error',
        signal:AbortSignal.timeout(20000),
        headers:{Authorization:'Bearer '+token,Origin:origin,Accept:'application/json'}
      })
      const body=await response.json().catch(()=>null)
      if(response.status!==404||body?.url||body?.expires_in) throw validatedStatusError(response.status)
      report('docente temporal ajeno rechazado (HTTP 404; sin enlace R2)')
    } finally {
      await new Promise(resolve=>server.close(resolve))
      token=null
    }
    stage='verificación posterior de cuotas'
    const after=await quotaSnapshot(c,createdId,day)
    if(JSON.stringify(before)!==JSON.stringify(after)) failure('quota changed')
    report('cuotas sin cambios por solicitud denegada')
    testPassed=true
  } finally {
    cleanupOk=await cleanup(c)
    if(cleanupOk) {
      report('cuenta docente temporal eliminada de Auth y perfiles (CASCADE)')
      createdId=null
      createdEmail=null
    }
  }
}
main().catch(e=>{
  const status=Number.isInteger(e?.status)?' — HTTP '+e.status:''
  console.error('FAIL: '+stage+status)
  process.exitCode=1
}).finally(()=>{
  if(createdId && !cleanupOk) {
    // This is a machine-generated TEST account name and UUID, not credentials.
    // Required for a manual deletion in Supabase Auth > Users if auto cleanup failed.
    console.error('ALERTA: cuenta temporal pendiente de eliminar en Supabase Auth > Users:')
    console.error('Cuenta de prueba: '+createdEmail)
    console.error('ID de prueba: '+createdId)
    process.exitCode=1
  }
  if(testPassed&&cleanupOk) report('test completo; no se publicaron puertos ni se alteró el servicio permanente')
})
