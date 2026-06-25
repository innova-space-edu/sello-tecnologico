import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import Link from 'next/link'

type PublicPage = {
  id: string
  title: string
  slug: string
  description?: string | null
  theme_color?: string | null
  accent_color?: string | null
  projects?: { title?: string | null } | null
  courses?: { name?: string | null } | null
  profiles?: { full_name?: string | null } | null
}

type Block = {
  id: string
  type: string
  title?: string | null
  content?: string | null
  sort_order?: number | null
}

type Asset = {
  id: string
  file_name: string
  file_type: string
  title?: string | null
  description?: string | null
}

function assetIcon(type: string) {
  if (type === 'audio') return '🎧'
  if (type === 'video') return '🎬'
  if (type === 'image') return '🖼️'
  if (type === 'pdf') return '📄'
  return '📎'
}

function renderBlock(block: Block) {
  const label: Record<string, string> = {
    text: 'Texto',
    post: 'Publicación',
    podcast_episode: 'Podcast',
    audio: 'Audio',
    video: 'Video',
    gallery: 'Galería',
    credits: 'Créditos',
  }

  return (
    <section key={block.id} className="bg-white/95 backdrop-blur rounded-3xl shadow-sm border border-white/70 p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">
          {label[block.type] ?? block.type}
        </span>
      </div>
      {block.title && <h2 className="text-2xl font-bold text-slate-900 mb-3">{block.title}</h2>}
      {block.content && <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{block.content}</p>}
    </section>
  )
}

export default async function PublicProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminSupabaseClient()

  const { data: page } = await admin
    .from('project_public_pages')
    .select('*, projects(title), courses(name), profiles!project_public_pages_created_by_fkey(full_name)')
    .eq('slug', slug)
    .eq('is_public', true)
    .eq('status', 'published')
    .single()

  if (!page) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="text-5xl mb-4">🌐</div>
          <h1 className="text-2xl font-bold">Página no disponible</h1>
          <p className="text-slate-300 mt-2">La vitrina no existe, está oculta o todavía no fue publicada.</p>
        </div>
      </main>
    )
  }

  const currentPage = page as unknown as PublicPage
  const [{ data: blocks }, { data: assets }] = await Promise.all([
    admin.from('project_public_blocks').select('*').eq('page_id', currentPage.id).order('sort_order'),
    admin.from('project_public_assets').select('*').eq('page_id', currentPage.id).order('created_at', { ascending: false }),
  ])

  const theme = currentPage.theme_color ?? '#2563eb'
  const accent = currentPage.accent_color ?? '#0ea5e9'
  const allAssets = (assets ?? []) as Asset[]
  const imageAssets = allAssets.filter(asset => asset.file_type === 'image')
  const audioAssets = allAssets.filter(asset => asset.file_type === 'audio')
  const videoAssets = allAssets.filter(asset => asset.file_type === 'video')
  const otherAssets = allAssets.filter(asset => !['image', 'audio', 'video'].includes(asset.file_type))

  return (
    <main className="min-h-screen" style={{ background: `linear-gradient(135deg, ${theme}15, ${accent}20 45%, #f8fafc 100%)` }}>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at top left, ${theme}, transparent 35%), radial-gradient(circle at bottom right, ${accent}, transparent 35%)` }} />
        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-24">
          <div className="inline-flex items-center gap-2 bg-white/80 border border-white rounded-full px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm mb-6">
            <span>🌐</span> Vitrina pública de proyecto
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-950 tracking-tight max-w-4xl">
            {currentPage.title}
          </h1>
          {currentPage.description && (
            <p className="text-lg md:text-xl text-slate-700 mt-5 max-w-3xl leading-relaxed">
              {currentPage.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-7">
            {currentPage.projects?.title && <span className="bg-white text-slate-700 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm">🗂️ {currentPage.projects.title}</span>}
            {currentPage.courses?.name && <span className="bg-white text-slate-700 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm">📚 {currentPage.courses.name}</span>}
            {currentPage.profiles?.full_name && <span className="bg-white text-slate-700 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm">👥 {currentPage.profiles.full_name}</span>}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 pb-16 space-y-6">
        {audioAssets.length > 0 && (
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">🎙️ Podcast y audios</h2>
            <div className="space-y-4">
              {audioAssets.map(asset => (
                <div key={asset.id} className="border border-slate-100 rounded-2xl p-4">
                  <p className="font-semibold text-slate-800 mb-2">{asset.title ?? asset.file_name}</p>
                  <audio controls className="w-full" src={`/api/vitrinas/assets/${asset.id}`} />
                </div>
              ))}
            </div>
          </section>
        )}

        {videoAssets.length > 0 && (
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">🎬 Videos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videoAssets.map(asset => (
                <div key={asset.id} className="border border-slate-100 rounded-2xl p-4">
                  <p className="font-semibold text-slate-800 mb-2">{asset.title ?? asset.file_name}</p>
                  <video controls className="w-full rounded-xl bg-black" src={`/api/vitrinas/assets/${asset.id}`} />
                </div>
              ))}
            </div>
          </section>
        )}

        {imageAssets.length > 0 && (
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">🖼️ Galería</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {imageAssets.map(asset => (
                <a key={asset.id} href={`/api/vitrinas/assets/${asset.id}`} target="_blank" rel="noreferrer" className="group rounded-2xl overflow-hidden bg-slate-100 aspect-video border border-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/vitrinas/assets/${asset.id}`} alt={asset.title ?? asset.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </a>
              ))}
            </div>
          </section>
        )}

        {((blocks ?? []) as Block[]).map(renderBlock)}

        {otherAssets.length > 0 && (
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">📎 Materiales descargables</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {otherAssets.map(asset => (
                <a key={asset.id} href={`/api/vitrinas/assets/${asset.id}`} target="_blank" rel="noreferrer" className="border border-slate-100 rounded-2xl p-4 hover:bg-slate-50 flex gap-3 items-center">
                  <span className="text-2xl">{assetIcon(asset.file_type)}</span>
                  <span className="font-semibold text-slate-700">{asset.title ?? asset.file_name}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="text-center text-sm text-slate-500 pt-8">
          <p>Publicado con Sello Tecnológico · Colegio Providencia</p>
          <Link href="/" className="text-blue-600 hover:underline">Volver al sitio</Link>
        </footer>
      </div>
    </main>
  )
}
