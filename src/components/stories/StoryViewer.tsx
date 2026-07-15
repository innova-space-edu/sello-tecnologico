'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import ReactionPicker, { type SocialReaction } from '@/components/social/ReactionPicker'
import type { CommunityStory, StoryReactionEmoji } from './types'

function visitorIdentity() {
  const key = 'sello_story_visitor_key'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  window.localStorage.setItem(key, created)
  return created
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable
    || target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.tagName === 'SELECT'
}

type Props = {
  story: CommunityStory
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
  onChanged: () => void
}

export default function StoryViewer({ story, hasPrevious, hasNext, onPrevious, onNext, onClose, onChanged }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [itemIndex, setItemIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [visitorKey, setVisitorKey] = useState('')
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(story.comments)
  const [reactions, setReactions] = useState(story.reactions)
  const [reactionCount, setReactionCount] = useState(story.reactions_count)
  const [commentCount, setCommentCount] = useState(story.comments_count)
  const [viewCount, setViewCount] = useState(story.views_count)
  const [viewerReaction, setViewerReaction] = useState<StoryReactionEmoji | null>(story.viewer_reaction ?? null)
  const [sending, setSending] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const item = story.items[itemIndex]
  const shareUrl = useMemo(
    () => typeof window === 'undefined' ? '' : `${window.location.origin}/comunidad?historia=${story.id}`,
    [story.id],
  )

  const goForward = useCallback(() => {
    if (itemIndex < story.items.length - 1) {
      setItemIndex(index => index + 1)
      setProgress(0)
    } else if (hasNext) {
      onNext()
    }
  }, [hasNext, itemIndex, onNext, story.items.length])

  const goBack = useCallback(() => {
    if (itemIndex > 0) {
      setItemIndex(index => index - 1)
      setProgress(0)
    } else if (hasPrevious) {
      onPrevious()
    }
  }, [hasPrevious, itemIndex, onPrevious])

  useEffect(() => {
    setVisitorKey(visitorIdentity())

    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAuthChecked(true)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      setCurrentUser({ id: user.id, name: profile?.full_name || user.email || 'Usuario' })
      setAuthChecked(true)
    }

    loadUser()
  }, [supabase])

  useEffect(() => {
    setItemIndex(0)
    setProgress(0)
    setPaused(false)
    setComments(story.comments)
    setReactions(story.reactions)
    setReactionCount(story.reactions_count)
    setCommentCount(story.comments_count)
    setViewCount(story.views_count)
    setViewerReaction(story.viewer_reaction ?? null)
  }, [story])

  useEffect(() => {
    if (!visitorKey) return

    fetch(`/api/stories/${story.id}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'view', visitorKey }),
    })
      .then(response => response.json())
      .then(data => {
        if (typeof data.views_count === 'number') setViewCount(data.views_count)
      })
      .catch(() => null)
  }, [story.id, visitorKey])

  useEffect(() => {
    if (!item || item.media_type !== 'image' || paused) return

    const started = Date.now() - progress * 6000
    const timer = window.setInterval(() => {
      const next = Math.min((Date.now() - started) / 6000, 1)
      setProgress(next)
      if (next >= 1) {
        window.clearInterval(timer)
        goForward()
      }
    }, 80)

    return () => window.clearInterval(timer)
  }, [goForward, item, paused, progress])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') goForward()
      if (event.key === 'ArrowLeft') goBack()
      if (event.key === ' ') {
        event.preventDefault()
        setPaused(value => !value)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goBack, goForward, onClose])

  useEffect(() => {
    if (!videoRef.current) return
    if (paused) videoRef.current.pause()
    else videoRef.current.play().catch(() => null)
  }, [paused, itemIndex])

  const applySnapshot = (data: any) => {
    if (data.reactions) setReactions(data.reactions)
    if (typeof data.reactions_count === 'number') setReactionCount(data.reactions_count)
    if (typeof data.comments_count === 'number') setCommentCount(data.comments_count)
    if (typeof data.views_count === 'number') setViewCount(data.views_count)
    if (Array.isArray(data.comments)) setComments(data.comments)
    setViewerReaction(data.viewer_reaction ?? null)
    onChanged()
  }

  const react = async (emoji: SocialReaction) => {
    if (!visitorKey || sending) return
    setSending(true)

    const response = await fetch(`/api/stories/${story.id}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reaction', visitorKey, emoji }),
    })
    const data = await response.json().catch(() => ({}))

    if (response.ok) applySnapshot(data)
    else setNotice(data?.error ?? 'No se pudo reaccionar.')
    setSending(false)
  }

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentUser) {
      setNotice('Debes iniciar sesión para comentar.')
      return
    }
    if (!comment.trim() || sending) return

    setSending(true)
    const response = await fetch(`/api/stories/${story.id}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'comment', content: comment }),
    })
    const data = await response.json().catch(() => ({}))

    if (response.ok) {
      setComment('')
      applySnapshot(data)
    } else {
      setNotice(data?.error ?? 'No se pudo comentar.')
    }
    setSending(false)
  }

  const report = async () => {
    const reason = window.prompt('¿Por qué deseas reportar esta historia?')
    if (!reason?.trim() || !visitorKey) return

    const response = await fetch(`/api/stories/${story.id}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'report', visitorKey, reason }),
    })
    setNotice(response.ok ? 'Reporte enviado para revisión.' : 'No se pudo enviar el reporte.')
  }

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: story.title || 'Historia Sello Tecnológico',
        text: story.caption || 'Mira esta historia de nuestra comunidad',
        url: shareUrl,
      }).catch(() => null)
      return
    }

    await navigator.clipboard.writeText(shareUrl).catch(() => null)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (!item) return null

  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(`${story.title || 'Historia Sello Tecnológico'} ${shareUrl}`)

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/95 text-white backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Visor de historias">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl font-black hover:bg-white/20" aria-label="Cerrar">×</button>

      <div className="mx-auto grid h-full max-w-6xl grid-cols-1 items-center gap-5 p-3 lg:grid-cols-[minmax(0,520px)_380px] lg:p-6">
        <section className="relative mx-auto flex h-[72vh] w-full max-w-[440px] overflow-hidden rounded-[2rem] bg-black shadow-2xl sm:h-[88vh]">
          <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
            {story.items.map((entry, index) => (
              <div key={entry.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full bg-white transition-[width] duration-75"
                  style={{ width: index < itemIndex ? '100%' : index === itemIndex ? `${progress * 100}%` : '0%' }}
                />
              </div>
            ))}
          </div>

          <div className="absolute inset-x-4 top-7 z-20 flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-3 py-2 backdrop-blur-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{story.author_name}</p>
              <p className="truncate text-[11px] text-white/75">{story.page_title || story.project_title || story.course_name || 'Comunidad'} · {formatDate(story.published_at)}</p>
            </div>
            <div className="flex gap-2">
              {item.media_type === 'video' && (
                <button type="button" onClick={() => setMuted(value => !value)} className="rounded-full bg-black/40 px-3 py-2 text-xs font-black">{muted ? '🔇' : '🔊'}</button>
              )}
              <button type="button" onClick={() => setPaused(value => !value)} className="rounded-full bg-black/40 px-3 py-2 text-xs font-black">{paused ? '▶' : 'Ⅱ'}</button>
            </div>
          </div>

          {item.media_type === 'video' ? (
            <video
              ref={videoRef}
              key={item.id}
              src={item.signed_url}
              autoPlay
              muted={muted}
              playsInline
              onTimeUpdate={event => {
                const target = event.currentTarget
                if (target.duration) setProgress(target.currentTime / target.duration)
              }}
              onEnded={goForward}
              className="h-full w-full object-contain"
            />
          ) : (
            <img src={item.signed_url} alt={story.title || item.file_name} className="h-full w-full object-contain" />
          )}

          <button type="button" onClick={goBack} className="absolute inset-y-20 left-0 z-10 w-1/3" aria-label="Anterior" />
          <button type="button" onClick={goForward} className="absolute inset-y-20 right-0 z-10 w-1/3" aria-label="Siguiente" />

          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/65 to-transparent p-5 pt-20">
            {story.title && <h2 className="text-xl font-black">{story.title}</h2>}
            {story.caption && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-white/90">{story.caption}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-black text-white/80">
              <span>✨ {reactionCount}</span>
              <span>💬 {commentCount}</span>
              <span>👁 {viewCount}</span>
            </div>
          </div>
        </section>

        <aside className="hidden max-h-[88vh] overflow-y-auto rounded-[2rem] bg-white p-5 text-slate-900 shadow-2xl lg:block">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">Reacciona y comenta</h3>
              <p className="text-xs text-slate-500">Reconoce el trabajo de la comunidad.</p>
            </div>
            <button type="button" onClick={report} className="text-xs font-bold text-slate-400 hover:text-red-600">Reportar</button>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-2">
            <ReactionPicker counts={reactions} selected={viewerReaction as SocialReaction | null} total={reactionCount} disabled={sending} onSelect={react} />
            <span className="text-xs font-semibold text-slate-500">Presiona el icono para elegir</span>
          </div>

          <div className="relative mt-4">
            <button type="button" onClick={() => setShareOpen(value => !value)} className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">🔗 Compartir historia</button>
            {shareOpen && (
              <div className="mt-2 grid gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl">
                <a href={`https://wa.me/?text=${encodedText}`} target="_blank" rel="noreferrer" className="rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-700">WhatsApp</a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer" className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">Facebook</a>
                <a href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(story.title || 'Historia Sello Tecnológico')}`} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">X / Twitter</a>
                <a href={`mailto:?subject=${encodeURIComponent(story.title || 'Historia Sello Tecnológico')}&body=${encodedText}`} className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">Correo</a>
                <button type="button" onClick={nativeShare} className="rounded-xl bg-indigo-600 px-3 py-2 text-left text-sm font-bold text-white">{copied ? '✅ Enlace copiado' : '📲 Compartir desde el dispositivo'}</button>
              </div>
            )}
          </div>

          <form onSubmit={submitComment} className="mt-5 space-y-2 border-t border-slate-100 pt-5">
            {authChecked && currentUser ? (
              <p className="text-xs font-semibold text-slate-500">Comentando como <strong className="text-slate-800">{currentUser.name}</strong></p>
            ) : authChecked ? (
              <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">Para comentar debes <Link href="/login" className="font-black underline">iniciar sesión</Link>.</div>
            ) : (
              <p className="text-xs text-slate-400">Comprobando sesión…</p>
            )}

            <div className="flex gap-2">
              <textarea
                value={comment}
                onChange={event => setComment(event.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                onKeyDown={event => event.stopPropagation()}
                rows={2}
                disabled={!currentUser}
                placeholder={currentUser ? 'Escribe un comentario…' : 'Inicia sesión para comentar'}
                className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
              />
              <button type="submit" disabled={sending || !comment.trim() || !currentUser} className="self-end rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:bg-slate-300">Publicar</button>
            </div>
          </form>

          {notice && <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{notice}</p>}

          <div className="mt-5 space-y-4">
            {comments.length ? comments.map(entry => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{entry.author_name[0]?.toUpperCase()}</div>
                <div>
                  <p className="text-sm"><strong>{entry.author_name}</strong> {entry.content}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(entry.created_at)}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-400">Aún no hay comentarios.</p>
            )}
          </div>
        </aside>
      </div>

      <div className="absolute inset-x-3 bottom-3 z-30 flex items-center justify-center gap-2 lg:hidden">
        <ReactionPicker counts={reactions} selected={viewerReaction as SocialReaction | null} total={reactionCount} compact inverted disabled={sending} onSelect={react} />
        <button type="button" onClick={nativeShare} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">🔗</button>
      </div>
    </div>
  )
}
