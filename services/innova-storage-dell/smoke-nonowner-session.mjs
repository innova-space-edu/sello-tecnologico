/**
 * Real nonowner authorization regression. Do not use student accounts.
 * Only an unblocked docente profile that is NOT the pilot author is accepted.
 * No files downloaded and no tokens, signed URLs, emails or personal metadata logged.
 */
import { createServer } from 'node:http'
import { createHandler, loadConfig } from './server.mjs'

const PROJECT_URL = 'https://xfleqorozycfdmefdejs.supabase.co'
const ACCOUNT = '84ed45de70a021c365e93b960c406d48'
const EVIDENCE_ID = 'cb497fe7-f927-401c-81e2-bf09d4256cc6'
let phase = 'preflight'
const report = text => console.log('PASS: ' + text)
const fail = () => { throw new Error('Test failed') }

async function getJson(url, options, wanted = 200) {
  let r
  try {
    r = await fetch(url, { cache:'no-store', redirect:'error', signal:AbortSignal.timeout(15000), ...options })
  } catch (err) {
    // Never log the URL, request body, credentials, or upstream error stack.
    const safe = new Error('Network request failed')
    safe.kind = err?.name === 'TimeoutError' ? 'timeout' : 'red/TLS/DNS'
    throw safe
  }
  if (r.status !== wanted) {
    const err = new Error('Bad HTTP status')
    err.httpCode = r.status
    throw err
  }
  try { return await r.json() }
  catch { const err = new Error('Response not JSON'); err.kind = 'respuesta_no_json'; throw err }
}
function exactUserHeaders(config, token) {
  return { apikey:config.publicKey, Authorization:'Bearer '+token, Accept:'application/json' }
}
function adminHeaders(config) {
  return { apikey:config.secretKey, Accept:'application/json' }
}
async function receiveCredentials() {
  let buffer=''
  for await (const part of process.stdin) {
    buffer += String(part)
    if (buffer.length > 4096) { const err = new Error('Long input'); err.kind = 'formato_credenciales'; throw err }
  }
  const [email,password] = buffer.replace(/\r/g,'').split('\n')
  buffer=''
  if (!email || !password || email.length>254 || password.length<6 || password.length>2048 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail()
  return {email:email.trim().toLowerCase(),password}
}

async function run() {
  const env=process.env
  if (env.INNOVA_STORAGE_DELL_ENABLED !== 'false' ||
      env.SUPABASE_URL !== PROJECT_URL || env.R2_ACCOUNT_ID !== ACCOUNT) fail()
  const config=loadConfig({...env,INNOVA_STORAGE_DELL_ENABLED:'true',HOST:'127.0.0.1'})
  const origin=[...config.origins][0]
  if (!origin?.startsWith('https://')) fail()

  phase='login cuenta docente no administradora'
  let {email,password}=await receiveCredentials()
  let login
  try {
    login=await getJson(PROJECT_URL+'/auth/v1/token?grant_type=password',{
      method:'POST',
      headers:{apikey:config.publicKey,'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    })
  } finally {
    email=null
    password=null
  }
  let token=login?.access_token
  const userId=login?.user?.id
  login=null
  if (typeof token!=='string'||token.length<40||!/^[a-f0-9-]{36}$/i.test(String(userId))) fail()

  phase='verificación de rol docente'
  const profileUrl=new URL(PROJECT_URL+'/rest/v1/profiles')
  profileUrl.searchParams.set('id','eq.'+userId)
  profileUrl.searchParams.set('select','role,blocked')
  profileUrl.searchParams.set('limit','1')
  const profiles=await getJson(profileUrl,{headers:exactUserHeaders(config,token)})
  if (!Array.isArray(profiles)||profiles.length!==1||profiles[0].role!=='docente'||profiles[0].blocked!==false) fail()

  const entryUrl=new URL(PROJECT_URL+'/rest/v1/innova_r2_evidence_registry')
  entryUrl.searchParams.set('evidence_id','eq.'+EVIDENCE_ID)
  entryUrl.searchParams.set('select','evidence_id,created_by,enabled')
  entryUrl.searchParams.set('limit','1')
  const entries=await getJson(entryUrl,{headers:adminHeaders(config)})
  if (!Array.isArray(entries)||entries.length!==1||entries[0].enabled!==true ||
      entries[0].created_by===userId) fail()
  report('cuenta docente autenticada, no administradora ni autora del archivo piloto')

  async function quotaSnapshot() {
    const now=new Date()
    const day=now.toISOString().slice(0,10)
    const month=day.slice(0,7)+'-01'
    const scopes=[
      ['day',day,'00000000-0000-0000-0000-000000000000'],
      ['month',month,'00000000-0000-0000-0000-000000000000'],
      ['user_day',day,userId]
    ]
    return Promise.all(scopes.map(async ([period,start,subject])=>{
      const u=new URL(PROJECT_URL+'/rest/v1/innova_r2_read_usage')
      u.searchParams.set('period_kind','eq.'+period)
      u.searchParams.set('period_start','eq.'+start)
      u.searchParams.set('subject','eq.'+subject)
      u.searchParams.set('select','operations,bytes')
      const data=await getJson(u,{headers:adminHeaders(config)})
      if(!Array.isArray(data)||data.length>1)fail()
      return JSON.stringify(data)
    }))
  }

  phase='cuotas antes del intento'
  const before=await quotaSnapshot()
  phase='API Dell denegación de usuario ajeno'
  const server=createServer({maxHeaderSize:8192},createHandler(config))
  try {
    await new Promise((resolve,reject)=>{
      server.once('error',reject)
      server.listen(0,'127.0.0.1',resolve)
    })
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/v1/evidences/'+EVIDENCE_ID+'/authorize',{
      method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Authorization:'Bearer '+token,Origin:origin,Accept:'application/json'}
    })
    if (response.status!==404) {
      const err=new Error('Unexpected HTTP status')
      err.httpCode=response.status
      throw err
    }
    const body=await response.json().catch(()=>null)
    if(!body || typeof body!=='object' || body.url || body.expires_in) fail()
    report('archivo piloto denegado a docente ajeno (HTTP 404)')
  } finally {
    await new Promise(resolve=>server.close(resolve))
    token=null
  }
  phase='cuotas posteriores'
  const after=await quotaSnapshot()
  if(JSON.stringify(before)!==JSON.stringify(after))fail()
  report('cero enlaces R2; contadores de cuota sin cambios')
  report('prueba terminada sin publicar puertos ni modificar servicio permanente')
}
run().catch(err=>{
  const detail = Number.isInteger(err.httpCode) ? ' — HTTP '+err.httpCode : err.kind ? ' — '+err.kind : ''
  console.error('FAIL: '+phase+detail)
  process.exitCode=1
})
