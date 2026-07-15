'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from '@/components/Sidebar'

type HistoryEntry = {
  id: string
  action: string
  created_at: string
  previous_visibility_status?: string | null
  new_visibility_status?: string | null
  previous_review_status?: string | null
  new_review_status?: string | null
  actor?: { full_name?: string | null; email?: string | null; role?: string | null } | null
}

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
  history: HistoryEntry[]
}

type Filter = 'all' | 'pending' | 'reviewed' | 'correction' | 'hidden'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Historial completo' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'reviewed', label: 'Aprobadas' },
  { id: 'correction', label: 'Corrección' },
  { id: 'hidden', label: 'Ocultas y anuladas' },
]

function visibilityLabel(status: string) {
  if (status === 'published') return 'Visible públicamente'
  if (status === 'hidden') return 'Oculta'
  if (status === 'deleted') return 'Anulada'
  if (status === 'expired') return 'Vencida'
  return status
}

function reviewLabel(status: string) {
  if (status === 'pending') return 'Pendiente de revisión'
  if (status === 'reviewed') return 'Aprobada / revisada'
  if (status === 'correction_requested') return 'Corrección solicitada'
  if (status === 'flagged') return 'Marcada'
  return status
}

function historyLabel(action: string) {
  if (action === 'published') return 'Publicada automáticamente'
  if (action === 'approved') return 'Aprobada por revisión'
  if (action === 'correction_requested') return 'Corrección solicitada'
  if (action === 'flagged') return 'Marcada para revisión'
  if (action === 'hidden') return 'Ocultada del público'
  if (action === 'restored') return 'Restaurada y publicada'
  if (action === 'cancelled') return 'Anulada'
  if (action === 'featured') return 'Marcada como destacada'
  if (action === 'unfeatured') return 'Quitada de destacadas'
  return 'Estado actualizado'
}

