'use client'

import Link from 'next/link'
import FeedInteractionBar from './FeedInteractionBar'
import type { FeedPost } from './types'

type EmbedInfo = { url: string; embedUrl?: string; provider: string }

function extractUrl(value?: string | null) {
  return String(value ?? '').match(/https?:\/\/[^\s)]+/i)?.[0]?.replace(/[.,;!?]+$/, '') ?? ''
}

function embedInfo(value?: string | null): EmbedInfo | null {
  const raw = extractUrl(value)
  if (!raw) return null
  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      if (id) return { url: raw, embedUrl: `https://www.youtube.com/embed/${id}`, provider: 'YouTube' }
    }
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      const parts = url.pathname.split('/').filter(Boolean)
      const id = url.searchParams.get('v') || (parts[0] === 'shorts' ? parts[1] : '') || (parts[0] === 'embed' ? parts[1] : '')
      if (id) return { url: raw, embedUrl: `https://www.youtube.com/embed/${id}`, provider: 'YouTube' }
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.split('/').find(part => /^\d+$/.test(part))
      if (id) return { url: raw, embedUrl: `https://player.vimeo.com/video/${id}`, provider: 'Vimeo' }
    }
    return { url: raw, provider: 'Enlace' }
  } catch {
    return { url: raw, provider: 'Enlace' }
  }
}

function label(post: FeedPost) {
  if (post.media_type === 'image') return 'Imagen'
  if (post.media_type === 'video') return 'Video'
  if (post.media_type === 'audio') return 'Audio'
  if (post.media_type === 'pdf') return 'PDF'
  if (post.media_type === 'file') return 'Archivo'
  return post.block_type === 'podcast_episode' ? 'Podcast' : 'Publicación'
}

function icon(post: FeedPost) {
  if (post.media_type === 'image') return '🖼️'
  if (post.media_type === 'video') return '🎬'
  if (post.media_type === 'audio') return '🎙️'
  if (post.media_type === 'pdf') return '📄'
  if (post.media_type === 'file') return '📎'
  return '📝'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Media({ post }: { post: FeedPost }) {
  const assetUrl = post.asset_id ? `/api/vitrinas/assets/${post.asset_id}` : ''
  const embed = embedInfo(post.content)

  if (post.item_type === 'asset' && post.media_type === 'image') {
    return <img src={assetUrl} alt={post.title ?? post.page_title} loading="lazy" className="max-h-[760px] w-full bg-slate-100 object-contain" />
  }
  if (post.item_type === 'asset' && post.media_type === 'video') {
    return <video src={assetUrl} controls playsInline preload="metadata" className="max-h-[760px] w-full bg-black object-contain" />
  }
  if (post.item_type === 'asset' && post.media_type === 'audio') {
    return <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-5 py-7"><audio src={assetUrl} controls preload="metadata" className="w-full" /></div>
  }
  if (post.item_type === 'asset' && ['pdf', 'file'].includes(post.media_type)) {
    return (
      <div className="px-5 pb-2">
        <a href={assetUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 font-bold text-blue-800">
          <span>{icon(post)} {post.title ?? 'Abrir archivo'}</span><span>Ver →</span>
        </a>
      </div>
    )
  }
  if (embed?.embedUrl) {
    return <iframe src={embed.embedUrl} title={`${embed.provider}: ${post.title ?? post.page_title}`} className="aspect-video w-full border-0 bg-black" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
  }
  if (embed) {
    return (
      <div className="px-5 pb-2">
        <a href={embed.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800">
          <span className="truncate">🔗 {embed.url}</span><span className="ml-3 shrink-0">Abrir →</span>
        </a>
      </div>
    )
  }
  return null
}

export default function SocialPostCard({ post }: { post: FeedPost }) {
  const theme = post.theme_color ?? '#2563eb'
  const accent = post.accent_color ?? '#0ea5e9'
  const textWithoutUrl = post.content?.replace(extractUrl(post.content), '').trim()

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <header className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 gap-3">
          <Link href={`/p/${post.page_slug}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${theme}, ${accent})` }}>
            {icon(post)}
          </Link>
          <div className="min-w-0">
            <Link href={`/p/${post.page_slug}`} className="block truncate font-black text-slate-900 hover:underline">{post.page_title}</Link>
            <p className="truncate text-xs font-semibold text-slate-500">
              {post.author_name ?? 'Sello Tecnológico'} · {label(post)} · {formatDate(post.published_at)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {post.course_name && <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">📚 {post.course_name}</span>}
              {post.project_title && <span className="max-w-full truncate rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">🗂️ {post.project_title}</span>}
            </div>
          </div>
        </div>
        <span className="text-xl font-black text-slate-300">•••</span>
      </header>

      {(post.title || textWithoutUrl) && (
        <div className="px-4 pb-4 sm:px-5">
          {post.title && <h2 className="text-lg font-black text-slate-900">{post.title}</h2>}
          {textWithoutUrl && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700"><span className="font-black">{post.author_name ?? 'Sello Tecnológico'}</span> {textWithoutUrl}</p>}
        </div>
      )}

      <Media post={post} />
      <FeedInteractionBar post={post} />
    </article>
  )
}
