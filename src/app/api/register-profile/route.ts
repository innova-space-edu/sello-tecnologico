import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { detectRoleByEmail, normalizeRut, normalizeText, syncProfileAndMembership } from '@/lib/user-profiles-admin'
import { NextRequest, NextResponse } from 'next/server'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar el perfil'
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Falta el identificador del usuario' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data, error: userError } = await admin.auth.admin.getUserById(userId)

    if (userError || !data.user?.email) {
      return NextResponse.json({ error: 'No se encontró la cuenta recién creada' }, { status: 404 })
    }

    const metadata = data.user.user_metadata ?? {}
    const email = data.user.email
    const role = detectRoleByEmail(email)
    const fullName = normalizeText(metadata.full_name)
    const rut = normalizeRut(metadata.rut)
    const curso = role === 'estudiante' ? normalizeText(metadata.curso) : ''

    if (!fullName || !rut || (role === 'estudiante' && !curso)) {
      return NextResponse.json({
        error: 'La cuenta fue creada, pero faltan datos del perfil. Solicita al administrador que los complete.',
      }, { status: 400 })
    }

    const profile = await syncProfileAndMembership(admin, {
      userId,
      email,
      fullName,
      rut,
      curso,
      role,
    })

    return NextResponse.json({ ok: true, profile })
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
