import { createServerSupabaseClient } from '@/lib/supabase-server'

export class AdminAuthorizationError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AdminAuthorizationError'
    this.status = status
  }
}

export async function requireAdminSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new AdminAuthorizationError('No autenticado', 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    throw new AdminAuthorizationError('Solo los administradores pueden realizar esta acción', 403)
  }

  return { supabase, user }
}
