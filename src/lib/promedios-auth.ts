import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const PROMEDIOS_ROLES = ['admin', 'docente', 'coordinador', 'utp'] as const

export type PromediosActor = {
  id: string
  role: string
  fullName: string
}

export async function getPromediosActor(): Promise<PromediosActor | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, full_name, blocked')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.blocked || !PROMEDIOS_ROLES.includes(profile.role as (typeof PROMEDIOS_ROLES)[number])) {
    return null
  }

  return {
    id: profile.id,
    role: profile.role,
    fullName: profile.full_name ?? user.email ?? 'Docente',
  }
}

export async function canAccessCourse(actor: PromediosActor, courseId: string) {
  if (['admin', 'coordinador', 'utp'].includes(actor.role)) return true

  const admin = createAdminSupabaseClient()
  const [{ data: course }, { data: membership }] = await Promise.all([
    admin.from('courses').select('id, created_by').eq('id', courseId).maybeSingle(),
    admin.from('course_members').select('course_id').eq('course_id', courseId).eq('user_id', actor.id).maybeSingle(),
  ])

  return Boolean(course && (course.created_by === actor.id || membership))
}

export function noStoreHeaders(extra: Record<string, string> = {}) {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...extra,
  }
}
