// INNOVA Storage Dell — authorization only. Never proxies file bytes through Tunnel.
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { signEvidenceGet } from '../../src/lib/innova-storage/r2-sign.mjs'
import { matchesEvidence } from '../../src/lib/innova-storage/read-guard.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROJECT_URL = 'https://xfleqorozycfdmefdejs.supabase.co'
const ACCOUNT_ID = '84ed45de70a021c365e93b960c406d48'
const MAX_BYTES = 100_000_000
const safeResponseHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }

export function loadConfig(env = process.env) {
  const origins = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)
  for (const origin of origins) {
    const u = new URL(origin)
    if (u.origin !== origin || (u.protocol !== 'https:' && !['http://localhost', 'http://127.0.0.1'].some(x => origin.startsWith(x + ':')))) {
      throw new Error('Invalid ALLOWED_ORIGINS')
    }
  }
  const enabled = env.INNOVA_STORAGE_DELL_ENABLED === 'true'
  if (enabled && (!env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || origins.length === 0)) {
    throw new Error('Dell Storage requires credentials and explicit allowed origins')
  }
  if (enabled && (!env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_') || !env.SUPABASE_SECRET_KEY.startsWith('sb_secret_'))) throw new Error('Use new Supabase API keys')
  if (enabled && env.SUPABASE_URL !== PROJECT_URL) throw new Error('Unexpected Supabase project')
  if (enabled && env.R2_ACCOUNT_ID !== ACCOUNT_ID) throw new Error('Unexpected R2 account')
  return {
    enabled,
    origins: new Set(origins),
    supabaseUrl: PROJECT_URL,
    publicKey: env.SUPABASE_PUBLISHABLE_KEY || '',
    secretKey: env.SUPABASE_SECRET_KEY || '',
    accessKeyId: env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
    accountId: ACCOUNT_ID,
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT || '8080')
  }
}

