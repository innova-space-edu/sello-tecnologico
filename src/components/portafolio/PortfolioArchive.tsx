'use client'

import { useEffect, useState } from 'react'
import PortfolioValue from '@/components/portafolio/PortfolioValue'
import { ARCHIVE_CATEGORIES } from '@/lib/portfolio-archive'

type ArchiveItem = {
  id: string; source_table: string; category: string; title: string; summary: string;
  source_created_at: string | null; captured_at: string; source_deleted: boolean;
  source_deleted_at: string | null; capture_count: number;
  attachment_refs?: Record<string, string | null> | null
}
type ArchiveDetail = ArchiveItem & { snapshot: Record<string, unknown> }
type ArchivePage = {
  items: ArchiveItem[]; total: number; page: number; pageSize: number; hasMore: boolean
}
const names = new Map(ARCHIVE_CATEGORIES.map(item => [item.key, item]))
function showDate(input: string | null) {
  if (!input) return 'Sin fecha'
  return new Date(input).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PortfolioArchive({ ownerId }: { ownerId?: string }) {
  const [category, setCategory] = useState('todos')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [onlyDeleted, setOnlyDeleted] = useState(false)
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<ArchivePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<ArchiveDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const delay = setTimeout(() => { setPage(0); setSearch(searchInput.trim()) }, 350)
    return () => clearTimeout(delay)
  }, [searchInput])

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ page: String(page), category })
    if (ownerId) query.set('owner', ownerId)
    if (search) query.set('q', search)
    if (onlyDeleted) query.set('deleted', 'true')
    setLoading(true)
    setError('')
    fetch('/api/portafolio/archivo?' + query, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'No fue posible consultar el archivo.')
        return body as ArchivePage
      })
      .then(body => { if (!controller.signal.aborted) setResult(body) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Error al consultar') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [ownerId, page, category, search, onlyDeleted])

  async function openDetail(id: string) {
    setDetail(null); setDetailLoading(true); setError('')
    const query = ownerId ? '?owner=' + encodeURIComponent(ownerId) : ''
    try {
      const response = await fetch('/api/portafolio/archivo/' + id + query, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No fue posible abrir este registro.')
      setDetail(body.item as ArchiveDetail)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Error al abrir el registro') }
    finally { setDetailLoading(false) }
  }

  return <section className="space-y-4 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-violet-600">Biblioteca personal · permanente</p>
        <h2 className="mt-1 text-xl font-black text-blue-950">Archivo automático de mis trabajos</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Proyectos, informes, evidencias, seguimientos, páginas, encuestas, obras y otros registros se incorporan automáticamente. Si se borra el original, la ficha archivada permanece.</p>
      </div>
      <span className="rounded-full bg-violet-100 px-4 py-2 text-sm font-black text-violet-800">{result?.total ?? 0} registros</span>
    </div>

    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
      <label className="block text-xs font-semibold text-slate-600">Buscar en mis registros
        <input value={searchInput} onChange={event => setSearchInput(event.target.value)}
          placeholder="Título, proyecto, evidencia…" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
      </label>
      <label className="block text-xs font-semibold text-slate-600">Tipo de archivo
        <select value={category} onChange={event => { setCategory(event.target.value); setPage(0) }}
          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
          {ARCHIVE_CATEGORIES.map(item => <option key={item.key} value={item.key}>{item.icon} {item.label}</option>)}
        </select>
      </label>
    </div>
    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
      <input type="checkbox" checked={onlyDeleted} onChange={event => { setOnlyDeleted(event.target.checked); setPage(0) }} />
      Mostrar solo originales eliminados
    </label>

    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading && <p role="status" className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">Cargando mi archivo…</p>}
    {!loading && !error && result && result.items.length === 0 && <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-600">No hay registros para estos filtros. Cuando crees un trabajo, aparecerá automáticamente aquí.</p>}

    {!loading && result && result.items.length > 0 && <div className="grid gap-3 md:grid-cols-2">
      {result.items.map(item => <button key={item.id} type="button" onClick={() => void openDetail(item.id)}
        className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-violet-700">{names.get(item.category)?.icon || '📁'} {names.get(item.category)?.label || item.category}</span>
          {item.source_deleted && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">Original eliminado</span>}
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-black text-blue-950">{item.title}</h3>
        {item.summary && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.summary}</p>}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{showDate(item.source_created_at || item.captured_at)}</span>
          <span className="font-bold text-blue-700">Ver copia →</span>
        </div>
      </button>)}
    </div>}

    {!loading && result && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
      <span>{result.total ? page * result.pageSize + 1 : 0}–{Math.min((page + 1) * result.pageSize, result.total)} de {result.total}</span>
      <div className="flex gap-2">
        <button type="button" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-40">← Anterior</button>
        <button type="button" disabled={!result.hasMore} onClick={() => setPage(value => value + 1)}
          className="rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-40">Siguiente →</button>
      </div>
    </div>}
    <p className="text-xs leading-5 text-slate-500">Este archivo conserva copias de los datos. Los adjuntos almacenados en otros servicios se registran como referencias; si se elimina el archivo físico original, esa referencia podría dejar de funcionar.</p>

    {detailLoading && <p role="status" className="rounded-lg bg-slate-100 p-4 text-sm">Abriendo registro histórico…</p>}
    {detail && <div role="dialog" aria-modal="true" aria-labelledby="archive-detail-title"
      className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-3 sm:p-8">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-violet-600">Copia histórica · {names.get(detail.category)?.label || detail.category}</p>
            <h2 id="archive-detail-title" className="mt-2 text-xl font-black text-blue-950">{detail.title}</h2>
            <p className="mt-2 text-xs text-slate-500">Creado: {showDate(detail.source_created_at)} · Capturado: {showDate(detail.captured_at)}</p>
            {detail.source_deleted && <p className="mt-2 text-sm font-bold text-amber-800">El original fue eliminado. Este contenido archivado se conserva.</p>}
          </div>
          <button type="button" onClick={() => setDetail(null)} aria-label="Cerrar detalle"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">✕ Cerrar</button>
        </div>
        <div className="mt-5 max-h-[65vh] space-y-5 overflow-y-auto">
          <div>
            <h3 className="mb-3 text-sm font-black text-blue-950">Contenido conservado</h3>
            <PortfolioValue value={detail.snapshot} />
          </div>
          {detail.attachment_refs && Object.values(detail.attachment_refs).some(Boolean) &&
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-amber-950">Referencias de archivos originales</h3>
              <PortfolioValue value={detail.attachment_refs} />
              <p className="mt-2 text-xs text-amber-900">Estos enlaces y rutas no constituyen por sí mismos una copia independiente del archivo.</p>
            </div>}
        </div>
      </div>
    </div>}
  </section>
}
