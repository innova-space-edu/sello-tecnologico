'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import SocialPostCard from './SocialPostCard'
import type { FeedPost, FeedResponse } from './types'

const TYPES = [
  { value: 'all', label: 'Todo' },
  { value: 'image', label: '🖼️ Imágenes' },
  { value: 'video', label: '🎬 Videos' },
  { value: 'audio', label: '🎙️ Audios' },
  { value: 'text', label: '📝 Textos' },
  { value: 'file', label: '📎 Archivos' },
]

export default function CommunityFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [sort, setSort] = useState<'recent' | 'trending'>('recent')
  const [type, setType] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const hasMoreRef = useRef(true)
  const [error, setError] = useState('')
  const cursorRef = useRef<string | null>(null)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const generationRef = useRef(0)

  const load = useCallback(async (replace = false) => {
    if (loadingRef.current) return
    if (!replace && !hasMoreRef.current) return
    loadingRef.current = true
    replace ? setLoading(true) : setLoadingMore(true)
    setError('')

    const generation = generationRef.current
    const params = new URLSearchParams({ limit: '10', sort, type })
    if (search) params.set('q', search)
    if (!replace && cursorRef.current) params.set('cursor', cursorRef.current)

    try {
      const response = await fetch(`/api/feed?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json() as FeedResponse & { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No fue posible cargar las publicaciones.')
      if (generation !== generationRef.current) return

      setPosts(current => {
        const combined = replace ? data.posts : [...current, ...data.posts]
        return Array.from(new Map(combined.map(post => [post.item_key, post])).values())
      })
      cursorRef.current = data.nextCursor
      const nextHasMore = Boolean(data.hasMore && data.nextCursor)
      hasMoreRef.current = nextHasMore
      setHasMore(nextHasMore)
    } catch (caught: any) {
      if (generation === generationRef.current) setError(caught?.message ?? 'No fue posible cargar la comunidad.')
    } finally {
      if (generation === generationRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
      loadingRef.current = false
    }
  }, [search, sort, type])

  useEffect(() => {
    generationRef.current += 1
    loadingRef.current = false
    cursorRef.current = null
    setPosts([])
    hasMoreRef.current = true
    setHasMore(true)
    load(true)
  }, [load])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && hasMoreRef.current && !loadingRef.current) load(false)
    }, { rootMargin: '500px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [load])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setSearch(searchInput.trim())
  }

  return (
    <div>
      <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4">
          <form onSubmit={submitSearch} className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:ring-2 focus-within:ring-blue-200">
              <span>🔎</span>
              <input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Buscar proyectos, cursos, autores o publicaciones" className="w-full bg-transparent py-3 text-sm outline-none" />
            </div>
            <button type="submit" className="rounded-2xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700">Buscar</button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {TYPES.map(item => (
                <button key={item.value} type="button" onClick={() => setType(item.value)} className={`rounded-full px-3 py-2 text-xs font-black transition ${type === item.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-black">
              <button type="button" onClick={() => setSort('recent')} className={`rounded-full px-3 py-2 ${sort === 'recent' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Recientes</button>
              <button type="button" onClick={() => setSort('trending')} className={`rounded-full px-3 py-2 ${sort === 'trending' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Tendencias</button>
            </div>
          </div>

          {search && (
            <div className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-2 text-sm text-blue-800">
              <span>Resultados para <strong>“{search}”</strong></span>
              <button type="button" onClick={() => { setSearchInput(''); setSearch('') }} className="font-black">Limpiar</button>
            </div>
          )}
        </div>
      </section>

      <div className="space-y-5" role="feed" aria-busy={loading || loadingMore}>
        {loading ? Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex gap-3 p-5"><div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" /><div className="flex-1 space-y-2"><div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" /><div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" /></div></div>
            <div className="h-72 animate-pulse bg-slate-100" />
          </div>
        )) : posts.length > 0 ? posts.map(post => <SocialPostCard key={post.item_key} post={post} />) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="text-5xl">🌐</div>
            <h2 className="mt-3 text-xl font-black text-slate-800">No encontramos publicaciones</h2>
            <p className="mt-1 text-sm text-slate-500">Prueba otro filtro o publica contenido desde una página de proyecto.</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error} <button type="button" onClick={() => load(posts.length === 0)} className="ml-2 font-black underline">Reintentar</button>
        </div>
      )}

      <div ref={sentinelRef} className="flex min-h-24 items-center justify-center py-6" aria-hidden={!hasMore}>
        {loadingMore && <div className="flex items-center gap-2 text-sm font-bold text-slate-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" /> Cargando más publicaciones…</div>}
        {!loading && !hasMore && posts.length > 0 && <p className="text-sm font-semibold text-slate-400">Llegaste al final de la comunidad.</p>}
      </div>
    </div>
  )
}
