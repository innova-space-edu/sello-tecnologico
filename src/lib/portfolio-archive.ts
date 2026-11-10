import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export { ARCHIVE_CATEGORIES, isArchiveCategory } from '@/lib/portfolio-archive-categories'

export const isArchiveId = (value: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)

export async function authorizeArchiveAccess(requestedOwner: string | null) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) return { error: 'Debes iniciar sesión.', status: 401 } as const
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('role,blocked').eq('id', user.id).maybeSingle()
  if (profileError || !profile || (profile.blocked && profile.role !== 'admin')) {
    return { error: 'La cuenta no está habilitada.', status: 403 } as const
  }
  const ownerId = requestedOwner || user.id
  if (!isArchiveId(ownerId)) return { error: 'Identificador de estudiante inválido.', status: 400 } as const
  if (ownerId !== user.id && profile.role !== 'admin') {
    return { error: 'Solo el estudiante y administración pueden consultar este archivo.', status: 403 } as const
  }
  return { ownerId, admin: createAdminSupabaseClient() }
}
