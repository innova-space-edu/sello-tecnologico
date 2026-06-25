'use client'

import { useEffect, useMemo, useState } from 'react'

type TargetType = 'page' | 'block' | 'asset'

type Comment = {
  id: string
  visitor_name?: string | null
  content: string
  created_at: string
  profiles?: { full_name?: string | null } | null
}

type SocialData = {
  stats: { likes: number; views: number; comments: number }
  comments: Comment[]
  liked?: boolean
}

const QUICK_EMOJIS = ['😍', '👏', '🔥', '❤️', '😂', '🙌', '⭐', '🌱', '🎧', '💡', '😮', '🥳', '👍', '💜', '✨']

function getVisitorKey() {
  const key = 'sello_vitrina_visitor_key'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  window.localStorage.setItem(key, created)
  return created
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function notifySocialUpdate() {
  window.dispatchEvent(new CustomEvent('vitrina-social-updated'))
}

export default function VitrinaInlineInteraction({
  slug,
  targetType,
  targetId,
  theme,
  accent,
  anchorId,
}: {
  slug: string
  targetType: TargetType
  targetId?: string | null
  theme: string
  accent: string
  anchorId?: string
}) {
  const [visitorKey, setVisitorKey] = useState('')
  const [visitorName, setVisitorName] = useState('')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const [showEmojis, setShowEmojis] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [data, setData] = useState<SocialData>({ stats: { likes: 0, views: 0, comments: 0 }, comments: [], liked: false })

  const params = useMemo(() => {
    const search = new URLSearchParams()
    search.set('targetType', targetType)
    if (targetId) search.set('targetId', targetId)
    if (visitorKey) search.set('visitorKey', visitorKey)
    return search.toString()
  }, [targetType, targetId, visitorKey])

  const apiUrl = useMemo(() => `/api/vitrinas/social/${slug}`, [slug])
  const encodedShareUrl = encodeURIComponent(shareUrl)
  const encodedShareText = encodeURIComponent(`Te comparto esta publicación de Sello Tecnológico:\n${shareUrl}`)

  const refresh = async () => {
    const response = await fetch(`${apiUrl}?${params}`, { cache: 'no-store' })
    if (!response.ok) return
    const nextData = await response.json()
    setData({
      stats: nextData.stats ?? { likes: 0, views: 0, comments: 0 },
      comments: nextData.comments ?? [],
      liked: Boolean(nextData.liked),
    })
  }

  useEffect(() => {
    const key = getVisitorKey()
    setVisitorKey(key)
    setVisitorName(window.localStorage.getItem('sello_vitrina_visitor_name') ?? '')
  }, [])

  useEffect(() => {
    const baseUrl = window.location.href.split('#')[0]
    setShareUrl(anchorId ? `${baseUrl}#${anchorId}` : baseUrl)
  }, [anchorId])

  useEffect(() => {
    if (!visitorKey) return

    const init = async () => {
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'view', visitorKey, targetType, targetId }),
      }).catch(() => null)
      await refresh()
      notifySocialUpdate()
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, visitorKey, targetType, targetId])

  const toggleLike = async () => {
    if (!visitorKey) return
    setSending(true)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'like', visitorKey, targetType, targetId }),
    })
    if (response.ok) {
      await refresh()
      notifySocialUpdate()
    }
    setSending(false)
  }

  const sendComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) return
    setSending(true)
    setNotice('')
    window.localStorage.setItem('sello_vitrina_visitor_name', visitorName.trim())

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'comment', visitorName, content: comment, targetType, targetId }),
    })

    if (response.ok) {
      setComment('')
      setNotice('Publicado')
      await refresh()
      notifySocialUpdate()
      window.setTimeout(() => setNotice(''), 1800)
    } else {
      const result = await response.json().catch(() => ({}))
      setNotice(result?.error ?? 'No se pudo publicar.')
    }

    setSending(false)
  }

  const addEmoji = (emoji: string) => {
    setComment(prev => `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}${emoji} `)
    setShowEmojis(false)
  }

  const copyShareUrl = async () => {
    await navigator.clipboard.writeText(shareUrl).catch(() => null)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Publicación Sello Tecnológico', url: shareUrl }).catch(() => null)
      return
    }
    await copyShareUrl()
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-4 font-bold text-slate-600">
          <span>❤️ {data.stats.likes}</span>
          <span>💬 {data.stats.comments}</span>
          <span>👁️ {data.stats.views}</span>
        </div>

        <div className="relative flex flex-wrap items-center gap-3 text-sm font-black">
          <button
            type="button"
            disabled={sending}
            onClick={toggleLike}
            className="transition hover:opacity-75 disabled:opacity-60"
            style={{ color: data.liked ? accent : theme }}
          >
            {data.liked ? '💜 Te gusta' : '🤍 Me gusta'}
          </button>

          <button
            type="button"
            onClick={() => setShowShare(prev => !prev)}
            className="text-slate-600 transition hover:text-slate-900"
          >
            🔗 Compartir
          </button>

          {showShare && (
            <div className="absolute right-0 top-8 z-20 w-64 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-900">Compartir</p>
                <button type="button" onClick={() => setShowShare(false)} className="text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <a href={`https://wa.me/?text=${encodedShareText}`} target="_blank" rel="noreferrer" className="rounded-xl bg-green-50 px-3 py-2 font-bold text-green-700 hover:bg-green-100">🟢 WhatsApp</a>
                <a href={`mailto:?subject=${encodeURIComponent('Publicación Sello Tecnológico')}&body=${encodedShareText}`} className="rounded-xl bg-sky-50 px-3 py-2 font-bold text-sky-700 hover:bg-sky-100">✉️ Correo</a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`} target="_blank" rel="noreferrer" className="rounded-xl bg-blue-50 px-3 py-2 font-bold text-blue-700 hover:bg-blue-100">🔵 Facebook</a>
                <button type="button" onClick={copyShareUrl} className="rounded-xl bg-slate-50 px-3 py-2 text-left font-bold text-slate-700 hover:bg-slate-100">{copied ? '✅ Copiado' : '📋 Copiar enlace'}</button>
                <button type="button" onClick={nativeShare} className="rounded-xl px-3 py-2 text-left font-bold text-white" style={{ background: `linear-gradient(135deg, ${theme}, ${accent})` }}>📲 Compartir del dispositivo</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={sendComment} className="mt-4 space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-start">
          <input
            value={visitorName}
            onChange={event => setVisitorName(event.target.value)}
            placeholder="Nombre"
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 md:w-44"
          />
          <div className="relative flex flex-1 items-start gap-2 rounded-[1.5rem] border border-slate-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300">
            <button
              type="button"
              onClick={() => setShowEmojis(prev => !prev)}
              className="mt-0.5 shrink-0 bg-transparent px-1 text-lg leading-none text-slate-500 transition hover:scale-110 hover:text-slate-800"
              aria-label="Abrir emojis"
            >
              😊
            </button>

            {showEmojis && (
              <div className="absolute bottom-12 left-2 z-20 w-64 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl">
                <div className="grid grid-cols-5 gap-1">
                  {QUICK_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => addEmoji(emoji)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-lg transition hover:bg-slate-100"
                      aria-label={`Agregar ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={comment}
              onChange={event => setComment(event.target.value)}
              placeholder="Agrega un comentario..."
              rows={1}
              className="min-h-7 flex-1 resize-none border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={sending || !comment.trim()}
              className="shrink-0 rounded-full px-4 py-1.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              style={comment.trim() ? { background: `linear-gradient(135deg, ${theme}, ${accent})` } : undefined}
            >
              {sending ? '...' : 'Publicar'}
            </button>
          </div>
        </div>
        {notice && <p className="text-xs font-semibold text-slate-500">{notice}</p>}
      </form>

      <div className="mt-4 space-y-3">
        {data.comments.length > 0 ? data.comments.map(item => {
          const name = item.profiles?.full_name ?? item.visitor_name ?? 'Visitante'
          return (
            <div key={item.id} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: theme }}>
                {name[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">
                  <span className="font-black">{name}</span>{' '}
                  <span className="whitespace-pre-wrap leading-relaxed">{item.content}</span>
                </p>
                <div className="mt-1 flex gap-4 text-xs font-bold text-slate-400">
                  <span>{formatDate(item.created_at)}</span>
                  <button type="button" className="hover:text-slate-600">Me gusta</button>
                  <button type="button" className="hover:text-slate-600">Responder</button>
                </div>
              </div>
            </div>
          )
        }) : (
          <p className="text-sm text-slate-400">Aún no hay comentarios. Sé el primero en comentar.</p>
        )}
      </div>
    </div>
  )
}
