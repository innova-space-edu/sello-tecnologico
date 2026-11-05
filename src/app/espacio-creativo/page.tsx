import type { Metadata } from 'next'
import Link from 'next/link'
import CreativeGallery from '@/components/creative/CreativeGallery'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Espacio creativo',
  description: 'Museo digital de imágenes, videos y podcasts creados por nuestra comunidad educativa.',
}

export default async function EspacioCreativoPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name,role,blocked').eq('id', user.id).maybeSingle()
    : { data: null }

  const canUpload = Boolean(user && profile && !profile.blocked &&
    ['admin','coordinador','utp','docente','estudiante'].includes(profile.role))

  return (
    <main className="min-h-screen bg-[#090e1b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090e1b]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/comunidad" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-2xl">✦</span>
            <span>
              <strong className="block text-base tracking-wide">Sello Tecnológico</strong>
              <small className="text-slate-400">Colegio Providencia · Galería creativa</small>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link href={profile?.role === 'admin' ? '/admin' : user ? '/dashboard' : '/comunidad'}
              className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-white/10 px-4 py-2.5 font-bold text-white transition hover:border-fuchsia-300 hover:bg-white/20">
              ← Volver {profile?.role === 'admin' ? 'a Administración' : user ? 'a la plataforma' : 'a Comunidad'}
            </Link>
            {profile?.role === 'admin' && (
              <Link href="/admin/espacio-creativo" className="rounded-full px-4 py-2 text-fuchsia-200 hover:bg-white/10">
                Revisar obras
              </Link>
            )}
            <Link href="/comunidad" className="rounded-full px-4 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white">Comunidad</Link>
            <Link href="/dashboard" className="rounded-full px-4 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white">Plataforma</Link>
            {user ? (
              <span className="hidden max-w-40 truncate rounded-full border border-white/10 px-4 py-2 text-slate-300 sm:block">{profile?.full_name || user.email}</span>
            ) : (
              <Link href="/login" className="rounded-full border border-white/20 px-4 py-2 hover:bg-white/10">Iniciar sesión</Link>
            )}
          </nav>
        </div>
      </header>
      <CreativeGallery canUpload={canUpload} viewerName={profile?.full_name || ''} />
    </main>
  )
}
