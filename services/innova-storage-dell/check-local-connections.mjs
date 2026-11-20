/**
 * Read-only connectivity probe. Intentionally separate from server.mjs:
 * no listen(), no tokens or signed URLs logged, no write requests.
 * One invalid-arguments RPC invocation is made, which must return false and
 * must not change quota counters. Never issue a real read reservation.
 */
import { createHash } from 'node:crypto'
import { signEvidenceGet } from '../../src/lib/innova-storage/r2-sign.mjs'

const SUPABASE_URL = 'https://xfleqorozycfdmefdejs.supabase.co'
const R2_ACCOUNT = '84ed45de70a021c365e93b960c406d48'
const PILOT_ID = 'cb497fe7-f927-401c-81e2-bf09d4256cc6'
const PILOT_SHA256 = '759757aada53dd9f3d32dbf03f26bb49d4c0488c36949beb1b34d8a0fecba128'
const PILOT_BYTES = 65468
const e = process.env
let stage = 'preflight'
const report = (label) => process.stdout.write('PASS: ' + label + '\n')
const fail = (msg) => { throw new Error(msg) }
const headersFor = key => ({ apikey: key, Accept: 'application/json' })

async function request(url, opts = {}, expected = 200) {
  const r = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
    ...opts
  })
  if (r.status !== expected) fail('HTTP ' + r.status + ' (esperado ' + expected + ')')
  return r
}

async function run() {
  if (e.INNOVA_STORAGE_DELL_ENABLED !== 'false') fail('API debe continuar desactivada')
  if (e.SUPABASE_URL !== SUPABASE_URL || e.R2_ACCOUNT_ID !== R2_ACCOUNT) fail('Proyecto/cuenta incorrectos')
  if (!e.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_') || !e.SUPABASE_SECRET_KEY?.startsWith('sb_secret_')) fail('Formato de claves Supabase inválido')
  if (!e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY) fail('Faltan credenciales de R2')
  report('configuración privada reconocida; gateway sigue desactivado')

  stage = 'Supabase publishable'
  // Without a user JWT, RLS/grants in this project reject SELECT on evidences.
  // HTTP 401/403 from PostgREST with PostgreSQL 42501 confirms the API key
  // reached PostgREST; it does NOT mean the publishable key was invalid.
  // Never change evidence policies or grant public SELECT for this preflight.
  const anon = await fetch(SUPABASE_URL + '/rest/v1/evidences?select=id&limit=0', {
    headers: headersFor(e.SUPABASE_PUBLISHABLE_KEY),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(12000)
  })
  if (anon.status === 200) {
    if (!Array.isArray(await anon.json())) fail('Formato REST inesperado')
    report('Supabase publishable key aceptada por PostgREST')
  } else if (anon.status === 401 || anon.status === 403) {
    const problem = await anon.json().catch(() => null)
    if (problem?.code !== '42501') {
      fail('Error de API pública distinto a denegación de permisos (HTTP ' + anon.status + ')')
    }
    report('Supabase publishable key reconocida; lectura anónima de evidencias denegada (42501)')
  } else {
    fail('Estado REST inesperado (HTTP ' + anon.status + ')')
  }

  stage = 'Supabase secret'
  const registryUrl = new URL(SUPABASE_URL + '/rest/v1/innova_r2_evidence_registry')
  registryUrl.searchParams.set('evidence_id', 'eq.' + PILOT_ID)
  registryUrl.searchParams.set('select', 'evidence_id,source_key,size_bytes,sha256,enabled')
  registryUrl.searchParams.set('limit', '1')
  const entries = await (await request(registryUrl, {
    headers: headersFor(e.SUPABASE_SECRET_KEY)
  })).json()
  if (!Array.isArray(entries) || entries.length !== 1) fail('No existe registro piloto autorizado')
  const pilot = entries[0]
  if (pilot.evidence_id !== PILOT_ID || pilot.enabled !== true || pilot.size_bytes !== PILOT_BYTES ||
      pilot.sha256 !== PILOT_SHA256 || typeof pilot.source_key !== 'string') {
    fail('Registro piloto no coincide')
  }
  report('Supabase secret key y registro R2')

  stage = 'Supabase read permissions'
  // This table has REVOKE SELECT for anon. No response bodies, names or identifiers printed.
  const unauthorized = await fetch(registryUrl, {
    headers: headersFor(e.SUPABASE_PUBLISHABLE_KEY),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000)
  })
  if (unauthorized.status !== 401 && unauthorized.status !== 403) {
    fail('Registro privado accesible o respuesta inesperada (HTTP ' + unauthorized.status + ')')
  }
  const denial = await unauthorized.json().catch(() => null)
  if (denial?.code !== '42501') fail('Registro privado: rechazo distinto de permisos PostgreSQL')
  report('acceso anónimo al registro privado denegado por PostgreSQL (42501)')

  stage = 'Supabase quota no-op'
  // Null arguments exit BEFORE advisory locks or writing counters, as verified in PG tests.
  const quota = await (await request(SUPABASE_URL + '/rest/v1/rpc/innova_reserve_r2_gateway_read', {
    method: 'POST',
    headers: { ...headersFor(e.SUPABASE_SECRET_KEY), 'Content-Type':'application/json' },
    body: JSON.stringify({ p_user_id: null, p_evidence_id: null })
  })).json()
  if (quota !== false) fail('La función de cuotas no rechazó parámetros vacíos')
  report('función de cuotas conectada y sin reservar operaciones')

  stage = 'R2 private GET'
  const signed = signEvidenceGet({
    accountId: R2_ACCOUNT,
    accessKeyId: e.R2_ACCESS_KEY_ID,
    secretAccessKey: e.R2_SECRET_ACCESS_KEY,
    key: pilot.source_key
  })
  const res = await request(signed)
  const length = Number(res.headers.get('content-length'))
  if (Number.isFinite(length) && length > PILOT_BYTES) fail('Objeto demasiado grande')
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length !== PILOT_BYTES || createHash('sha256').update(bytes).digest('hex') !== PILOT_SHA256) {
    fail('Integridad R2 no coincide')
  }
  report('Cloudflare R2 GET privado, 65.468 bytes y SHA-256 coincidente')
  report('preflight completo; sin cambios de cuotas, DNS, Tunnel ni contenedores')
}

run().catch(err => {
  // Stage + vetted status only; never print request URLs, headers, tokens or stack traces.
  const code = /^HTTP [0-9]{3} \(esperado [0-9]{3}\)$/.test(err?.message || '') ? ' — ' + err.message : ''
  console.error('FAIL: ' + stage + code)
  process.exitCode = 1
})
