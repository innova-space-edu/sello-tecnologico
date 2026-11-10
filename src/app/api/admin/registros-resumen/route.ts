import { AdminAuthorizationError, requireAdminSession } from '@/lib/admin-auth'
import { createFamilyAdminClient, privateResponse } from '@/lib/family-consent/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Las métricas no incluyen nombres ni datos personales y nunca se exponen sin rol admin.
export async function GET() {
  try {
    await requireAdminSession()
    const db = createFamilyAdminClient()
    const [requests, pending, approved, acts, official, moderation] = await Promise.all([
      db.from('family_authorization_requests').select('id', { count: 'exact', head: true }).eq('platform', 'sello'),
      db.from('family_authorization_requests').select('id', { count: 'exact', head: true }).eq('platform', 'sello').eq('status', 'submitted'),
      db.from('family_authorization_requests').select('id', { count: 'exact', head: true }).eq('platform', 'sello').eq('status', 'approved'),
      db.from('sello_family_approval_acts').select('folio', { count: 'exact', head: true }),
      db.from('sello_family_approval_acts').select('folio', { count: 'exact', head: true }).eq('record_type', 'aprobacion'),
      db.from('flagged_messages').select('id', { count: 'exact', head: true }).eq('reviewed', false),
    ])
    if ([requests, pending, approved, acts, official, moderation].some(item => item.error)) {
      return privateResponse({ error: 'No se pudo calcular el resumen administrativo.' }, 503)
    }
    return privateResponse({
      authorizations: { total: requests.count ?? 0, pending: pending.count ?? 0, approved: approved.count ?? 0 },
      acts: { total: acts.count ?? 0, official: official.count ?? 0 },
      moderation: { pending: moderation.count ?? 0 },
    })
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return privateResponse({ error: error.message }, error.status)
    return privateResponse({ error: 'Resumen administrativo no disponible.' }, 503)
  }
}
