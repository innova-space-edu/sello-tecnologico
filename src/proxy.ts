import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createFamilyAdminClient } from '@/lib/family-consent/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  const publicPaths = [
    '/login',
    '/registro',
    '/bloqueado',
    '/formularios',
    '/autorizacion-familiar',
    '/autorizacion-pendiente',
    '/api/family-consent',
    '/auth/callback',
    '/api/register-profile',
    '/api/promedios/editor/callback',
    '/comunidad',
    '/p',
    '/api/feed',
    '/api/stories',
    '/api/vitrinas/social',
    '/api/vitrinas/assets',
  ]
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))

  // También refresca la sesión en rutas públicas. Así /comunidad puede
  // reconocer al usuario conectado sin convertir la página en privada.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (isPublicPath) return response

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('blocked, role')
    .eq('id', user.id)
    .single()

  // Staged enforcement: activate only after the migration, onboarding and privacy
  // review. An invitation signature is insufficient; only institution-approved
  // records may unlock a student's protected dashboard and API access.
  if (process.env.SELLO_FAMILY_CONSENT_ENFORCE === 'true' && perfil?.role === 'estudiante') {
    try {
      const db = createFamilyAdminClient()
      const { data: permission, error: familyError } = await db.from('family_authorization_requests')
        .select('id,decisions').eq('student_user_id', user.id)
        .eq('platform', 'sello').eq('status', 'approved')
        .order('reviewed_at', { ascending: false }).limit(1).maybeSingle()
      if (familyError || !permission) {
        if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Autorización familiar pendiente de verificación institucional' }, { status: 403 })
        return NextResponse.redirect(new URL('/autorizacion-pendiente', request.url))
      }
    } catch {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'No se pudo verificar autorización familiar' }, { status: 503 })
      return NextResponse.redirect(new URL('/autorizacion-pendiente', request.url))
    }
  }

  if (perfil?.blocked && perfil?.role !== 'admin') {
    return NextResponse.redirect(new URL('/bloqueado', request.url))
  }

  const rutasRestringidas = [
    '/cursos/nuevo',
    '/usuarios/importar',
    '/notificaciones',
    '/admin',
    '/usuarios',
    '/promedios',
  ]

  if (perfil?.role === 'estudiante') {
    const restringida = rutasRestringidas.some(r => pathname.startsWith(r))
    if (restringida) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  const rolesDocente = ['docente', 'coordinador', 'utp']
  const rutasDocenteRestringidas = [
    '/admin',
    '/notificaciones',
    '/usuarios',
  ]
  if (rolesDocente.includes(perfil?.role ?? '')) {
    const restringida = rutasDocenteRestringidas.some(r => pathname.startsWith(r))
    if (restringida) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf)$|login|registro|bloqueado|formularios).*)',
  ],
}
