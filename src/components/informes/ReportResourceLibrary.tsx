'use client'

import { useMemo, useState } from 'react'

export type ReportResource = {
  id: string
  kind: 'project' | 'evidence' | 'survey' | 'page'
  title: string
  description?: string | null
  url?: string | null
  mimeType?: string | null
  metadata?: Record<string, unknown>
}

type Props = {
  resources: ReportResource[]
  onInsert: (resource: ReportResource) => void
}

const labels: Record<ReportResource['kind'], string> = {
  project: 'Proyecto', evidence: 'Evidencias', survey: 'Encuestas', page: 'Páginas',
}
const icons: Record<ReportResource['kind'], string> = {
  project: '🗂️', evidence: '📎', survey: '🗳️', page: '🌐',
}

export default function ReportResourceLibrary({ resources, onInsert }: Props) {
  const [kind, setKind] = useState<'all' | ReportResource['kind']>('all')
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => resources.filter(resource => {
    const matchesKind = kind === 'all' || resource.kind === kind
    const matchesSearch = !search || `${resource.title} ${resource.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesKind && matchesSearch
  }), [kind, resources, search])

  return <aside className="rounded-2xl border border-gray-100 bg-white shadow-sm">
    <div className="border-b border-gray-100 p-4">
      <h2 className="font-bold text-blue-900">📚 Biblioteca del proyecto</h2>
      <p className="mt-1 text-xs text-gray-500">Reutiliza información, imágenes, videos, encuestas y páginas ya creadas. No necesitas subirlas otra vez.</p>
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar recursos" className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(['all', 'project', 'evidence', 'survey', 'page'] as const).map(value => <button key={value} type="button" onClick={() => setKind(value)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${kind === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{value === 'all' ? 'Todo' : labels[value]}</button>)}
      </div>
    </div>
    <div className="max-h-[65vh] space-y-2 overflow-y-auto p-3">
      {filtered.map(resource => <div key={`${resource.kind}-${resource.id}`} className="rounded-xl border border-gray-100 p-3 hover:border-blue-200 hover:bg-blue-50">
        <div className="flex items-start gap-3">
          <span className="text-xl">{icons[resource.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-800">{resource.title}</p>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-500">{labels[resource.kind]}</p>
            {resource.description && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{resource.description}</p>}
          </div>
        </div>
        {resource.kind === 'evidence' && resource.url && resource.mimeType?.startsWith('image/') && <img src={resource.url} alt={resource.title} className="mt-3 h-28 w-full rounded-lg object-cover" />}
        {resource.kind === 'evidence' && resource.url && resource.mimeType?.startsWith('video/') && <video src={resource.url} controls preload="metadata" className="mt-3 max-h-36 w-full rounded-lg bg-black" />}
        <button type="button" onClick={() => onInsert(resource)} className="mt-3 w-full rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">+ Agregar a la sección activa</button>
      </div>)}
      {filtered.length === 0 && <div className="p-6 text-center text-sm text-gray-400">No hay recursos con este filtro.</div>}
    </div>
  </aside>
}
