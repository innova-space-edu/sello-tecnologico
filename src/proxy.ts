import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAccountStatus } from '@/lib/family-consent/account-status'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  // Páginas abiertas de CreaLab: exclusivamente Comunidad y la galería
  // de Espacio Creativo. Las subrutas (Mis obras, edición, vitrinas, etc.)
  // requieren sesión; los formularios de alta/autorización conservan su
  // acceso público indispensable para personas invitadas.
  const publicSurfaces = pathname === '/comunidad' || pathname === '/espacio-creativo'
  const publicSupport = [
    '/login', '/consentimiento', '/registro', '/bloqueado',
    '/formularios', '/autorizacion-familiar', '/autorizacion-pendiente',
    '/api/family-consent', '/api/privacy/self', '/proteccion-datos', '/auth/callback',
    '/api/register-profile', '/api/promedios/editor/callback',
  ].some(path => pathname === path || pathname.startsWith(path + '/'))

  // Solo las APIs que alimentan las dos páginas públicas y sus recursos.
  // Sus endpoints de creación/moderación mantienen su propia validación
  // de sesión y no se abren mediante una excepción general de subrutas.
  const publicMethod = request.method === 'GET' || request.method === 'HEAD'
  const storySocial = /^\/api\/stories\/[^/]+\/social$/.test(pathname)
  const pageSocial = pathname.startsWith('/api/vitrinas/social/')
  const publicReadApi = publicMethod && (
    pathname === '/api/feed' || pathname.startsWith('/api/feed/') ||
    pathname === '/api/stories' || storySocial ||
    pathname === '/api/espacio-creativo' || pageSocial ||
    pathname.startsWith('/api/vitrinas/assets/')
  )
  // Las reacciones y métricas de visitantes siguen gestionadas por las
  // rutas sociales públicas; nunca concede acceso a endpoints privados.
  const publicSocialAction = request.method === 'POST' && (storySocial || pageSocial)
  // Los enlaces de encuestas aprobadas funcionan para cualquier visitante,
  // sin dar acceso a la bandeja privada ni a las APIs de creación/revisión.
  const publicOnlineForm = /^\/formularios-online\/[a-z0-9-]{10,80}\/?$/.test(pathname)
  const publicOnlineApi = /^\/api\/formularios-online\/[a-z0-9-]{10,80}\/?$/.test(pathname) &&
    ['GET', 'HEAD', 'POST'].includes(request.method)
  const isPublicPath = publicSupport || publicSurfaces || publicReadApi ||
    publicSocialAction || publicOnlineForm || publicOnlineApi

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

  // Formularios en línea publicados: acceso anónimo de lectura y respuesta.
  // La API verifica siempre el estado publicado, los datos y los límites.
  if (publicOnlineForm || publicOnlineApi) return response

  // Public content remains available to unauthenticated visitors. Authenticated
  // minors must not bypass the guardian gate by navigating to public app surfaces.
  const legalOrAuthorizationPath = ['/login','/consentimiento','/registro','/autorizacion-familiar',
    '/autorizacion-pendiente','/proteccion-datos','/auth/callback','/api/family-consent','/api/privacy/self',
    '/api/register-profile','/bloqueado'].some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isPublicPath && (!user || legalOrAuthorizationPath)) return response

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // All private routes share the same verified account state.
  // The admin role comes from the protected profile, not editable auth metadata.
  let status:Awaited<ReturnType<typeof getAccountStatus>>
  try{status=await getAccountStatus(user)}catch{
    if(pathname.startsWith('/api/'))return NextResponse.json({error:'No se pudo verificar el estado de la cuenta.'},{status:503})
    return NextResponse.redirect(new URL('/autorizacion-pendiente',request.url))
  }
  const requiredInitialPrivacy=status.next==='/consentimiento'
  if(requiredInitialPrivacy||status.next==='/autorizacion-pendiente'||status.next==='/bloqueado'){
    if(pathname.startsWith('/api/'))return NextResponse.json({error:requiredInitialPrivacy?'Debes aceptar las condiciones vigentes una sola vez.':'Acceso pendiente de verificación institucional.',action:status.next},{status:403})
    return NextResponse.redirect(new URL(status.next,request.url))
  }
  if(isPublicPath)return response
  const perfil={role:status.role,blocked:status.blocked}

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
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf)$|login|registro|bloqueado).*)',
  ],
}
