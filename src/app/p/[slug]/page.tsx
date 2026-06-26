import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import VitrinaSocialPanel from '@/components/vitrinas/VitrinaSocialPanel'
import VitrinaInlineInteraction from '@/components/vitrinas/VitrinaInlineInteraction'
import Link from 'next/link'
import type { ReactNode } from 'react'

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
  created_at?: string | null
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

function assetLabel(type: string) {
  if (type === 'audio') return 'Audio'
  if (type === 'video') return 'Video'
  if (type === 'image') return 'Imagen'
  if (type === 'pdf') return 'PDF'
  return 'Archivo'
}

function postIcon(type: string) {
  if (type === 'audio' || type === 'podcast_episode') return '🎙️'
  if (type === 'video') return '🎬'
  if (type === 'image' || type === 'gallery') return '🖼️'
  if (type === 'pdf') return '📄'
  if (type === 'call_to_action') return '🔗'
  if (type === 'credits') return '👥'
  return '📝'
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

function buttonBackground(theme: string, accent: string, buttonStyle?: string | null) {
  if (buttonStyle === 'solid') return theme
  if (buttonStyle === 'soft') return `linear-gradient(135deg, ${theme}dd, ${accent}99)`
  return `linear-gradient(135deg, ${theme}, ${accent})`
}

function authorName(page: PublicPage) {
  return page.profiles?.full_name ?? 'Sello Tecnológico'
}

function FeedPost({
  id,
  title,
  label,
  icon,
  page,
  theme,
  accent,
  textColor,
  cardColor,
  targetType,
  targetId,
  children,
  caption,
}: {
  id: string
  title: string
  label: string
  icon: string
  page: PublicPage
  theme: string
  accent: string
  textColor: string
  cardColor: string
  targetType: 'block' | 'asset'
  targetId: string
  children?: ReactNode
  caption?: ReactNode
}) {
  return (
    <article id={id} className="scroll-mt-8 overflow-visible rounded-[1.8rem] border shadow-sm" style={{ background: `${cardColor}f7`, borderColor: `${accent}20` }}>
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${theme}, ${accent})` }}>
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black" style={{ color: textColor }}>{title}</h2>
            <p className="truncate text-xs font-semibold text-slate-400">{authorName(page)} · {label}</p>
          </div>
        </div>
        <span className="text-xl font-black text-slate-400">•••</span>
      </header>

      {children && <div>{children}</div>}

      {caption && (
        <div className="px-5 pt-3">
          <div className="text-sm leading-relaxed" style={{ color: `${textColor}dd` }}>{caption}</div>
        </div>
      )}

      <div className="px-5 pb-5">
        <VitrinaInlineInteraction slug={page.slug} targetType={targetType} targetId={targetId} theme={theme} accent={accent} anchorId={id} />
      </div>
    </article>
  )
}

function renderAssetPost(asset: Asset, page: PublicPage, theme: string, accent: string, textColor: string, cardColor: string) {
  const sectionId = `archivo-${asset.id}`
  const title = asset.title ?? asset.file_name
  const label = assetLabel(asset.file_type)
  const caption = asset.description || title !== asset.file_name ? (
    <p><span className="font-black">{authorName(page)}</span> {asset.description ?? asset.file_name}</p>
  ) : null

  if (asset.file_type === 'image') {
    return (
      <FeedPost key={asset.id} id={sectionId} title={title} label={label} icon="🖼️" page={page} theme={theme} accent={accent} textColor={textColor} cardColor={cardColor} targetType="asset" targetId={asset.id} caption={caption}>
        <a href={`/api/vitrinas/assets/${asset.id}`} target="_blank" rel="noreferrer" className="block bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/vitrinas/assets/${asset.id}`} alt={title} className="max-h-[720px] w-full object-contain" />
        </a>
      </FeedPost>
    )
  }

  if (asset.file_type === 'video') {
    return (
      <FeedPost key={asset.id} id={sectionId} title={title} label={label} icon="🎬" page={page} theme={theme} accent={accent} textColor={textColor} cardColor={cardColor} targetType="asset" targetId={asset.id} caption={caption}>
        <div className="bg-black">
          <video controls playsInline preload="metadata" className="max-h-[720px] w-full bg-black object-contain" src={`/api/vitrinas/assets/${asset.id}`} />
        </div>
      </FeedPost>
    )
  }

  if (asset.file_type === 'audio') {
    return (
      <FeedPost key={asset.id} id={sectionId} title={title} label={label} icon="🎙️" page={page} theme={theme} accent={accent} textColor={textColor} cardColor={cardColor} targetType="asset" targetId={asset.id} caption={caption}>
        <div className="px-5 pb-2">
          <audio controls preload="metadata" className="w-full" src={`/api/vitrinas/assets/${asset.id}`} />
        </div>
      </FeedPost>
    )
  }

  return (
    <FeedPost key={asset.id} id={sectionId} title={title} label={label} icon={postIcon(asset.file_type)} page={page} theme={theme} accent={accent} textColor={textColor} cardColor={cardColor} targetType="asset" targetId={asset.id} caption={caption}>
      <div className="px-5 pb-2">
        <a href={`/api/vitrinas/assets/${asset.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 font-black text-slate-700 transition hover:bg-slate-100">
          <span>{postIcon(asset.file_type)} {asset.file_name}</span>
          <span className="text-xs text-slate-400">Abrir</span>
        </a>
      </div>
    </FeedPost>
  )
}

function renderBlockPost(block: Block, page: PublicPage, theme: string, accent: string, textColor: string, cardColor: string) {
  const sectionId = `publicacion-${block.id}`
  const label = blockLabel(block.type)
  const icon = postIcon(block.type)
  const title = block.title || label

  const caption = block.content ? (
    <p className="whitespace-pre-wrap"><span className="font-black">{authorName(page)}</span> {block.content}</p>
  ) : null

  return (
    <FeedPost key={block.id} id={sectionId} title={title} label={label} icon={icon} page={page} theme={theme} accent={accent} textColor={textColor} cardColor={cardColor} targetType="block" targetId={block.id} caption={caption}>
      {block.type === 'call_to_action' && block.content && (
        <div className="px-5 pb-2">
          <a href={block.content} target="_blank" rel="noreferrer" className="inline-flex rounded-full px-5 py-2.5 text-sm font-black text-white" style={{ background: buttonBackground(theme, accent, page.button_style) }}>
            Abrir enlace
          </a>
        </div>
      )}
    </FeedPost>
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
  const allAssets = (assets ?? []) as Asset[]
  const allBlocks = (blocks ?? []) as Block[]
  const background = buildBackground(currentPage, theme, accent)
  const fontClass = currentPage.font_style === 'classic' ? 'font-serif' : 'font-sans'
  const heroSize = currentPage.header_style === 'compact' ? 'py-10 md:py-14' : currentPage.header_style === 'cover' ? 'py-20 md:py-28' : 'py-14 md:py-20'

  return (
    <main className={`min-h-screen ${fontClass}`} style={{ background, color: textColor }}>
      <section className="relative overflow-hidden border-b border-white/60">
        <div className="absolute inset-0 opacity-25" style={{ background: `linear-gradient(120deg, ${theme}, ${accent})` }} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/40 to-transparent" />
        <div className={`relative max-w-6xl mx-auto px-5 ${heroSize}`}>
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
          {currentPage.call_to_action_label && currentPage.call_to_action_url && (
            <a href={currentPage.call_to_action_url} target="_blank" rel="noreferrer" className="inline-flex mt-8 rounded-2xl px-6 py-3 text-white font-black shadow-lg" style={{ background: buttonBackground(theme, accent, currentPage.button_style) }}>
              {currentPage.call_to_action_label}
            </a>
          )}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 py-8 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,680px)_320px] gap-6 items-start justify-center">
          <div className="space-y-6 min-w-0">
            {allAssets.map(asset => renderAssetPost(asset, currentPage, theme, accent, textColor, cardColor))}
            {allBlocks.map(block => renderBlockPost(block, currentPage, theme, accent, textColor, cardColor))}
            {allAssets.length === 0 && allBlocks.length === 0 && (
              <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-white/80 p-8 text-center text-slate-400">
                Todavía no hay publicaciones en esta página.
              </div>
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
