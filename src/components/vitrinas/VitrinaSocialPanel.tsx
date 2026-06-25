'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Comment = {
  id: string
  visitor_name?: string | null
  content: string
  created_at: string
  profiles?: { full_name?: string | null } | null
}

type TrendingPage = {
  id: string
  title: string
  slug: string
  description?: string | null
  theme_color?: string | null
  accent_color?: string | null
  likes_count?: number
  views_count?: number
  comments_count?: number
  trend_score?: number
}

type SocialData = {
  stats: { likes: number; views: number; comments: number }
  comments: Comment[]
  trending: TrendingPage[]
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
  return new Date(date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function VitrinaSocialPanel({ slug, theme, accent }: { slug: string; theme: string; accent: string }) {
  const [visitorKey, setVisitorKey] = useState('')
  const [visitorName, setVisitorName] = useState('')
  const [comment, setComment] = useState('')
  const [liked, setLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [data, setData] = useState<SocialData>({ stats: { likes: 0, views: 0, comments: 0 }, comments: [], trending: [] })

  const apiUrl = useMemo(() => `/api/vitrinas/social/${slug}`, [slug])

  const refresh = async () => {
    const response = await fetch(apiUrl, { cache: 'no-store' })
    if (!response.ok) return
    const nextData = await response.json()
    setData({
      stats: nextData.stats ?? { likes: 0, views: 0, comments: 0 },
      comments: nextData.comments ?? [],
      trending: nextData.trending ?? [],
    })
  }

  useEffect(() => {
    const key = getVisitorKey()
    setVisitorKey(key)
    const storedName = window.localStorage.getItem('sello_vitrina_visitor_name') ?? ''
    setVisitorName(storedName)

    const init = async () => {
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'view', visitorKey: key }),
      }).catch(() => null)
      await refresh()
      setLoading(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl])

  const toggleLike = async () => {
    if (!visitorKey) return
    setSending(true)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'like', visitorKey }),
    })
    if (response.ok) {
      const result = await response.json()
      setLiked(Boolean(result.liked))
      await refresh()
    }
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
      body: JSON.stringify({ action: 'comment', visitorName, content: comment }),
    })
    if (response.ok) {
      setComment('')
      await refresh()
    }
    setSending(false)
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 self-start">
      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-slate-900">Interacciones</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">en vivo</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="font-black text-slate-900">{data.stats.likes}</p>
            <p className="text-xs text-slate-500">me gusta</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="font-black text-slate-900">{data.stats.views}</p>
            <p className="text-xs text-slate-500">vistas</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="font-black text-slate-900">{data.comments.length}</p>
            <p className="text-xs text-slate-500">comentarios</p>
          </div>
        </div>
        <button
          type="button"
          disabled={sending}
          onClick={toggleLike}
          className="w-full rounded-2xl px-4 py-3 text-white font-bold shadow-sm disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${theme}, ${accent})` }}
        >
          {liked ? '💙 Te gusta' : '🤍 Me gusta'}
        </button>
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
        <h2 className="font-black text-slate-900 mb-4">Comentarios</h2>
        <form onSubmit={sendComment} className="space-y-3 mb-5">
          <input
            value={visitorName}
            onChange={event => setVisitorName(event.target.value)}
            placeholder="Tu nombre"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <textarea
            value={comment}
            onChange={event => setComment(event.target.value)}
            placeholder="Agrega un comentario..."
            rows={3}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button type="submit" disabled={sending || !comment.trim()} className="w-full rounded-2xl bg-slate-950 text-white px-4 py-3 text-sm font-bold disabled:opacity-50">
            Publicar comentario
          </button>
        </form>

        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-slate-400">Cargando comentarios…</p>
          ) : data.comments.length > 0 ? data.comments.map(item => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold" style={{ background: theme }}>
                  {(item.profiles?.full_name ?? item.visitor_name ?? 'V')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.profiles?.full_name ?? item.visitor_name ?? 'Visitante'}</p>
                  <p className="text-xs text-slate-400">{formatDate(item.created_at)}</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{item.content}</p>
            </div>
          )) : (
            <p className="text-sm text-slate-400">Sé la primera persona en comentar esta página.</p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-slate-900">Trending</h2>
          <span className="text-xs text-slate-400">Sello Tecnológico</span>
        </div>
        <div className="space-y-3">
          {data.trending.length > 0 ? data.trending.map((page, index) => (
            <Link key={page.id} href={`/p/${page.slug}`} className="block rounded-2xl border border-slate-100 hover:bg-slate-50 p-3 transition-colors">
              <p className="text-xs font-bold text-slate-400">#{index + 1} tendencia</p>
              <h3 className="font-black text-slate-900 line-clamp-1">{page.title.replace(/^Vitrina:\s*/i, '')}</h3>
              {page.description && <p className="text-xs text-slate-500 line-clamp-2 mt-1">{page.description}</p>}
              <p className="text-xs text-slate-400 mt-2">❤️ {page.likes_count ?? 0} · 👁️ {page.views_count ?? 0} · 💬 {page.comments_count ?? 0}</p>
            </Link>
          )) : (
            <p className="text-sm text-slate-400">Aún no hay otras páginas publicadas para mostrar.</p>
          )}
        </div>
      </section>
    </aside>
  )
}
