import type { SupabaseClient } from '@supabase/supabase-js'

export const ALLOWED_USER_ROLES = ['estudiante', 'docente', 'coordinador', 'utp', 'admin'] as const
export type UserRole = typeof ALLOWED_USER_ROLES[number]

export type ProfileInput = {
  userId: string
  email: string
  fullName: string
  rut?: string
  curso?: string
  role: UserRole
}

export function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

export function normalizeRut(value: unknown) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-')
}

export function normalizeText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function detectRoleByEmail(email: string): UserRole {
  return normalizeEmail(email).endsWith('@colprovidencia.cl') ? 'docente' : 'estudiante'
}

export function isAllowedUserRole(value: unknown): value is UserRole {
  return ALLOWED_USER_ROLES.includes(String(value ?? '') as UserRole)
}

async function ensureCourse(admin: SupabaseClient, courseName: string) {
  const name = normalizeText(courseName)
  if (!name) return null

  const { data: existing, error: selectError } = await admin
    .from('courses')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (selectError) throw new Error(`No se pudo buscar el curso: ${selectError.message}`)
  if (existing?.id) return existing.id as string

  const { data: created, error: insertError } = await admin
    .from('courses')
    .insert({ name, year: new Date().getFullYear(), area: 'Tecnología' })
    .select('id')
    .single()

  if (!insertError && created?.id) return created.id as string

  // Si dos registros crean el mismo curso al mismo tiempo, volver a buscarlo.
  const { data: afterRace, error: raceError } = await admin
    .from('courses')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (raceError || !afterRace?.id) {
    throw new Error(`No se pudo crear el curso: ${insertError?.message ?? raceError?.message ?? 'error desconocido'}`)
  }

  return afterRace.id as string
}

export async function syncProfileAndMembership(admin: SupabaseClient, input: ProfileInput) {
  const email = normalizeEmail(input.email)
  const fullName = normalizeText(input.fullName)
  const rut = normalizeRut(input.rut)
  const role = input.role
  const curso = role === 'estudiante' ? normalizeText(input.curso) : ''

  if (!input.userId) throw new Error('Falta el identificador del usuario')
  if (!email || !email.includes('@')) throw new Error('El correo no es válido')
  if (!fullName) throw new Error('El nombre completo es obligatorio')
  if (role === 'estudiante' && !curso) throw new Error('El curso es obligatorio para estudiantes')

  const { data: previousProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', input.userId)
    .maybeSingle()

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: input.userId,
      email,
      full_name: fullName,
      rut: rut || null,
      curso: curso || null,
      role,
    }, { onConflict: 'id' })

  if (profileError) throw new Error(`No se pudo guardar el perfil: ${profileError.message}`)

  // Un estudiante queda asociado a un único curso principal. Si cambia de curso
  // o deja de ser estudiante, se reemplaza la membresía anterior.
  if (role === 'estudiante' || previousProfile?.role === 'estudiante') {
    const { error: clearMembershipError } = await admin
      .from('course_members')
      .delete()
      .eq('user_id', input.userId)

    if (clearMembershipError) {
      throw new Error(`No se pudo actualizar la membresía del curso: ${clearMembershipError.message}`)
    }
  }

  if (role === 'estudiante' && curso) {
    const courseId = await ensureCourse(admin, curso)
    if (courseId) {
      const { error: membershipError } = await admin
        .from('course_members')
        .upsert({ course_id: courseId, user_id: input.userId }, { onConflict: 'course_id,user_id' })

      if (membershipError) {
        throw new Error(`No se pudo asignar el curso: ${membershipError.message}`)
      }
    }
  }

  return { id: input.userId, email, full_name: fullName, rut: rut || null, curso: curso || null, role }
}
