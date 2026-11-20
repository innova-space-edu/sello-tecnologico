/**
 * Authenticated negative security test against the REAL Dell gateway handler.
 * Uses an admin session to prove disabled and missing evidence cannot issue
 * presigned links. No port published, no evidence bodies or credentials logged.
 * Requires protected registry to contain >=1 disabled test record.
 */
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createHandler, loadConfig } from './server.mjs'

const SUPABASE_URL = 'https://xfleqorozycfdmefdejs.supabase.co'
const ACCOUNT_ID = '84ed45de70a021c365e93b960c406d48'
let phase = 'preflight'
const report = (label) => console.log('PASS: ' + label)
function errFor(status) {
  const err = new Error('request failed')
  err.status = status
  return err
}
async function request(url, opts = {}, expected = 200) {
  const response = await fetch(url, {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000), ...opts
  })
  if (response.status !== expected) throw errFor(response.status)
  return response
}
async function credentials() {
  let buf = ''
  for await (const chunk of process.stdin) {
    buf += String(chunk)
    if (buf.length > 4096) throw Error('Invalid input')
  }
  const lines = buf.replace(/\r/g, '').split('\n')
  const email = lines[0]?.trim().toLowerCase()
  const password = lines[1]
  buf = ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      !password || password.length < 6 || password.length > 2048) throw Error('Invalid credentials input')
  return { email, password }
}
async function main() {
  if (process.env.INNOVA_STORAGE_DELL_ENABLED !== 'false' ||
      process.env.SUPABASE_URL !== SUPABASE_URL ||
      process.env.R2_ACCOUNT_ID !== ACCOUNT_ID) throw Error('Gateway must remain disabled')
  const config = loadConfig({ ...process.env, INNOVA_STORAGE_DELL_ENABLED: 'true', HOST: '127.0.0.1' })
  const origin = [...config.origins][0]
  if (!origin?.startsWith('https://')) throw Error('No HTTPS origin configured')
  const adminHeaders = { apikey: config.secretKey, Accept: 'application/json' }

  phase = 'login real Supabase'
  let { email, password } = await credentials()
  let login
  try {
    login = await (await request(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: config.publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })).json()
  } finally { email = null; password = null }
  const token = login?.access_token
  const userId = login?.user?.id
  login = null
  if (typeof token !== 'string' || token.length < 40 ||
      !/^[a-f0-9-]{36}$/i.test(String(userId || ''))) throw Error('No user session')
  const userHeaders = { apikey: config.publicKey, Authorization:'Bearer ' + token, Accept:'application/json' }
  phase = 'perfil administrador'
  const profileUrl = new URL(SUPABASE_URL + '/rest/v1/profiles')
  profileUrl.searchParams.set('id','eq.' + userId)
  profileUrl.searchParams.set('select','role,blocked')
  profileUrl.searchParams.set('limit','1')
  const profiles = await (await request(profileUrl,{headers:userHeaders})).json()
  if (profiles?.[0]?.role !== 'admin' || profiles[0].blocked !== false) throw Error('Admin role required')
  report('sesión administradora válida; JWT solo en memoria')

  phase = 'registro deshabilitado'
  const registryUrl = new URL(SUPABASE_URL + '/rest/v1/innova_r2_evidence_registry')
  registryUrl.searchParams.set('enabled','eq.false')
  registryUrl.searchParams.set('select','evidence_id')
  registryUrl.searchParams.set('limit','1')
  const registered = await (await request(registryUrl,{headers:adminHeaders})).json()
  const disabledId = registered?.[0]?.evidence_id
  if (!/^[a-f0-9-]{36}$/i.test(String(disabledId || ''))) throw Error('No disabled fixture in registry')

  const today = new Date().toISOString().slice(0,10)
  const startMonth = today.slice(0,7) + '-01'
  async function quotaSnapshot() {
    const result = []
    for (const [kind,start,subject] of [
      ['day',today,'00000000-0000-0000-0000-000000000000'],
      ['month',startMonth,'00000000-0000-0000-0000-000000000000'],
      ['user_day',today,userId]
    ]) {
      const url = new URL(SUPABASE_URL + '/rest/v1/innova_r2_read_usage')
      url.searchParams.set('period_kind','eq.' + kind)
      url.searchParams.set('period_start','eq.' + start)
      url.searchParams.set('subject','eq.' + subject)
      url.searchParams.set('select','operations,bytes')
      const data = await (await request(url,{headers:adminHeaders})).json()
      if (!Array.isArray(data) || data.length > 1) throw Error('Invalid quota snapshot')
      result.push(JSON.stringify(data))
    }
    return result
  }
  phase = 'cuotas antes de rechazo'
  const before = await quotaSnapshot()

  phase = 'rechazo por API Dell'
  const server = createServer({maxHeaderSize:8192},createHandler(config))
  try {
    await new Promise((resolve,reject) => {
      server.once('error',reject)
      server.listen(0,'127.0.0.1',resolve)
    })
    const base = 'http://127.0.0.1:' + server.address().port
    for (const [label,id] of [
      ['evidencia registrada pero deshabilitada',disabledId],
      ['evidencia inexistente',randomUUID()]
    ]) {
      const r = await fetch(base + '/v1/evidences/' + id + '/authorize',{
        method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{Authorization:'Bearer ' + token,Origin:origin,Accept:'application/json'}
      })
      const payload = await r.json().catch(()=>null)
      if(r.status !== 404 || payload?.url || payload?.expires_in) throw errFor(r.status)
      report(label + ' rechazada (HTTP 404)')
    }
  } finally {
    await new Promise(resolve=>server.close(resolve))
  }
  phase = 'cuotas después de rechazo'
  const after = await quotaSnapshot()
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Quota changed during denial test')
  report('rechazos no emitieron enlaces R2 ni descontaron cuota')
  report('prueba negativa completada; no se publicaron puertos ni archivos')
}
main().catch(e=>{
  const status = Number.isInteger(e?.status) ? ' — HTTP ' + e.status : ''
  console.error('FAIL: ' + phase + status)
  process.exitCode = 1
})
