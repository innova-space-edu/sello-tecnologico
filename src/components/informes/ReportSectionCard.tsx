'use client'

import type { ReportResource } from './ReportResourceLibrary'

export type ReportSection = {
  id: string
  section_type: string
  title: string
  content: { text?: string; resources?: ReportResource[]; table?: string[][]; [key: string]: unknown }
  student_example?: string | null
  teacher_example?: string | null
  sort_order: number
  updated_by?: string | null
}

export type SectionComment = {
  id: string
  section_id?: string | null
  body: string
  status: string
  created_at: string
  profiles?: { full_name?: string | null; role?: string | null } | null
}

type Props = {
  section: ReportSection
  index: number
  active: boolean
  canEdit: boolean
  isStaff: boolean
  comments: SectionComment[]
  commentValue: string
  onActivate: () => void
  onChange: (patch: Partial<ReportSection>) => void
  onCommentChange: (value: string) => void
  onAddComment: () => void
  onResolveComment: (id: string) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void
}

function ResourcePreview({ resource }: { resource: ReportResource }) {
  if (resource.kind === 'evidence' && resource.url && resource.mimeType?.startsWith('image/')) {
    return <figure className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"><img src={resource.url} alt={resource.title} className="max-h-96 w-full object-contain" /><figcaption className="p-3 text-sm text-gray-600"><strong>{resource.title}</strong>{resource.description ? ` — ${resource.description}` : ''}</figcaption></figure>
  }
  if (resource.kind === 'evidence' && resource.url && resource.mimeType?.startsWith('video/')) {
    return <figure className="overflow-hidden rounded-xl border border-gray-200 bg-black"><video src={resource.url} controls playsInline preload="metadata" className="max-h-[480px] w-full object-contain" /><figcaption className="bg-white p-3 text-sm text-gray-600"><strong>{resource.title}</strong></figcaption></figure>
  }
  if (resource.url && /youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com/.test(resource.url)) {
    return <a href={resource.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700"><span>▶️ {resource.title}</span><span>Abrir video</span></a>
  }
  return <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p className="text-sm font-bold text-gray-800">{resource.kind === 'survey' ? '🗳️' : resource.kind === 'page' ? '🌐' : resource.kind === 'project' ? '🗂️' : '📎'} {resource.title}</p>{resource.description && <p className="mt-1 text-sm text-gray-500">{resource.description}</p>}{resource.url && <a href={resource.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-blue-600 hover:underline">Abrir recurso →</a>}</div>
}

export default function ReportSectionCard({ section, index, active, canEdit, isStaff, comments, commentValue, onActivate, onChange, onCommentChange, onAddComment, onResolveComment, onMoveUp, onMoveDown, onRemove }: Props) {
  const content = section.content ?? {}
  const table = Array.isArray(content.table) ? content.table : []
  const resources = Array.isArray(content.resources) ? content.resources : []

  const updateTableCell = (rowIndex: number, columnIndex: number, value: string) => {
    const next = table.map(row => [...row])
    next[rowIndex][columnIndex] = value
    onChange({ content: { ...content, table: next } })
  }
  const addRow = () => {
    const columns = Math.max(2, table[0]?.length ?? 3)
    onChange({ content: { ...content, table: [...table, Array(columns).fill('')] } })
  }
  const addColumn = () => {
    const base = table.length ? table : [['Columna 1'], ['']]
    onChange({ content: { ...content, table: base.map((row, rowIndex) => [...row, rowIndex === 0 ? `Columna ${row.length + 1}` : '']) } })
  }
  const removeResource = (resourceIndex: number) => onChange({ content: { ...content, resources: resources.filter((_, current) => current !== resourceIndex) } })

  return <section onClick={onActivate} className={`scroll-mt-24 rounded-2xl border bg-white shadow-sm transition ${active ? 'border-blue-500 ring-4 ring-blue-100' : 'border-gray-100 hover:border-blue-200'}`}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">{index + 1}</span>
        <div className="min-w-0 flex-1">
          {canEdit ? <input value={section.title} onChange={event => onChange({ title: event.target.value })} className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-blue-900 hover:border-gray-200 focus:border-blue-300 focus:outline-none" /> : <h2 className="text-lg font-bold text-blue-900">{section.title}</h2>}
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-gray-400">{section.section_type.replaceAll('_', ' ')}</p>
        </div>
      </div>
      {canEdit && <div className="flex items-center gap-1">
        {onMoveUp && <button type="button" onClick={event => { event.stopPropagation(); onMoveUp() }} className="rounded-lg px-2.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100" title="Mover hacia arriba">↑</button>}
        {onMoveDown && <button type="button" onClick={event => { event.stopPropagation(); onMoveDown() }} className="rounded-lg px-2.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100" title="Mover hacia abajo">↓</button>}
        {onRemove && <button type="button" onClick={event => { event.stopPropagation(); onRemove() }} className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Eliminar</button>}
      </div>}
    </header>

    <div className="space-y-4 p-5">
      {section.student_example && <details className="rounded-xl border border-emerald-100 bg-emerald-50 p-3" open={!content.text}>
        <summary className="cursor-pointer text-sm font-bold text-emerald-800">💡 Ejemplo para estudiantes</summary>
        <p className="mt-2 text-sm leading-relaxed text-emerald-700">{section.student_example}</p>
      </details>}
      {isStaff && section.teacher_example && <details className="rounded-xl border border-purple-100 bg-purple-50 p-3">
        <summary className="cursor-pointer text-sm font-bold text-purple-800">👩‍🏫 Orientación para revisión docente</summary>
        <p className="mt-2 text-sm leading-relaxed text-purple-700">{section.teacher_example}</p>
      </details>}

      {canEdit ? <textarea value={String(content.text ?? '')} onChange={event => onChange({ content: { ...content, text: event.target.value } })} rows={section.section_type === 'title' ? 3 : section.section_type === 'summary' ? 5 : 8} placeholder={section.section_type === 'title' ? 'Escribe el título, subtítulo o encabezado…' : 'Escribe aquí el contenido de esta sección…'} className={`w-full rounded-xl border border-gray-200 px-4 py-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-300 ${section.section_type === 'title' ? 'text-xl font-bold' : 'text-sm'}`} /> : content.text ? <div className="whitespace-pre-wrap text-sm leading-7 text-gray-700">{String(content.text)}</div> : <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">Esta sección todavía no tiene texto.</p>}

      {(section.section_type === 'results' || table.length > 0) && <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full border-collapse text-sm"><tbody>{table.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={columnIndex} className={`border border-gray-200 p-1 ${rowIndex === 0 ? 'bg-gray-100' : 'bg-white'}`}>{canEdit ? <input value={cell} onChange={event => updateTableCell(rowIndex, columnIndex, event.target.value)} className={`min-w-28 w-full bg-transparent px-2 py-2 focus:outline-none ${rowIndex === 0 ? 'font-bold' : ''}`} /> : <span className={`block px-2 py-2 ${rowIndex === 0 ? 'font-bold' : ''}`}>{cell}</span>}</td>)}</tr>)}</tbody></table>
        {canEdit && <div className="flex gap-2 border-t border-gray-200 bg-gray-50 p-2"><button type="button" onClick={addRow} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-sm">+ Fila</button><button type="button" onClick={addColumn} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-sm">+ Columna</button></div>}
      </div>}

      {resources.length > 0 && <div className="space-y-3">{resources.map((resource, resourceIndex) => <div key={`${resource.kind}-${resource.id}-${resourceIndex}`} className="relative"><ResourcePreview resource={resource} />{canEdit && <button type="button" onClick={() => removeResource(resourceIndex)} className="absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-black text-red-600 shadow">Quitar</button>}</div>)}</div>}
    </div>

    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-gray-800">💬 Retroalimentación de esta sección</h3><span className="text-xs text-gray-400">{comments.length} comentario{comments.length === 1 ? '' : 's'}</span></div>
      <div className="space-y-2">{comments.map(comment => <div key={comment.id} className={`rounded-xl border p-3 text-sm ${comment.status === 'resolved' ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-gray-800">{comment.profiles?.full_name ?? 'Docente'} <span className="font-normal text-gray-400">· {new Date(comment.created_at).toLocaleString('es-CL')}</span></p><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${comment.status === 'resolved' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>{comment.status === 'resolved' ? 'Resuelto' : 'Pendiente'}</span></div><p className="mt-2 whitespace-pre-wrap leading-relaxed text-gray-700">{comment.body}</p>{isStaff && comment.status !== 'resolved' && <button type="button" onClick={() => onResolveComment(comment.id)} className="mt-2 text-xs font-bold text-green-700 hover:underline">Marcar como resuelto</button>}</div>)}</div>
      {isStaff && <div className="mt-3 flex gap-2"><textarea value={commentValue} onChange={event => onCommentChange(event.target.value)} rows={2} placeholder="Escribe una observación específica para esta sección…" className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" /><button type="button" onClick={onAddComment} disabled={!commentValue.trim()} className="self-end rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">Comentar</button></div>}
    </div>
  </section>
}
