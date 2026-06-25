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

const QUICK_EMOJIS = ['😍', '👏', '🔥', '❤️', '😂', '🙌', '⭐', '🌱', '🎧', '💡']

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
  const [data, setData] = useState<SocialData>({ stats: { likes: 0, views: 0, comments: 0 }, comments: [], liked: false })

  const params = useMemo(() => {
    const search = new URLSearchParams()
    search.set('targetType', targetType)
    if (targetId) search.set('targetId', targetId)
    if (visitorKey) search.set('visitorKey', visitorKey)
    return search.toString()
  }, [targetType, targetId, visitorKey])

  const apiUrl = useMemo(() => `/api/vitrinas/social/${slug}`, [slug])

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
  }

  const sharePublication = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''
    const shareUrl = anchorId ? `${baseUrl}#${anchorId}` : baseUrl

    if (navigator.share) {
      await navigator.share({ title: 'Publicación Sello Tecnológico', url: shareUrl }).catch(() => null)
      return
    }

    await navigator.clipboard.writeText(shareUrl).catch(() => null)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-4 font-bold text-slate-600">
          <span>❤️ {data.stats.likes}</span>
          <span>💬 {data.stats.comments}</span>
          <span>👁️ {data.stats.views}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm font-black">
          <button
            type="button"
            disabled={sending}
            onClick={toggleLike}
            className="transition hover:opacity-75 disabled:opacity-60"
            style={{ color: data.liked ? accent : theme }}
          >
            {data.liked ? '💜 Te gusta' : '🤍 Me gusta'}
          </button>
          <button type="button" onClick={sharePublication} className="text-slate-600 transition hover:text-slate-900">
            {copied ? '✅ Copiado' : '🔗 Compartir'}
          </button>
        </div>
      </div>

      <form onSubmit={sendComment} className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-base transition hover:bg-slate-100"
              aria-label={`Agregar ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-start">
          <input
            value={visitorName}
            onChange={event => setVisitorName(event.target.value)}
            placeholder="Nombre"
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 md:w-44"
          />
          <div className="flex flex-1 items-start gap-2 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-300">
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
