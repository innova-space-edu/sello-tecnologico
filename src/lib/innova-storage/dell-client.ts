import { createClient } from '@/lib/supabase'

export type AuthorizedR2Download = {
  url: string
  expires_in: number
  size_bytes: number
  mime_type: string
}

/** Browser-only. Fail closed if the Dell feature is enabled but authorization fails. */
export async function authorizeDellEvidenceDownload(evidenceId: string): Promise<AuthorizedR2Download | null> {
  const base = process.env.NEXT_PUBLIC_INNOVA_STORAGE_DELL_URL
  const enabled = process.env.NEXT_PUBLIC_INNOVA_STORAGE_DELL_ENABLED === 'true'
  if (!enabled) return null
  if (!base || !/^[a-f0-9-]{36}$/i.test(evidenceId)) throw new Error('Acceso privado no disponible')
  const api = new URL(base)
  if (api.protocol !== 'https:' || api.pathname !== '/' || api.search || api.hash) throw new Error('API no configurada')
  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new Error('Debes iniciar sesión')
  const response = await fetch(api.origin + '/v1/evidences/' + evidenceId + '/authorize', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.access_token },
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok) throw new Error('No se pudo autorizar el archivo')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object') throw new Error('Respuesta inválida')
  const entry = data as Partial<AuthorizedR2Download>
  if (typeof entry.url !== 'string' || entry.expires_in !== 60 ||
      !Number.isSafeInteger(entry.size_bytes) || Number(entry.size_bytes) <= 0 ||
      Number(entry.size_bytes) > 100000000 || typeof entry.mime_type !== 'string') {
    throw new Error('Respuesta inválida')
  }
  const signed = new URL(entry.url)
  if (signed.protocol !== 'https:' || signed.hostname !== '84ed45de70a021c365e93b960c406d48.r2.cloudflarestorage.com') {
    throw new Error('Destino inesperado')
  }
  return entry as AuthorizedR2Download
}
