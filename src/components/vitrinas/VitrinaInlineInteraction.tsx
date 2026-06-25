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
    if (response.ok) await refresh()
    setSending(false)
  }

  const sendComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) return
    setSending(true)
    window.localStorage.setItem('sello_vitrina_visitor_name', visitorName.trim())
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'comment', visitorName, content: comment, targetType, targetId }),
    })
    if (response.ok) {
      setComment('')
      setShowComments(true)
      await refresh()
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
    <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-white px-3 py-1 font-semibold">❤️ {data.stats.likes} me gusta</span>
          <span className="rounded-full bg-white px-3 py-1 font-semibold">💬 {data.stats.comments} comentarios</span>
          <span className="rounded-full bg-white px-3 py-1 font-semibold">👁️ {data.stats.views} vistas</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={sending}
            onClick={toggleLike}
            className="rounded-full px-3 py-2 text-xs font-black text-white shadow-sm disabled:opacity-60"
            style={{ background: data.liked ? `linear-gradient(135deg, ${theme}, ${accent})` : theme }}
          >
            {data.liked ? '💜 Te gusta' : '🤍 Me gusta'}
          </button>
          <button
            type="button"
            onClick={() => setShowComments(prev => !prev)}
            className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 border border-slate-200"
          >
            💬 Comentar
          </button>
          <button
            type="button"
            onClick={sharePublication}
            className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 border border-slate-200"
          >
            {copied ? '✅ Copiado' : '🔗 Compartir'}
          </button>
        </div>
      </div>

      {showComments && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-4">
          <form onSubmit={sendComment} className="space-y-2">
            <input
              value={visitorName}
              onChange={event => setVisitorName(event.target.value)}
              placeholder="Tu nombre"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <textarea
              value={comment}
              onChange={event => setComment(event.target.value)}
              placeholder="Escribe un comentario sobre esta publicación..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              type="submit"
              disabled={sending || !comment.trim()}
              className="w-full rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${theme}, ${accent})` }}
            >
              Publicar comentario
            </button>
          </form>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {data.comments.length > 0 ? data.comments.map(item => (
              <div key={item.id} className="rounded-xl bg-white p-3 border border-slate-100">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-sm font-black text-slate-800">{item.profiles?.full_name ?? item.visitor_name ?? 'Visitante'}</p>
                  <p className="text-[11px] text-slate-400">{formatDate(item.created_at)}</p>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-400 bg-white rounded-xl border border-slate-100 p-3">Aún no hay comentarios en esta publicación.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
