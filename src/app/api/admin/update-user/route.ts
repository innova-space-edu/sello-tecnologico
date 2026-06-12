import { AdminAuthorizationError, requireAdminSession } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { isAllowedUserRole, normalizeEmail, normalizeRut, normalizeText, syncProfileAndMembership } from '@/lib/user-profiles-admin'
import { NextRequest, NextResponse } from 'next/server'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo actualizar el usuario'
}

export async function PATCH(req: NextRequest) {
  try {
    const { user: currentAdmin } = await requireAdminSession()
    const body = await req.json()
    const userId = String(body.userId ?? '')
    const email = normalizeEmail(body.email)
    const fullName = normalizeText(body.full_name)
    const rut = normalizeRut(body.rut)
    const curso = normalizeText(body.curso)
    const role = body.role

    if (!userId) return NextResponse.json({ error: 'Falta el usuario' }, { status: 400 })
    if (!isAllowedUserRole(role)) return NextResponse.json({ error: 'Rol no válido' }, { status: 400 })
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Correo no válido' }, { status: 400 })
    if (!fullName) return NextResponse.json({ error: 'El nombre completo es obligatorio' }, { status: 400 })
    if (role === 'estudiante' && !curso) return NextResponse.json({ error: 'El curso es obligatorio para estudiantes' }, { status: 400 })
    if (userId === currentAdmin.id && role !== 'admin') {
      return NextResponse.json({ error: 'No puedes quitar tu propio permiso de administrador' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data: authData, error: authReadError } = await admin.auth.admin.getUserById(userId)
    if (authReadError || !authData.user) {
      return NextResponse.json({ error: 'La cuenta no existe en Supabase Auth' }, { status: 404 })
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
      email,
      user_metadata: {
        ...(authData.user.user_metadata ?? {}),
        full_name: fullName,
        rut,
        curso: role === 'estudiante' ? curso : '',
        role,
      },
    })

    if (authUpdateError) {
      return NextResponse.json({ error: `No se pudo actualizar el acceso: ${authUpdateError.message}` }, { status: 500 })
    }

    const profile = await syncProfileAndMembership(admin, {
      userId,
      email,
      fullName,
      rut,
      curso,
      role,
    })

    await admin.from('audit_log').insert({
      action: 'actualizar',
      entity: 'usuario',
      entity_name: email,
      user_id: currentAdmin.id,
      user_email: currentAdmin.email,
    })

    return NextResponse.json({ ok: true, profile })
  } catch (error: unknown) {
    const status = error instanceof AdminAuthorizationError ? error.status : 500
    return NextResponse.json({ error: errorMessage(error) }, { status })
  }
}
