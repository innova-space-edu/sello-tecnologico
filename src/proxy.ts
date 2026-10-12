import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createFamilyAdminClient } from '@/lib/family-consent/server'
import { shouldEnforceFamilyConsent } from '@/lib/family-consent/transition'

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
    '/proteccion-datos',
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

  // Public content remains available to unauthenticated visitors. Authenticated
  // minors must not bypass the guardian gate by navigating to public app surfaces.
  const legalOrAuthorizationPath = ['/login','/registro','/autorizacion-familiar',
    '/autorizacion-pendiente','/proteccion-datos','/auth/callback','/api/family-consent',
    '/api/register-profile','/bloqueado'].some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isPublicPath && (!user || legalOrAuthorizationPath)) return response

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Existing accounts are not blocked by the new consent requirements before 15 Nov 2026.
  const familyEnforceLegacy = process.env.SELLO_FAMILY_CONSENT_ENFORCE === 'true'

  const { data: perfil } = await supabase
    .from('profiles')
    .select('blocked, role')
    .eq('id', user.id)
    .single()

  // Los menores inscritos desde el nuevo formulario requieren autorización de forma inmediata.
  // El período de transición se conserva para las cuentas antiguas.
  const { data: lockedAge, error: ageError } = await createFamilyAdminClient()
    .from('family_age_status').select('declared_birth_date,captured_at')
    .eq('user_id', user.id).maybeSingle()
  const familyConsentEnabled = shouldEnforceFamilyConsent(user.created_at, lockedAge?.captured_at, familyEnforceLegacy)
  const rawDob = ageError ? '' : String(lockedAge?.declared_birth_date || '')
  const dob = new Date(rawDob + 'T00:00:00')
  const now = new Date()
  const under18 = !rawDob || Number.isNaN(dob.getTime()) ||
    dob > new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  if (familyConsentEnabled && under18) {
    try {
      const db = createFamilyAdminClient()
      const { data: permission, error: familyError } = await db.from('family_authorization_requests')
        .select('id,status,decisions,document_version').eq('student_user_id', user.id)
        .eq('platform', 'sello').in('status', ['approved','revoked'])
        .order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (familyError || !permission || permission.status !== 'approved' || permission.document_version !== 'family-2026-10-v1' || permission.decisions?.platform_access !== true) {
        if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Autorización familiar pendiente de verificación institucional' }, { status: 403 })
        return NextResponse.redirect(new URL('/autorizacion-pendiente', request.url))
      }
    } catch {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'No se pudo verificar autorización familiar' }, { status: 503 })
      return NextResponse.redirect(new URL('/autorizacion-pendiente', request.url))
    }
  }

  if (isPublicPath) return response

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
