'use client'

import { useMemo, useState } from 'react'

type Props = {
  url?: string
  title?: string
  description?: string | null
  theme?: string
  accent?: string
  compact?: boolean
  className?: string
}

function getAbsoluteUrl(url?: string) {
  if (typeof window === 'undefined') return url ?? ''
  if (!url) return window.location.href
  if (url.startsWith('http')) return url
  return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`
}

export default function PublicShareButtons({
  url,
  title = 'Página pública Sello Tecnológico',
  description,
  theme = '#111827',
  accent = '#d946ef',
  compact = false,
  className = '',
}: Props) {
  const [copied, setCopied] = useState(false)
  const shareUrl = getAbsoluteUrl(url)
  const message = useMemo(() => {
    const text = description?.trim()
      ? `${title}\n${description.trim()}\n${shareUrl}`
      : `${title}\n${shareUrl}`
    return text
  }, [title, description, shareUrl])

  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(message)
  const encodedSubject = encodeURIComponent(title)
  const encodedBody = encodeURIComponent(`${description?.trim() ? `${description.trim()}\n\n` : ''}Te comparto esta página pública de Sello Tecnológico:\n${shareUrl}`)

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl).catch(() => null)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title, text: description ?? title, url: shareUrl }).catch(() => null)
      return
    }
    await copy()
  }

  const buttonBase = compact
    ? 'inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-black transition hover:-translate-y-0.5'
    : 'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5'

  return (
    <div className={`rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900">Compartir página</p>
          {!compact && <p className="text-xs text-slate-500">Envía el enlace directamente por WhatsApp, correo o cópialo.</p>}
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${accent}18`, color: accent }}>
          🔗 link público
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <a
          href={`https://wa.me/?text=${encodedText}`}
          target="_blank"
          rel="noreferrer"
          className={`${buttonBase} bg-green-500 text-white shadow-sm hover:bg-green-600`}
        >
          🟢 WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodedSubject}&body=${encodedBody}`}
          className={`${buttonBase} bg-sky-50 text-sky-700 ring-1 ring-sky-100 hover:bg-sky-100`}
        >
          ✉️ Correo
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          className={`${buttonBase} bg-blue-50 text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100`}
        >
          🔵 Facebook
        </a>
        <button
          type="button"
          onClick={copy}
          className={`${buttonBase} bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100`}
        >
          {copied ? '✅ Copiado' : '📋 Copiar'}
        </button>
        <button
          type="button"
          onClick={nativeShare}
          className={`${buttonBase} text-white shadow-sm`}
          style={{ background: `linear-gradient(135deg, ${theme}, ${accent})` }}
        >
          📲 Compartir
        </button>
      </div>
    </div>
  )
}
