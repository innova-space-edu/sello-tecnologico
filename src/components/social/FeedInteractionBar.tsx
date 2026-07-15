'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import ReactionPicker, { type SocialReaction } from './ReactionPicker'
import type { FeedPost } from './types'

type Comment = {
  id: string
  visitor_name?: string | null
  content: string
  created_at: string
  profiles?: { full_name?: string | null } | null
}

function visitorKey() {
  const storageKey = 'sello_vitrina_visitor_key'
  const existing = window.localStorage.getItem(storageKey)
  if (existing) return existing
  const created = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  window.localStorage.setItem(storageKey, created)
  return created
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function FeedInteractionBar({ post }: { post: FeedPost }) {
  const supabase = useMemo(() => createClient(), [])
  const targetType = post.item_type
  const apiUrl = useMemo(() => `/api/vitrinas/social/${post.page_slug}`, [post.page_slug])
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState('')
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [reactions, setReactions] = useState<Partial<Record<SocialReaction, number>>>({ '❤️': post.likes_count })
  const [viewerReaction, setViewerReaction] = useState<SocialReaction | null>(null)
  const [stats, setStats] = useState({ likes: post.likes_count, comments: post.comments_count, views: post.views_count })

  const params = useMemo(() => {
    const search = new URLSearchParams({ targetType, targetId: post.item_id, visitorKey: key, includeComments: '1' })
    return search.toString()
  }, [key, post.item_id, targetType])

  useEffect(() => {
    const currentKey = visitorKey()
    setKey(currentKey)
    setSaved(window.localStorage.getItem(`sello_saved_${post.item_key}`) === '1')
    setFollowing(window.localStorage.getItem(`sello_following_${post.page_slug}`) === '1')

    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthChecked(true); return }
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      setCurrentUser({ id: user.id, name: profile?.full_name || user.email || 'Usuario' })
      setAuthChecked(true)
    }
    loadUser()

    const sessionKey = `sello_viewed_${post.item_key}`
    if (!window.sessionStorage.getItem(sessionKey)) {
      window.sessionStorage.setItem(sessionKey, '1')
      fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view', visitorKey: currentKey, targetType, targetId: post.item_id }),
      }).then(response => response.ok ? response.json() : null).then(result => {
        if (result?.counted) setStats(current => ({ ...current, views: current.views + 1 }))
      }).catch(() => null)
    }
  }, [apiUrl, post.item_id, post.item_key, post.page_slug, supabase, targetType])

  const refreshComments = async () => {
    if (!key) return
    setCommentsLoading(true)
    const response = await fetch(`${apiUrl}?${params}`, { cache: 'no-store' })
    if (response.ok) {
      const data = await response.json()
      setComments(data.comments ?? [])
      if (data.stats) setStats(data.stats)
      setReactions(data.reactions ?? {})
      setViewerReaction(data.viewer_reaction ?? null)
    }
    setCommentsLoading(false)
  }

  const toggleComments = async () => {
    const next = !commentsOpen
    setCommentsOpen(next)
    if (next) await refreshComments()
  }

  const react = async (emoji: SocialReaction) => {
    if (!key || busy) return
    setBusy(true)
    const response = await fetch(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reaction', emoji, visitorKey: key, targetType, targetId: post.item_id }),
    })
    const result = await response.json().catch(() => ({}))
    if (response.ok) {
      setReactions(result.reactions ?? {})
      setViewerReaction(result.viewer_reaction ?? null)
      setStats(current => ({ ...current, likes: result.reactions_count ?? current.likes }))
    } else setNotice(result?.error ?? 'No se pudo reaccionar.')
    setBusy(false)
  }

  const toggleSave = () => {
    const next = !saved
    setSaved(next)
    if (next) window.localStorage.setItem(`sello_saved_${post.item_key}`, '1')
    else window.localStorage.removeItem(`sello_saved_${post.item_key}`)
  }

  const toggleFollow = () => {
    const next = !following
    setFollowing(next)
    if (next) window.localStorage.setItem(`sello_following_${post.page_slug}`, '1')
    else window.localStorage.removeItem(`sello_following_${post.page_slug}`)
  }

  const share = async () => {
    const url = `${window.location.origin}/p/${post.page_slug}#${post.item_type === 'asset' ? 'archivo' : 'publicacion'}-${post.item_id}`
    if (navigator.share) { await navigator.share({ title: post.title ?? post.page_title, url }).catch(() => null); return }
    await navigator.clipboard.writeText(url).catch(() => null)
    setNotice('Enlace copiado')
    window.setTimeout(() => setNotice(''), 1600)
  }

  const sendComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentUser) { setNotice('Debes iniciar sesión para comentar.'); return }
    if (!comment.trim() || busy) return
    setBusy(true)
    const response = await fetch(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'comment', content: comment, targetType, targetId: post.item_id }),
    })
    if (response.ok) {
      setComment('')
      setNotice('Comentario publicado')
      await refreshComments()
      window.setTimeout(() => setNotice(''), 1600)
    } else {
      const result = await response.json().catch(() => ({}))
      setNotice(result?.error ?? 'No fue posible comentar.')
    }
    setBusy(false)
  }

  return (
    <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5">
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
        <div className="flex items-center gap-3"><span>✨ {stats.likes}</span><button type="button" onClick={toggleComments} className="hover:text-slate-800">💬 {stats.comments}</button><span>👁️ {stats.views}</span></div>
        <button type="button" onClick={toggleFollow} className="rounded-full px-3 py-1 transition hover:bg-slate-100">{following ? '✓ Siguiendo' : '+ Seguir página'}</button>
      </div>

      <div className="mt-3 grid grid-cols-4 items-center border-y border-slate-100 py-1 text-sm font-bold text-slate-600">
        <ReactionPicker counts={reactions} selected={viewerReaction} total={stats.likes} disabled={busy} onSelect={react} />
        <button type="button" onClick={toggleComments} className="rounded-lg py-2 transition hover:bg-slate-50">💬 Comentar</button>
        <button type="button" onClick={share} className="rounded-lg py-2 transition hover:bg-slate-50">🔗 Compartir</button>
        <button type="button" onClick={toggleSave} className={`rounded-lg py-2 transition hover:bg-slate-50 ${saved ? 'text-blue-700' : ''}`}>{saved ? '🔖 Guardado' : '🔖 Guardar'}</button>
      </div>

      {notice && <p className="mt-2 text-xs font-semibold text-blue-700">{notice}</p>}

      {commentsOpen && (
        <div className="mt-4">
          {authChecked && currentUser ? <p className="mb-2 text-xs font-semibold text-slate-500">Comentando como <strong className="text-slate-800">{currentUser.name}</strong></p> : authChecked ? <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">Para comentar debes <Link href="/login" className="font-black underline">iniciar sesión</Link>.</div> : <p className="mb-2 text-xs text-slate-400">Comprobando sesión…</p>}
          <form onSubmit={sendComment} className="flex flex-1 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:ring-2 focus-within:ring-blue-200">
            <textarea value={comment} onChange={event => setComment(event.target.value)} disabled={!currentUser} placeholder={currentUser ? 'Escribe un comentario…' : 'Inicia sesión para comentar'} rows={1} className="min-h-9 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none disabled:text-slate-400" />
            <button type="submit" disabled={busy || !comment.trim() || !currentUser} className="rounded-xl bg-blue-600 px-4 text-xs font-black text-white disabled:bg-slate-300">Publicar</button>
          </form>

          <div className="mt-4 space-y-3">
            {commentsLoading ? <p className="text-sm text-slate-400">Cargando comentarios…</p> : comments.length > 0 ? comments.map(item => {
              const commentName = item.profiles?.full_name ?? item.visitor_name ?? 'Usuario'
              return <div key={item.id} className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{commentName.slice(0, 1).toUpperCase()}</div><div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2"><p className="text-sm text-slate-800"><span className="font-black">{commentName}</span> {item.content}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(item.created_at)}</p></div></div>
            }) : <p className="text-sm text-slate-400">Aún no hay comentarios.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
