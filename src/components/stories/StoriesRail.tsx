'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import StoryUploader from './StoryUploader'
import StoryViewer from './StoryViewer'
import type { CommunityStory, StoriesResponse } from './types'

function getVisitorKey() {
  const key = 'sello_story_visitor_key'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  window.localStorage.setItem(key, created)
  return created
}

function storyLabel(story: CommunityStory) {
  return story.title || story.page_title || story.project_title || 'Nueva historia'
}

export default function StoriesRail() {
  const supabase = useMemo(() => createClient(), [])
  const [stories, setStories] = useState<CommunityStory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visitorKey, setVisitorKey] = useState('')
  const [showUploader, setShowUploader] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const refresh = useCallback(async (preferredId?: string) => {
    const key = visitorKey || (typeof window !== 'undefined' ? getVisitorKey() : '')
    if (key && !visitorKey) setVisitorKey(key)
    try {
      const params = new URLSearchParams({ limit: '24' })
      if (key) params.set('visitorKey', key)
      const response = await fetch(`/api/stories?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json() as StoriesResponse & { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No fue posible cargar las historias.')
      setStories(data.stories ?? [])
      setError('')

      const queryId = preferredId || new URLSearchParams(window.location.search).get('historia') || ''
      if (queryId) {
        const index = (data.stories ?? []).findIndex(story => story.id === queryId)
        if (index >= 0) setActiveIndex(index)
      }
    } catch (caught: any) {
      setError(caught?.message ?? 'No fue posible cargar las historias.')
    } finally {
      setLoading(false)
    }
  }, [visitorKey])

  useEffect(() => {
    const key = getVisitorKey()
    setVisitorKey(key)
  }, [])

  useEffect(() => {
    if (!visitorKey) return
    refresh()
  }, [refresh, visitorKey])

  useEffect(() => {
    const channel = supabase.channel('community-stories-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_stories' }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh, supabase])

  const openStory = (index: number) => {
    setActiveIndex(index)
    const story = stories[index]
    if (story) {
      const url = new URL(window.location.href)
      url.searchParams.set('historia', story.id)
      window.history.replaceState({}, '', url)
    }
  }

  const closeStory = () => {
    setActiveIndex(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('historia')
    window.history.replaceState({}, '', url)
  }

  const move = (direction: -1 | 1) => {
    if (activeIndex === null) return
    const next = activeIndex + direction
    if (next < 0 || next >= stories.length) return
    openStory(next)
  }

  const created = async (storyId: string) => {
    setShowUploader(false)
    await refresh(storyId)
  }

  const activeStory = activeIndex === null ? null : stories[activeIndex]

  return (
    <>
      <section className="relative mb-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-5 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-100">Historias de la comunidad</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Mira y comparte lo que estamos creando</h1>
            <p className="mt-2 text-sm leading-relaxed text-blue-100 sm:text-base">Imágenes y videos cortos publicados por estudiantes y docentes. Reacciona, comenta y compártelos.</p>
          </div>
          <button type="button" onClick={() => setShowUploader(true)} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-lg transition hover:-translate-y-0.5">＋ Crear historia</button>
        </div>

        <div className="relative mt-6 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          <button type="button" onClick={() => setShowUploader(true)} className="group relative aspect-[9/16] w-28 shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-dashed border-white/50 bg-white/10 text-center backdrop-blur sm:w-32">
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-3xl font-light text-blue-700 shadow-lg transition group-hover:scale-110">＋</span>
              <span className="mt-3 text-sm font-black">Tu historia</span>
              <span className="mt-1 text-[10px] text-blue-100">Publicación inmediata</span>
            </div>
          </button>

          {loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="aspect-[9/16] w-28 shrink-0 animate-pulse rounded-2xl bg-white/15 sm:w-32" />) : stories.map((story, index) => {
            const first = story.items[0]
            return (
              <button key={story.id} type="button" onClick={() => openStory(index)} className="group relative aspect-[9/16] w-28 shrink-0 snap-start overflow-hidden rounded-2xl bg-slate-950 text-left shadow-lg ring-2 ring-white/60 transition hover:-translate-y-1 sm:w-32">
                {first?.media_type === 'video' ? <video src={first.signed_url} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-90" /> : first ? <img src={first.signed_url} alt={storyLabel(story)} className="h-full w-full object-cover opacity-90" /> : <div className="h-full w-full bg-white/10" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
                {first?.media_type === 'video' && <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-xs backdrop-blur">▶</span>}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="line-clamp-2 text-xs font-black leading-tight text-white">{storyLabel(story)}</p>
                  <p className="mt-1 truncate text-[10px] font-semibold text-white/75">{story.author_name}</p>
                  <p className="mt-2 text-[10px] font-bold text-white/80">✨ {story.reactions_count} · 💬 {story.comments_count}</p>
                </div>
              </button>
            )
          })}
        </div>

        {!loading && stories.length === 0 && !error && <p className="relative mt-3 text-sm font-semibold text-blue-100">Sé la primera persona en publicar una historia de la comunidad.</p>}
        {error && <div className="relative mt-4 rounded-2xl bg-red-950/30 px-4 py-3 text-sm text-red-100">{error} <button type="button" onClick={() => refresh()} className="font-black underline">Reintentar</button></div>}
      </section>

      {showUploader && <StoryUploader onClose={() => setShowUploader(false)} onCreated={created} />}
      {activeStory && activeIndex !== null && <StoryViewer story={activeStory} hasPrevious={activeIndex > 0} hasNext={activeIndex < stories.length - 1} onPrevious={() => move(-1)} onNext={() => move(1)} onClose={closeStory} onChanged={() => refresh(activeStory.id)} />}
    </>
  )
}
