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
  const [showComments, setShowComments] = useState(false)
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
      setShowComments(true)
      setNotice('Comentario publicado correctamente.')
      await refresh()
      notifySocialUpdate()
      window.setTimeout(() => setNotice(''), 2400)
    } else {
      const result = await response.json().catch(() => ({}))
      setNotice(result?.error ?? 'No se pudo publicar el comentario.')
    }

    setSending(false)
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
    <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-white px-3 py-1 font-bold">❤️ {data.stats.likes} me gusta</span>
          <span className="rounded-full bg-white px-3 py-1 font-bold">💬 {data.stats.comments} comentarios</span>
          <span className="rounded-full bg-white px-3 py-1 font-bold">👁️ {data.stats.views} vistas</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={sending}
            onClick={toggleLike}
            className="rounded-full px-4 py-2 text-xs font-black text-white shadow-sm disabled:opacity-60"
            style={{ background: data.liked ? `linear-gradient(135deg, ${theme}, ${accent})` : theme }}
          >
            {data.liked ? '💜 Te gusta' : '🤍 Me gusta'}
          </button>
          <button
            type="button"
            onClick={() => setShowComments(prev => !prev)}
            className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 border border-slate-200"
          >
            💬 {showComments ? 'Ocultar' : 'Comentar'}
          </button>
          <button
            type="button"
            onClick={sharePublication}
            className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 border border-slate-200"
          >
            {copied ? '✅ Copiado' : '🔗 Compartir'}
          </button>
        </div>
      </div>

      {showComments && (
        <div className="mt-4 rounded-3xl border border-slate-100 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900">Comentarios de esta publicación</h3>
              <p className="text-xs text-slate-400">Los comentarios quedan guardados solo en este bloque.</p>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{data.stats.comments} total</span>
          </div>

          <form onSubmit={sendComment} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
              <input
                value={visitorName}
                onChange={event => setVisitorName(event.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <textarea
                value={comment}
                onChange={event => setComment(event.target.value)}
                placeholder="Escribe un comentario claro sobre esta publicación..."
                rows={2}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">Mínimo 2 caracteres. Evita escribir solo “like” como comentario.</p>
              <button
                type="submit"
                disabled={sending || !comment.trim()}
                className="rounded-full px-5 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                style={comment.trim() ? { background: `linear-gradient(135deg, ${theme}, ${accent})` } : undefined}
              >
                {sending ? 'Publicando…' : 'Publicar comentario'}
              </button>
            </div>
            {notice && <p className="mt-2 text-xs font-semibold text-slate-500">{notice}</p>}
          </form>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.comments.length > 0 ? data.comments.map(item => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: theme }}>
                      {(item.profiles?.full_name ?? item.visitor_name ?? 'V')[0].toUpperCase()}
                    </div>
                    <p className="truncate text-sm font-black text-slate-800">{item.profiles?.full_name ?? item.visitor_name ?? 'Visitante'}</p>
                  </div>
                  <p className="shrink-0 text-[11px] text-slate-400">{formatDate(item.created_at)}</p>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
              </div>
            )) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400 md:col-span-2">Aún no hay comentarios en esta publicación.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
