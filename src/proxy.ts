import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()

  const publicPaths = ['/login', '/registro', '/bloqueado']
  if (publicPaths.some(p => request.nextUrl.pathname.startsWith(p))) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('blocked, role')
    .eq('id', user.id)
    .single()

  if (perfil?.blocked && perfil?.role !== 'admin') {
    return NextResponse.redirect(new URL('/bloqueado', request.url))
  }

  const rutasRestringidas = [
    '/cursos/nuevo',
    '/proyectos/nuevo',
    '/evidencias/nueva',
    '/usuarios/importar',
    '/notificaciones',
    '/admin',
    '/historial',
  ]

  if (perfil?.role === 'estudiante') {
    const restringida = rutasRestringidas.some(r => request.nextUrl.pathname.startsWith(r))
    if (restringida) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|registro|bloqueado).*)',
  ],
}
