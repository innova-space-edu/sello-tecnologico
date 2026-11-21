/**
 * Ephemeral LOCAL test only. No port published and no tokens/URLs logged.
 * Requests the real CreaLab Supabase password login from stdin, passes the JWT
 * through the real Node HTTP handler, downloads ONLY the known 65KiB pilot
 * directly from private R2 and compares SHA-256. Uses one authorized quota read.
 */
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { createHandler, loadConfig } from './server.mjs'

const SUPABASE_URL = 'https://xfleqorozycfdmefdejs.supabase.co'
const ACCOUNT_ID = '84ed45de70a021c365e93b960c406d48'
const ID = 'cb497fe7-f927-401c-81e2-bf09d4256cc6'
const EXPECTED_SHA = '759757aada53dd9f3d32dbf03f26bb49d4c0488c36949beb1b34d8a0fecba128'
const EXPECTED_SIZE = 65468
let phase = 'preflight'
const pass = value => console.log('PASS: ' + value)
function safeError(err) {
  // Deliberately hide response bodies, credentials, request headers and URLs.
  const status = typeof err?.status === 'number' ? ' — HTTP ' + err.status : ''
  console.error('FAIL: ' + phase + status)
  process.exitCode = 1
}

async function readCredentials() {
  let input = ''
  for await (const chunk of process.stdin) {
    input += String(chunk)
    if (input.length > 4096) throw new Error('invalid input')
  }
  const lines = input.replace(/\r/g, '').split('\n')
  const email = lines[0]?.trim().toLowerCase()
  const password = lines[1]
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== 'string' || password.length < 6 || password.length > 2048) {
    throw new Error('invalid input')
  }
  input = ''
  return { email, password }
}
async function fetchExpected(url, options, status = 200) {
  const response = await fetch(url, {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000), ...options
  })
  if (response.status !== status) {
    const error = new Error('request failed')
    error.status = response.status
    throw error
  }
  return response
}
async function run() {
  if (process.env.INNOVA_STORAGE_DELL_ENABLED !== 'false') throw new Error('permanent mode is not disabled')
  if (process.env.SUPABASE_URL !== SUPABASE_URL || process.env.R2_ACCOUNT_ID !== ACCOUNT_ID) {
    throw new Error('wrong environment')
  }
  const config = loadConfig({ ...process.env, INNOVA_STORAGE_DELL_ENABLED: 'true', HOST: '127.0.0.1' })
  // Do not open a port on the host; only 127.0.0.1 inside this ephemeral container.
  const origin = [...config.origins][0]
  if (!origin?.startsWith('https://')) throw new Error('no HTTPS origin configured')

  phase = 'login Supabase'
  let { email, password } = await readCredentials()
  let login
  try {
    const response = await fetchExpected(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: config.publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    login = await response.json()
  } finally {
    password = null
    email = null
  }
  if (typeof login?.access_token !== 'string' || login.access_token.length < 40) {
    throw new Error('no access token')
  }
  const token = login.access_token
  login = null
  pass('sesión real de CreaLab iniciada; JWT solo en memoria')

  phase = 'HTTP Dell authorization'
  const server = createServer({ maxHeaderSize: 8192 }, createHandler(config))
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const port = server.address().port
    const response = await fetchExpected('http://127.0.0.1:' + port + '/v1/evidences/' + ID + '/authorize', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, Origin: origin, Accept: 'application/json' }
    })
    const authorized = await response.json()
    if (authorized.expires_in !== 60 || authorized.size_bytes !== EXPECTED_SIZE ||
        typeof authorized.url !== 'string') throw new Error('bad signed response')
    const signed = new URL(authorized.url)
    if (signed.protocol !== 'https:' || signed.hostname !== ACCOUNT_ID + '.r2.cloudflarestorage.com' ||
        signed.searchParams.get('X-Amz-Expires') !== '60') throw new Error('bad R2 endpoint')
    pass('API Dell validó JWT, permisos, registro privado y reserva de cuota')
    phase = 'GET privado R2'
    const bytes = new Uint8Array(await (await fetchExpected(signed, {})).arrayBuffer())
    if (bytes.length !== EXPECTED_SIZE || createHash('sha256').update(bytes).digest('hex') !== EXPECTED_SHA) {
      throw new Error('hash mismatch')
    }
    pass('R2 devolvió 65.468 bytes y SHA-256 correcto')
    pass('prueba autenticada completada; no se publicaron puertos ni credenciales')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(safeError)