export default function ReviewStoriesClient() {
  const [stories, setStories] = useState<ReviewStory[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [historyAvailable, setHistoryAvailable] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/stories/review', { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      setStories(data.stories ?? [])
      setHistoryAvailable(data.history_available !== false)
      setError('')
    } else setError(data?.error ?? 'No se pudo cargar la revisión de historias.')
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const act = async (id: string, action: string) => {
    const destructive = action === 'cancel' ? window.confirm('La historia quedará anulada y dejará de verse públicamente. Su registro permanecerá en el historial. ¿Continuar?') : true
    if (!destructive) return
    setSendingId(id)
    const response = await fetch('/api/stories/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) setError(data?.error ?? 'No se pudo actualizar la historia.')
    await refresh()
    setSendingId('')
  }

  const counts = useMemo(() => ({
    pending: stories.filter(story => story.review_status === 'pending' && story.visibility_status === 'published').length,
    reviewed: stories.filter(story => story.review_status === 'reviewed').length,
    correction: stories.filter(story => story.review_status === 'correction_requested').length,
    hidden: stories.filter(story => ['hidden','deleted','expired'].includes(story.visibility_status)).length,
  }), [stories])

  const filteredStories = useMemo(() => stories.filter(story => {
    if (filter === 'all') return true
    if (filter === 'pending') return story.review_status === 'pending' && story.visibility_status === 'published'
    if (filter === 'reviewed') return story.review_status === 'reviewed'
    if (filter === 'correction') return story.review_status === 'correction_requested'
    return ['hidden','deleted','expired'].includes(story.visibility_status)
  }), [filter, stories])

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-500">Comunidad</p>
            <h1 className="mt-1 text-2xl font-black text-blue-950">Revisión e historial de historias</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">Aquí permanecen todas las historias: pendientes, aprobadas, con corrección solicitada, ocultas, restauradas y anuladas. Ninguna desaparece del historial de revisión.</p>
          </div>
          <button type="button" onClick={refresh} className="rounded-xl border border-blue-100 bg-white px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-50">Actualizar</button>
        </div>

        {!historyAvailable && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">El listado completo funciona, pero falta ejecutar la migración nueva para mostrar la línea de tiempo de cada cambio.</div>}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={() => setFilter('pending')} className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-left"><p className="text-3xl font-black text-amber-700">{counts.pending}</p><p className="text-sm font-bold text-amber-800">Pendientes</p></button>
          <button type="button" onClick={() => setFilter('reviewed')} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-left"><p className="text-3xl font-black text-emerald-700">{counts.reviewed}</p><p className="text-sm font-bold text-emerald-800">Aprobadas</p></button>
          <button type="button" onClick={() => setFilter('correction')} className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-left"><p className="text-3xl font-black text-blue-700">{counts.correction}</p><p className="text-sm font-bold text-blue-800">Requieren corrección</p></button>
          <button type="button" onClick={() => setFilter('hidden')} className="rounded-2xl border border-red-100 bg-red-50 p-5 text-left"><p className="text-3xl font-black text-red-700">{counts.hidden}</p><p className="text-sm font-bold text-red-800">Ocultas o anuladas</p></button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {FILTERS.map(item => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-xl px-4 py-2 text-sm font-black transition ${filter === item.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item.label}</button>)}
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400">Cargando historias…</div>
        ) : filteredStories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center"><div className="text-5xl">📚</div><h2 className="mt-3 text-xl font-black text-slate-800">No hay historias en esta categoría</h2><p className="mt-1 text-sm text-slate-500">Puedes cambiar a “Historial completo” para ver todos los registros.</p></div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredStories.map(story => {
              const first = story.items[0]
              const disabled = sendingId === story.id
              const canRestore = ['hidden','deleted','expired'].includes(story.visibility_status)
              return <article key={story.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="grid sm:grid-cols-[190px_minmax(0,1fr)]">
                  <div className="aspect-[9/16] max-h-[360px] bg-slate-950 sm:aspect-auto sm:h-full">
                    {first?.media_type === 'video' ? <video controls muted playsInline src={first.signed_url} className="h-full w-full object-contain" /> : first ? <img src={first.signed_url} alt={story.title || first.file_name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-4xl">📷</div>}
                  </div>
                  <div className="flex min-w-0 flex-col p-5">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${story.visibility_status === 'published' ? 'bg-emerald-100 text-emerald-700' : story.visibility_status === 'deleted' ? 'bg-slate-900 text-white' : 'bg-red-100 text-red-700'}`}>{visibilityLabel(story.visibility_status)}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${story.review_status === 'pending' ? 'bg-amber-100 text-amber-700' : story.review_status === 'reviewed' ? 'bg-emerald-100 text-emerald-700' : story.review_status === 'flagged' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{reviewLabel(story.review_status)}</span>
                      {story.is_featured && <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-700">Destacada</span>}
                    </div>
                    <h2 className="mt-4 text-lg font-black text-slate-900">{story.title || 'Historia sin título'}</h2>
                    {story.caption && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-600">{story.caption}</p>}
                    <div className="mt-4 space-y-1 text-xs font-semibold text-slate-400"><p>Autor: {story.author?.full_name || story.author?.email || 'Usuario'}</p>{story.page?.title && <p>Página: {story.page.title}</p>}<p>Publicada: {new Date(story.published_at).toLocaleString('es-CL')}</p><p>Archivos: {story.items.length}</p></div>

                    <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-black text-slate-700">Historial de acciones ({story.history?.length ?? 0})</summary>
                      <div className="mt-3 space-y-3 border-l-2 border-blue-100 pl-4">
                        {story.history?.length ? story.history.map(entry => <div key={entry.id}><p className="text-sm font-black text-slate-800">{historyLabel(entry.action)}</p><p className="text-xs text-slate-500">{entry.actor?.full_name || entry.actor?.email || 'Sistema'} · {new Date(entry.created_at).toLocaleString('es-CL')}</p>{(entry.previous_review_status || entry.new_review_status) && <p className="mt-1 text-[11px] text-slate-400">{entry.previous_review_status || '—'} → {entry.new_review_status || '—'}</p>}</div>) : <p className="text-xs text-slate-400">Sin registros detallados todavía.</p>}
                      </div>
                    </details>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                      <button type="button" disabled={disabled} onClick={() => act(story.id, 'reviewed')} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">✓ Aprobar / revisar</button>
                      <button type="button" disabled={disabled} onClick={() => act(story.id, story.is_featured ? 'unfeature' : 'feature')} className="rounded-xl bg-purple-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">{story.is_featured ? 'Quitar destacada' : '⭐ Destacar'}</button>
                      <button type="button" disabled={disabled} onClick={() => act(story.id, 'correction')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-700 disabled:opacity-50">Solicitar corrección</button>
                      <button type="button" disabled={disabled} onClick={() => act(story.id, canRestore ? 'restore' : 'hide')} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-black text-red-700 disabled:opacity-50">{canRestore ? 'Restaurar' : 'Ocultar'}</button>
                      {story.visibility_status !== 'deleted' && <button type="button" disabled={disabled} onClick={() => act(story.id, 'cancel')} className="col-span-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">Anular historia y conservar historial</button>}
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
