import type { SupabaseClient, User } from '@supabase/supabase-js'
import { AdminAuthorizationError, requireAdminSession } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { detectRoleByEmail, normalizeEmail, normalizeRut, normalizeText, syncProfileAndMembership } from '@/lib/user-profiles-admin'
import { NextRequest, NextResponse } from 'next/server'

type ImportUserInput = {
  email?: unknown
  full_name?: unknown
  rut?: unknown
  curso?: unknown
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'error desconocido'
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`No se pudo buscar la cuenta existente: ${error.message}`)
    const found = data.users.find(user => normalizeEmail(user.email) === email)
    if (found) return found
    if (data.users.length < 1000) break
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { user: currentAdmin } = await requireAdminSession()
    const { users } = await req.json()

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'No hay usuarios para importar' }, { status: 400 })
    }
    if (users.length > 500) {
      return NextResponse.json({ error: 'Importa como máximo 500 usuarios por archivo' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    let ok = 0
    const errores: string[] = []

    for (const rawValue of users) {
      const raw = (rawValue ?? {}) as ImportUserInput
      const email = normalizeEmail(raw.email)
      const fullName = normalizeText(raw.full_name)
      const rut = normalizeRut(raw.rut)
      const curso = normalizeText(raw.curso)
      const role = detectRoleByEmail(email)

      try {
        if (!email || !fullName || !rut || (role === 'estudiante' && !curso)) {
          throw new Error('faltan nombre, RUT, correo o curso')
        }

        const password = rut.replace(/\./g, '').replace('-', '')
        if (password.length < 6) throw new Error('el RUT no permite crear una contraseña inicial válida')

        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, rut, curso: role === 'estudiante' ? curso : '', role },
        })

        let authUser = created.user
        if (createError || !authUser) {
          authUser = await findAuthUserByEmail(admin, email)
        }
        if (!authUser) throw new Error(createError?.message ?? 'no se pudo crear o localizar la cuenta')

        const { error: metadataError } = await admin.auth.admin.updateUserById(authUser.id, {
          user_metadata: {
            ...(authUser.user_metadata ?? {}),
            full_name: fullName,
            rut,
            curso: role === 'estudiante' ? curso : '',
            role,
          },
        })
        if (metadataError) throw new Error(`no se pudieron actualizar los metadatos: ${metadataError.message}`)

        await syncProfileAndMembership(admin, { userId: authUser.id, email, fullName, rut, curso, role })
        ok += 1
      } catch (error: unknown) {
        errores.push(`${email || '(sin correo)'}: ${errorMessage(error)}`)
      }
    }

    await admin.from('audit_log').insert({
      action: 'importar',
      entity: 'usuario',
      entity_name: `${ok} usuarios importados`,
      user_id: currentAdmin.id,
      user_email: currentAdmin.email,
    })

    return NextResponse.json({ ok, errores })
  } catch (error: unknown) {
    const status = error instanceof AdminAuthorizationError ? error.status : 500
    return NextResponse.json({ error: errorMessage(error) }, { status })
  }
}