async function jsonFetch(fetcher, url, init) {
  const response = await fetcher(url, {
    ...init,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return { ok: false, status: response.status, data: null }
  return { ok: true, status: response.status, data: await response.json() }
}

function restHeaders(apiKey, bearer) {
  return { apikey: apiKey, Authorization: 'Bearer ' + bearer, Accept: 'application/json' }
}

export async function authorizeEvidence(token, evidenceId, config, fetcher = fetch, signer = signEvidenceGet) {
  if (!config.enabled) return { status: 404, body: { error: 'No disponible' } }
  if (!UUID.test(evidenceId) || typeof token !== 'string' || token.length < 20 || token.length > 8192) {
    return { status: 401, body: { error: 'No autorizado' } }
  }
  try {
    const userResponse = await jsonFetch(fetcher, config.supabaseUrl + '/auth/v1/user', {
      headers: restHeaders(config.publicKey, token),
    })
    const userId = userResponse.data?.id
    if (!userResponse.ok || !UUID.test(String(userId || ''))) return { status: 401, body: { error: 'No autorizado' } }

    const userHeaders = restHeaders(config.publicKey, token)
    const profileUrl = new URL(config.supabaseUrl + '/rest/v1/profiles')
    profileUrl.searchParams.set('id', 'eq.' + userId)
    profileUrl.searchParams.set('select', 'role,blocked')
    profileUrl.searchParams.set('limit', '1')
    const profile = await jsonFetch(fetcher, profileUrl, { headers: userHeaders })
    if (!profile.ok) return { status: 503, body: { error: 'Acceso no disponible' } }
    if (!Array.isArray(profile.data) || profile.data[0]?.blocked !== false) return { status: 403, body: { error: 'Acceso denegado' } }

    // User JWT and the existing Supabase RLS decide which evidence rows are visible.
    const evidenceUrl = new URL(config.supabaseUrl + '/rest/v1/evidences')
    evidenceUrl.searchParams.set('id', 'eq.' + evidenceId)
    evidenceUrl.searchParams.set('select', 'id,project_id,created_by,file_url,file_size,file_type')
    evidenceUrl.searchParams.set('limit', '1')
    const evidence = await jsonFetch(fetcher, evidenceUrl, { headers: userHeaders })
    if (!evidence.ok) return { status: 503, body: { error: 'Acceso no disponible' } }
    if (!Array.isArray(evidence.data) || !evidence.data.length) return { status: 404, body: { error: 'Archivo no disponible' } }

    // Service key can read the registry, but MUST NOT authorize the user's evidence row.
    // New sb_secret keys must be sent only as apikey, never as Bearer JWT.
    const adminHeaders = { apikey: config.secretKey, Accept: 'application/json' }
    const registryUrl = new URL(config.supabaseUrl + '/rest/v1/innova_r2_evidence_registry')
    registryUrl.searchParams.set('evidence_id', 'eq.' + evidenceId)
    registryUrl.searchParams.set('select', '*')
    registryUrl.searchParams.set('limit', '1')
    const registry = await jsonFetch(fetcher, registryUrl, { headers: adminHeaders })
    if (!registry.ok) return { status: 503, body: { error: 'Registro no disponible' } }
    const entry = Array.isArray(registry.data) ? registry.data[0] : null
    if (!matchesEvidence(evidence.data[0], entry, userId, profile.data[0].role, MAX_BYTES)) {
      return { status: 404, body: { error: 'Archivo no disponible' } }
    }

    const quota = await jsonFetch(fetcher, config.supabaseUrl + '/rest/v1/rpc/innova_reserve_r2_gateway_read', {
      method: 'POST',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_evidence_id: evidenceId }),
    })
    if (!quota.ok) return { status: 503, body: { error: 'Control de cuotas no disponible' } }
    if (quota.data !== true) return { status: 429, body: { error: 'Límite de acceso alcanzado' } }

    // Only a 60-second private R2 URL leaves Dell. No file bytes cross Vercel or Tunnel.
    const url = signer({
      accountId: config.accountId,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      key: entry.source_key,
    })
    return { status: 200, body: { url, expires_in: 60, size_bytes: entry.size_bytes, mime_type: entry.mime_type } }
  } catch {
    // Never log tokens, signed URLs or personal evidence metadata.
    return { status: 503, body: { error: 'No se pudo autorizar el archivo' } }
  }
}

export function createHandler(config, fetcher = fetch, signer = signEvidenceGet) {
  return async function handler(req, res) {
    const origin = req.headers.origin
    const allowed = origin && config.origins.has(origin)
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Vary', 'Origin')
    }
    for (const [key, value] of Object.entries(safeResponseHeaders)) res.setHeader(key, value)
    const answer = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(body))
    }
    if (origin && !allowed) return answer(403, { error: 'Origen no autorizado' })
    if (req.method === 'GET' && req.url === '/healthz') return answer(200, { ok: true, provider: 'innova-storage-dell', enabled: config.enabled })
    if (req.method === 'OPTIONS') return answer(allowed ? 204 : 403, {})
    const route = /^\/v1\/evidences\/([0-9a-f-]{36})\/authorize$/.exec((req.url || '').split('?')[0])
    if (req.method !== 'POST' || !route) return answer(404, { error: 'No disponible' })
    if (req.headers['transfer-encoding'] || Number(req.headers['content-length'] || 0) > 0) return answer(413, { error: 'Cuerpo no permitido' })
    const auth = req.headers.authorization || ''
    if (!/^Bearer [A-Za-z0-9_=.\\-]+$/.test(auth)) return answer(401, { error: 'No autorizado' })
    const result = await authorizeEvidence(auth.slice(7), route[1], config, fetcher, signer)
    return answer(result.status, result.body)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file://' + process.argv[1]))) {
  const config = loadConfig()
  const server = createServer({ maxHeaderSize: 8192 }, createHandler(config))
  server.headersTimeout = 10000
  server.requestTimeout = 15000
  server.keepAliveTimeout = 5000
  server.maxConnections = 128
  server.listen(config.port, config.host)
}
