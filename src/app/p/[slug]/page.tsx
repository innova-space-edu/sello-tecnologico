import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import VitrinaSocialPanel from '@/components/vitrinas/VitrinaSocialPanel'
import VitrinaInlineInteraction from '@/components/vitrinas/VitrinaInlineInteraction'
import PublicShareButtons from '@/components/vitrinas/PublicShareButtons'
import Link from 'next/link'

type PublicPage = {
  id: string
  title: string
  slug: string
  description?: string | null
  theme_color?: string | null
  accent_color?: string | null
  background_color?: string | null
  text_color?: string | null
  card_color?: string | null
  layout_style?: string | null
  background_style?: string | null
  font_style?: string | null
  surface_style?: string | null
  button_style?: string | null
  header_style?: string | null
  hero_badge?: string | null
  call_to_action_label?: string | null
  call_to_action_url?: string | null
  show_author?: boolean | null
  show_trending?: boolean | null
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

function cleanTitle(title: string) {
  return title.replace(/^Vitrina:\s*/i, '').trim()
}

function blockLabel(type: string) {
  const label: Record<string, string> = {
    text: 'Texto',
    post: 'Publicación',
    podcast_episode: 'Podcast',
    audio: 'Audio',
    video: 'Video',
    gallery: 'Galería',
    credits: 'Créditos',
    call_to_action: 'Acción',
  }
  return label[type] ?? type
}

function buildBackground(page: PublicPage, theme: string, accent: string) {
  const base = page.background_color ?? '#f8fafc'
  if (page.background_style === 'solid') return `linear-gradient(180deg, ${base}, #ffffff 100%)`
  if (page.background_style === 'paper') return `linear-gradient(180deg, ${base}, #ffffff 60%, ${accent}10 100%)`
  if (page.background_style === 'dark') return `radial-gradient(circle at top left, ${theme}55, transparent 32%), radial-gradient(circle at top right, ${accent}45, transparent 35%), linear-gradient(135deg, #020617, #111827 65%, #020617)`
  if (page.background_style === 'aurora') return `radial-gradient(circle at 10% 10%, ${theme}44, transparent 32%), radial-gradient(circle at 90% 0%, ${accent}55, transparent 34%), linear-gradient(135deg, ${base}, #ffffff 85%)`
  if (page.background_style === 'diagonal') return `linear-gradient(135deg, ${theme}18 0%, ${base} 40%, #ffffff 60%, ${accent}20 100%)`
  return `radial-gradient(circle at top left, ${theme}35, transparent 34%), radial-gradient(circle at top right, ${accent}45, transparent 35%), linear-gradient(135deg, ${theme}12, ${accent}18 45%, ${base} 100%)`
}

function cardClass(surfaceStyle?: string | null) {
  if (surfaceStyle === 'flat') return 'rounded-[1.5rem] border border-slate-100 shadow-none'
  if (surfaceStyle === 'bordered') return 'rounded-[2rem] border-2 shadow-sm'
  if (surfaceStyle === 'floating') return 'rounded-[2rem] border border-white/70 shadow-xl shadow-slate-200/70'
  return 'rounded-[2rem] shadow-sm border border-white/80 backdrop-blur'
}

function buttonBackground(theme: string, accent: string, buttonStyle?: string | null) {
  if (buttonStyle === 'solid') return theme
  if (buttonStyle === 'soft') return `linear-gradient(135deg, ${theme}dd, ${accent}99)`
  return `linear-gradient(135deg, ${theme}, ${accent})`
}

function renderBlock(block: Block, page: PublicPage, theme: string, accent: string, textColor: string, cardColor: string) {
  const isPodcast = block.type === 'podcast_episode'
  const sectionId = `publicacion-${block.id}`

  return (
    <section key={block.id} id={sectionId} className={`${cardClass(page.surface_style)} p-6 md:p-8 scroll-mt-8`} style={{ background: `${cardColor}f2`, borderColor: `${accent}22` }}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs px-2.5 py-1 rounded-full font-black" style={{ background: `${accent}18`, color: accent }}>
          {isPodcast ? '🎙️ ' : ''}{blockLabel(block.type)}
        </span>
      </div>
      {block.title && <h2 className="text-2xl md:text-3xl font-black mb-3" style={{ color: textColor }}>{block.title}</h2>}
      {block.content && <p className="whitespace-pre-wrap leading-relaxed text-base md:text-lg" style={{ color: `${textColor}cc` }}>{block.content}</p>}
      {block.type === 'call_to_action' && block.content && (
        <a href={block.content} target="_blank" rel="noreferrer" className="inline-flex mt-5 rounded-2xl px-5 py-3 text-white font-bold" style={{ background: buttonBackground(theme, accent, page.button_style) }}>
          Abrir enlace
        </a>
      )}
      <VitrinaInlineInteraction slug={page.slug} targetType="block" targetId={block.id} theme={theme} accent={accent} anchorId={sectionId} />
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
          <p className="text-slate-300 mt-2">La página no existe, está oculta o todavía no fue publicada.</p>
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
  const textColor = currentPage.background_style === 'dark' ? '#f8fafc' : (currentPage.text_color ?? '#0f172a')
  const cardColor = currentPage.background_style === 'dark' ? '#111827' : (currentPage.card_color ?? '#ffffff')
  const title = cleanTitle(currentPage.title)
  const publicUrl = `/p/${currentPage.slug}`
  const allAssets = (assets ?? []) as Asset[]
  const imageAssets = allAssets.filter(asset => asset.file_type === 'image')
  const audioAssets = allAssets.filter(asset => asset.file_type === 'audio')
  const videoAssets = allAssets.filter(asset => asset.file_type === 'video')
  const otherAssets = allAssets.filter(asset => !['image', 'audio', 'video'].includes(asset.file_type))
  const background = buildBackground(currentPage, theme, accent)
  const fontClass = currentPage.font_style === 'classic' ? 'font-serif' : 'font-sans'
  const heroSize = currentPage.header_style === 'compact' ? 'py-10 md:py-14' : currentPage.header_style === 'cover' ? 'py-20 md:py-32' : 'py-16 md:py-24'
  const contentLayout = currentPage.layout_style === 'gallery' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6 min-w-0'

  return (
    <main className={`min-h-screen ${fontClass}`} style={{ background, color: textColor }}>
      <section className="relative overflow-hidden border-b border-white/60">
        <div className="absolute inset-0 opacity-25" style={{ background: `linear-gradient(120deg, ${theme}, ${accent})` }} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/40 to-transparent" />
        <div className={`relative max-w-7xl mx-auto px-5 ${heroSize}`}>
          {currentPage.hero_badge && (
            <div className="inline-flex items-center gap-2 bg-white/85 border border-white rounded-full px-4 py-2 text-sm font-black text-slate-800 shadow-sm mb-6">
              <span>✨</span> {currentPage.hero_badge}
            </div>
          )}
          <h1 className="text-5xl md:text-7xl font-black tracking-tight max-w-5xl" style={{ color: currentPage.background_style === 'dark' ? '#ffffff' : theme }}>
            {title}
          </h1>
          {currentPage.description && (
            <p className="text-lg md:text-2xl mt-5 max-w-3xl leading-relaxed" style={{ color: `${textColor}cc` }}>
              {currentPage.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-7">
            {currentPage.projects?.title && <span className="bg-white text-slate-700 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm">🗂️ {currentPage.projects.title}</span>}
            {currentPage.courses?.name && <span className="bg-white text-slate-700 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm">📚 {currentPage.courses.name}</span>}
            {currentPage.show_author !== false && currentPage.profiles?.full_name && <span className="bg-white text-slate-700 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm">👥 {currentPage.profiles.full_name}</span>}
          </div>
          <div className="mt-7 max-w-3xl">
            <PublicShareButtons url={publicUrl} title={title} description={currentPage.description} theme={theme} accent={accent} compact />
          </div>
          {currentPage.call_to_action_label && currentPage.call_to_action_url && (
            <a href={currentPage.call_to_action_url} target="_blank" rel="noreferrer" className="inline-flex mt-6 rounded-2xl px-6 py-3 text-white font-black shadow-lg" style={{ background: buttonBackground(theme, accent, currentPage.button_style) }}>
              {currentPage.call_to_action_label}
            </a>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-5 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div className={contentLayout}>
            {audioAssets.length > 0 && (
              <section className={`${cardClass(currentPage.surface_style)} p-6 md:p-8`} style={{ background: `${cardColor}f2`, borderColor: `${accent}22` }}>
                <h2 className="text-2xl md:text-3xl font-black mb-4" style={{ color: textColor }}>🎙️ Podcast y audios</h2>
                <div className="space-y-4">
                  {audioAssets.map(asset => {
                    const sectionId = `archivo-${asset.id}`
                    return (
                      <div key={asset.id} id={sectionId} className="border border-slate-100 rounded-2xl p-4 scroll-mt-8" style={{ boxShadow: `inset 4px 0 0 ${accent}` }}>
                        <p className="font-black mb-2" style={{ color: textColor }}>{asset.title ?? asset.file_name}</p>
                        <audio controls className="w-full" src={`/api/vitrinas/assets/${asset.id}`} />
                        <VitrinaInlineInteraction slug={currentPage.slug} targetType="asset" targetId={asset.id} theme={theme} accent={accent} anchorId={sectionId} />
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {videoAssets.length > 0 && (
              <section className={`${cardClass(currentPage.surface_style)} p-6 md:p-8`} style={{ background: `${cardColor}f2`, borderColor: `${accent}22` }}>
                <h2 className="text-2xl md:text-3xl font-black mb-4" style={{ color: textColor }}>🎬 Videos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {videoAssets.map(asset => {
                    const sectionId = `archivo-${asset.id}`
                    return (
                      <div key={asset.id} id={sectionId} className="border border-slate-100 rounded-2xl p-4 scroll-mt-8">
                        <p className="font-black mb-2" style={{ color: textColor }}>{asset.title ?? asset.file_name}</p>
                        <video controls className="w-full rounded-xl bg-black" src={`/api/vitrinas/assets/${asset.id}`} />
                        <VitrinaInlineInteraction slug={currentPage.slug} targetType="asset" targetId={asset.id} theme={theme} accent={accent} anchorId={sectionId} />
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {imageAssets.length > 0 && (
              <section className={`${cardClass(currentPage.surface_style)} p-6 md:p-8`} style={{ background: `${cardColor}f2`, borderColor: `${accent}22` }}>
                <h2 className="text-2xl md:text-3xl font-black mb-4" style={{ color: textColor }}>🖼️ Galería</h2>
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

            {((blocks ?? []) as Block[]).map(block => renderBlock(block, currentPage, theme, accent, textColor, cardColor))}

            {otherAssets.length > 0 && (
              <section className={`${cardClass(currentPage.surface_style)} p-6 md:p-8`} style={{ background: `${cardColor}f2`, borderColor: `${accent}22` }}>
                <h2 className="text-2xl md:text-3xl font-black mb-4" style={{ color: textColor }}>📎 Materiales descargables</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {otherAssets.map(asset => (
                    <a key={asset.id} href={`/api/vitrinas/assets/${asset.id}`} target="_blank" rel="noreferrer" className="border border-slate-100 rounded-2xl p-4 hover:bg-slate-50 flex gap-3 items-center">
                      <span className="text-2xl">{assetIcon(asset.file_type)}</span>
                      <span className="font-black text-slate-700">{asset.title ?? asset.file_name}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {currentPage.show_trending !== false && <VitrinaSocialPanel slug={currentPage.slug} theme={theme} accent={accent} />}
        </div>

        <footer className="text-center text-sm pt-12" style={{ color: `${textColor}aa` }}>
          <p>Publicado con Sello Tecnológico · Colegio Providencia</p>
          <Link href="/" className="font-semibold hover:underline" style={{ color: theme }}>Volver al sitio</Link>
        </footer>
      </div>
    </main>
  )
}
