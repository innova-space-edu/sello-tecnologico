'use client'

import { useCallback, useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'

type ReviewStory = {
  id: string
  title?: string | null
  caption?: string | null
  visibility_status: string
  review_status: string
  is_featured: boolean
  published_at: string
  expires_at: string
  author?: { full_name?: string | null; email?: string | null; role?: string | null } | null
  page?: { title?: string | null; slug?: string | null } | null
  items: Array<{ id: string; media_type: 'image' | 'video'; signed_url: string; file_name: string }>
}

export default function ReviewStoriesClient() {
  const [stories, setStories] = useState<ReviewStory[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/stories/review', { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      setStories(data.stories ?? [])
      setError('')
    } else setError(data?.error ?? 'No se pudo cargar la revisión de historias.')
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const act = async (id: string, action: string) => {
    setSendingId(id)
    const response = await fetch('/api/stories/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) setError(data?.error ?? 'No se pudo actualizar la historia.')
    await refresh()
    setSendingId('')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-500">Comunidad</p>
            <h1 className="mt-1 text-2xl font-black text-blue-950">Revisión de historias</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">Las historias ya están visibles públicamente. Revisa el contenido después de su publicación y marca si está correcto, destacado o debe ocultarse.</p>
          </div>
          <button type="button" onClick={refresh} className="rounded-xl border border-blue-100 bg-white px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-50">Actualizar</button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5"><p className="text-3xl font-black text-amber-700">{stories.filter(story => story.review_status === 'pending').length}</p><p className="text-sm font-bold text-amber-800">Pendientes de revisión</p></div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-3xl font-black text-blue-700">{stories.filter(story => story.review_status === 'correction_requested').length}</p><p className="text-sm font-bold text-blue-800">Requieren corrección</p></div>
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5"><p className="text-3xl font-black text-red-700">{stories.filter(story => story.review_status === 'flagged').length}</p><p className="text-sm font-bold text-red-800">Marcadas u ocultas</p></div>
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400">Cargando historias…</div>
        ) : stories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center"><div className="text-5xl">✅</div><h2 className="mt-3 text-xl font-black text-slate-800">No hay historias pendientes</h2><p className="mt-1 text-sm text-slate-500">Las nuevas publicaciones aparecerán aquí automáticamente.</p></div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {stories.map(story => {
              const first = story.items[0]
              const disabled = sendingId === story.id
              return <article key={story.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="grid sm:grid-cols-[190px_minmax(0,1fr)]">
                  <div className="aspect-[9/16] max-h-[360px] bg-slate-950 sm:aspect-auto sm:h-full">
                    {first?.media_type === 'video' ? <video controls muted playsInline src={first.signed_url} className="h-full w-full object-contain" /> : first ? <img src={first.signed_url} alt={story.title || first.file_name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-4xl">📷</div>}
                  </div>
                  <div className="flex min-w-0 flex-col p-5">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">Visible públicamente</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${story.review_status === 'pending' ? 'bg-amber-100 text-amber-700' : story.review_status === 'flagged' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{story.review_status === 'pending' ? 'Pendiente de revisión' : story.review_status === 'flagged' ? 'Marcada' : 'Corrección solicitada'}</span>
                      {story.is_featured && <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-700">Destacada</span>}
                    </div>
                    <h2 className="mt-4 text-lg font-black text-slate-900">{story.title || 'Historia sin título'}</h2>
                    {story.caption && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-600">{story.caption}</p>}
                    <div className="mt-4 space-y-1 text-xs font-semibold text-slate-400">
                      <p>Autor: {story.author?.full_name || story.author?.email || 'Usuario'}</p>
                      {story.page?.title && <p>Página: {story.page.title}</p>}
                      <p>Publicada: {new Date(story.published_at).toLocaleString('es-CL')}</p>
                      <p>Archivos: {story.items.length}</p>
                    </div>
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                      <button type="button" disabled={disabled} onClick={() => act(story.id, 'reviewed')} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">✓ Marcar revisada</button>
                      <button type="button" disabled={disabled} onClick={() => act(story.id, story.is_featured ? 'unfeature' : 'feature')} className="rounded-xl bg-purple-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">{story.is_featured ? 'Quitar destacada' : '⭐ Destacar'}</button>
                      <button type="button" disabled={disabled} onClick={() => act(story.id, 'correction')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-700 disabled:opacity-50">Solicitar corrección</button>
                      <button type="button" disabled={disabled} onClick={() => act(story.id, story.visibility_status === 'hidden' ? 'restore' : 'hide')} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-black text-red-700 disabled:opacity-50">{story.visibility_status === 'hidden' ? 'Restaurar' : 'Ocultar'}</button>
                    </div>
                  </div>
                </div>
              </article>
            })}
          </div>
        )}
      </main>
    </div>
  )
}
