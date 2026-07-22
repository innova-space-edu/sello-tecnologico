import Link from 'next/link'
import CommunityFeed from '@/components/social/CommunityFeed'
import CommunityTrending from '@/components/social/CommunityTrending'
import StoriesRail from '@/components/stories/StoriesRail'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/comunidad', icon: '🏠', label: 'Inicio' },
  { href: '/comunidad?type=image', icon: '🖼️', label: 'Imágenes' },
  { href: '/comunidad?type=video', icon: '🎬', label: 'Videos' },
  { href: '/comunidad?type=audio', icon: '🎙️', label: 'Podcasts' },
  { href: '/vitrinas', icon: '🌐', label: 'Administrar páginas' },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  coordinador: 'Coordinación',
  utp: 'UTP',
  docente: 'Docente',
  estudiante: 'Estudiante',
}

export default async function ComunidadPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase
      .from('profiles')
      .select('id, full_name, role, curso')
      .eq('id', user.id)
      .maybeSingle()
    : { data: null }

  const viewer = user ? {
    id: user.id,
    name: profile?.full_name || user.email || 'Usuario',
    role: profile?.role || '',
    course: profile?.curso || null,
  } : null
  const viewerInitial = viewer?.name.trim().charAt(0).toUpperCase() || 'U'
  const viewerDetail = viewer
    ? [ROLE_LABELS[viewer.role] || viewer.role, viewer.course].filter(Boolean).join(' · ')
    : ''

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/comunidad" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-xl text-white shadow-sm">🌐</div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black leading-tight text-blue-950">Comunidad Sello Tecnológico</p>
              <p className="truncate text-xs font-semibold text-slate-500">Colegio Providencia · Proyectos que inspiran</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/vitrinas" className="hidden rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-100 sm:block">Crear publicación</Link>
            {viewer ? (
              <Link href="/portafolio" className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition hover:border-blue-200 hover:bg-blue-50" aria-label={`Abrir el perfil de ${viewer.name}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white">{viewerInitial}</span>
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block max-w-40 truncate text-sm font-black text-slate-800">{viewer.name}</span>
                  <span className="block max-w-40 truncate text-[11px] font-semibold text-slate-500">{viewerDetail || 'Mi perfil'}</span>
                </span>
                <span className="text-xs font-black text-blue-700 sm:hidden">Mi perfil</span>
              </Link>
            ) : (
              <Link href="/login" className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">Ingresar</Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,700px)_320px] lg:items-start">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <nav className="space-y-1 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            {NAV.map(item => (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-800">
                <span className="text-lg">{item.icon}</span><span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-4 rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-800 p-5 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-blue-200">Sello Tecnológico</p>
            <h2 className="mt-2 text-lg font-black">Una sola comunidad</h2>
            <p className="mt-2 text-sm leading-relaxed text-blue-100">Todas las páginas, proyectos, podcasts, historias y evidencias públicas conectadas en un feed continuo.</p>
          </div>
        </aside>

        <section className="min-w-0">
          <StoriesRail viewer={viewer} />
          <CommunityFeed />
        </section>

        <div className="hidden lg:block"><CommunityTrending /></div>
      </div>
    </main>
  )
}
