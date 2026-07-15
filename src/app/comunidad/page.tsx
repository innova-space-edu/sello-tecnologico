import Link from 'next/link'
import CommunityFeed from '@/components/social/CommunityFeed'
import CommunityTrending from '@/components/social/CommunityTrending'

export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/comunidad', icon: '🏠', label: 'Inicio' },
  { href: '/comunidad?type=image', icon: '🖼️', label: 'Imágenes' },
  { href: '/comunidad?type=video', icon: '🎬', label: 'Videos' },
  { href: '/comunidad?type=audio', icon: '🎙️', label: 'Podcasts' },
  { href: '/vitrinas', icon: '🌐', label: 'Administrar páginas' },
]

export default function ComunidadPage() {
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
            <Link href="/login" className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">Ingresar</Link>
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
            <p className="mt-2 text-sm leading-relaxed text-blue-100">Todas las páginas, proyectos, podcasts y evidencias públicas conectadas en un feed continuo.</p>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-sm sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-100">Red social educativa</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Descubre lo que está creando nuestra comunidad</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-100 sm:text-base">Explora publicaciones de todos los proyectos, reacciona, comenta, comparte y sigue las páginas que más te interesan.</p>
          </div>
          <CommunityFeed />
        </section>

        <div className="hidden lg:block"><CommunityTrending /></div>
      </div>
    </main>
  )
}
