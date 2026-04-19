'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { BLOCK_META, BLOCK_COLORS, type BlockType, type Template, type TemplateBlock } from '@/lib/templates'

const BLOCK_TYPES = Object.keys(BLOCK_META) as BlockType[]

export default function EditarPlantillaPage() {
  const supabase   = createClient()
  const router     = useRouter()
  const params     = useParams()
  const templateId = params.id as string

  const [template, setTemplate] = useState<Template | null>(null)
  const [blocks, setBlocks]     = useState<TemplateBlock[]>([])
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [editName, setEditName] = useState(false)
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [editBlock, setEditBlock] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!['admin','docente','coordinador'].includes(p?.role ?? '')) { router.push('/dashboard'); return }
      await fetchTemplate()
    }
    init()
  }, [templateId])

  const fetchTemplate = async () => {
    const { data: t } = await supabase.from('templates').select('*').eq('id', templateId).single()
    if (!t) { router.push('/admin/plantillas'); return }
    setTemplate(t)
    setName(t.name)
    setDesc(t.description ?? '')
    const { data: b } = await supabase
      .from('template_blocks').select('*')
      .eq('template_id', templateId).order('order_index')
    setBlocks(b ?? [])
  }

  const saveNameDesc = async () => {
    setSaving(true)
    await supabase.from('templates').update({ name, description: desc, updated_at: new Date().toISOString() }).eq('id', templateId)
    setEditName(false)
    setSaving(false)
    showSaved()
  }

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const addBlock = async (type: BlockType) => {
    const maxOrder = blocks.length > 0 ? Math.max(...blocks.map(b => b.order_index)) + 1 : 0
    const { data } = await supabase.from('template_blocks').insert({
      template_id: templateId, type,
      label: BLOCK_META[type].label,
      instructions: '',
      is_required: false, is_visible: true,
      order_index: maxOrder, config: {},
    }).select().single()
    if (data) {
      setBlocks(prev => [...prev, data])
      setEditBlock(data.id)
    }
  }

  const updateBlock = async (id: string, updates: Partial<TemplateBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
    await supabase.from('template_blocks').update(updates).eq('id', id)
    showSaved()
  }

  const deleteBlock = async (id: string) => {
    if (!confirm('¿Eliminar este bloque?')) return
    await supabase.from('template_blocks').delete().eq('id', id)
    setBlocks(prev => prev.filter(b => b.id !== id))
    if (editBlock === id) setEditBlock(null)
  }

  const moveBlock = async (id: string, direction: 'up' | 'down') => {
    const idx = blocks.findIndex(b => b.id === id)
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === blocks.length - 1)) return
    const newBlocks = [...blocks]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[idx]]
    const updated = newBlocks.map((b, i) => ({ ...b, order_index: i }))
    setBlocks(updated)
    await Promise.all(updated.map(b => supabase.from('template_blocks').update({ order_index: b.order_index }).eq('id', b.id)))
    showSaved()
  }

  // ─── Drag & Drop ─────────────────────────────────────────────────
  const onDragStart = (id: string) => setDragging(id)
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOver(id) }
  const onDrop = async (targetId: string) => {
    if (!dragging || dragging === targetId) { setDragging(null); setDragOver(null); return }
    const fromIdx = blocks.findIndex(b => b.id === dragging)
    const toIdx   = blocks.findIndex(b => b.id === targetId)
    const newBlocks = [...blocks]
    const [moved] = newBlocks.splice(fromIdx, 1)
    newBlocks.splice(toIdx, 0, moved)
    const updated = newBlocks.map((b, i) => ({ ...b, order_index: i }))
    setBlocks(updated)
    setDragging(null); setDragOver(null)
    await Promise.all(updated.map(b => supabase.from('template_blocks').update({ order_index: b.order_index }).eq('id', b.id)))
    showSaved()
  }

  if (!template) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">🧩</div>
          <p>Cargando plantilla...</p>
        </div>
      </main>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Link href="/admin" className="hover:text-blue-600">Admin</Link> ›
            <Link href="/admin/plantillas" className="hover:text-blue-600">Plantillas</Link> ›
            <span className="text-gray-600 truncate max-w-xs">{template.name}</span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {editName ? (
                <div className="space-y-2">
                  <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
                    className="w-full text-2xl font-bold text-blue-900 border-b-2 border-blue-400 bg-transparent outline-none pb-1"
                    placeholder="Nombre de la plantilla" />
                  <input value={desc} onChange={e => setDesc(e.target.value)}
                    className="w-full text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Descripción breve..." />
                  <div className="flex gap-2">
                    <button onClick={saveNameDesc} disabled={saving}
                      className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                      {saving ? 'Guardando...' : '✅ Guardar'}
                    </button>
                    <button onClick={() => setEditName(false)}
                      className="text-gray-400 text-sm px-3 py-1.5 hover:bg-gray-100 rounded-lg">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 group">
                  <h1 className="text-2xl font-bold text-blue-900 truncate">{template.name}</h1>
                  <button onClick={() => { setEditName(true); setTimeout(() => nameRef.current?.focus(), 50) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-all text-sm">
                    ✏️
                  </button>
                </div>
              )}
              {!editName && template.description && (
                <p className="text-sm text-gray-400 mt-1">{template.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  ✅ Guardado
                </span>
              )}
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                template.type === 'proyecto'   ? 'bg-blue-100 text-blue-700' :
                template.type === 'portafolio' ? 'bg-violet-100 text-violet-700' :
                                                  'bg-green-100 text-green-700'
              }`}>
                {template.type === 'proyecto' ? '🗂️ Proyecto' :
                 template.type === 'portafolio' ? '📋 Portafolio' : '📎 Evidencia'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

          {/* ── Panel izquierdo: agregar bloques ─────────────────────── */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4 sticky top-8">
              <h3 className="font-bold text-gray-700 text-sm mb-3">➕ Agregar bloque</h3>
              <div className="space-y-1.5">
                {BLOCK_TYPES.map(type => {
                  const m = BLOCK_META[type]
                  const c = BLOCK_COLORS[m.color]
                  return (
                    <button key={type} onClick={() => addBlock(type)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors border ${c.border} ${c.bg} hover:opacity-90`}>
                      <span className="text-base flex-shrink-0">{m.icon}</span>
                      <div>
                        <div className={`font-semibold ${c.text}`}>{m.label}</div>
                        <div className="text-gray-400 text-xs leading-tight">{m.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center">
                  Arrastra bloques para reordenarlos
                </p>
              </div>
            </div>
          </div>

          {/* ── Panel derecho: lista de bloques ──────────────────────── */}
          <div className="xl:col-span-3 space-y-2">
            {blocks.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center border-2 border-dashed border-gray-200">
                <div className="text-4xl mb-3">🧱</div>
                <p className="text-gray-400 text-sm">Esta plantilla no tiene bloques aún.</p>
                <p className="text-gray-300 text-xs mt-1">Agrega bloques desde el panel izquierdo.</p>
              </div>
            ) : (
              blocks.map((block, idx) => {
                const m = BLOCK_META[block.type]
                const c = BLOCK_COLORS[m.color]
                const isEditing = editBlock === block.id
                const isDragTarget = dragOver === block.id

                return (
                  <div key={block.id}
                    draggable
                    onDragStart={() => onDragStart(block.id)}
                    onDragOver={e => onDragOver(e, block.id)}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => onDrop(block.id)}
                    className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all cursor-grab active:cursor-grabbing ${
                      isDragTarget  ? 'border-blue-400 shadow-md scale-[1.01]' :
                      dragging === block.id ? 'opacity-40 border-dashed border-gray-300' :
                      isEditing     ? 'border-blue-300' : `${c.border} hover:border-blue-200`
                    }`}>
                    {/* Cabecera del bloque */}
                    <div
                      className={`flex items-center gap-3 px-4 py-3 ${c.bg} border-b ${c.border}`}
                      onClick={() => setEditBlock(isEditing ? null : block.id)}
                    >
                      <span className="text-gray-300 cursor-grab text-sm">⠿</span>
                      <span className="text-lg">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${c.text} uppercase tracking-wide`}>
                            {m.label}
                          </span>
                          {block.is_required && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
                              Obligatorio
                            </span>
                          )}
                          {!block.is_visible && (
                            <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
                              Oculto
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-800 truncate">{block.label}</p>
                      </div>
                      {/* Acciones */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => moveBlock(block.id, 'up')} disabled={idx === 0}
                          className="text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded disabled:opacity-20">↑</button>
                        <button onClick={() => moveBlock(block.id, 'down')} disabled={idx === blocks.length - 1}
                          className="text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded disabled:opacity-20">↓</button>
                        <button onClick={() => setEditBlock(isEditing ? null : block.id)}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${isEditing ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                          {isEditing ? '▲ Cerrar' : '▼ Editar'}
                        </button>
                        <button onClick={() => deleteBlock(block.id)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 w-7 h-7 flex items-center justify-center rounded-lg transition-colors text-xs">
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Formulario de edición del bloque */}
                    {isEditing && (
                      <div className="p-4 space-y-3" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Etiqueta visible *
                            </label>
                            <input value={block.label}
                              onChange={e => updateBlock(block.id, { label: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="Ej: Descripción del problema" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Instrucciones para el alumno
                            </label>
                            <input value={block.instructions ?? ''}
                              onChange={e => updateBlock(block.id, { instructions: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="Ej: Describe con al menos 3 líneas..." />
                          </div>
                        </div>
                        <div className="flex items-center gap-5 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div onClick={() => updateBlock(block.id, { is_required: !block.is_required })}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                block.is_required ? 'bg-red-500 border-red-500' : 'border-gray-300 hover:border-red-300'
                              }`}>
                              {block.is_required && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <span className="text-sm text-gray-600">Bloque obligatorio</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div onClick={() => updateBlock(block.id, { is_visible: !block.is_visible })}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                block.is_visible ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-300'
                              }`}>
                              {block.is_visible && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <span className="text-sm text-gray-600">Visible para alumnos</span>
                          </label>
                        </div>

                        {/* Config específica por tipo */}
                        {block.type === 'checklist' && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Ítems del checklist (uno por línea)
                            </label>
                            <textarea
                              value={(block.config?.items ?? []).join('\n')}
                              onChange={e => updateBlock(block.id, {
                                config: { ...block.config, items: e.target.value.split('\n').filter(Boolean) }
                              })}
                              rows={4}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder={"Pensamiento crítico\nTrabajo colaborativo\nUso de tecnología"} />
                          </div>
                        )}
                        {block.type === 'tabla' && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Cabeceras de columnas (separadas por coma)
                            </label>
                            <input
                              value={(block.config?.headers ?? []).join(', ')}
                              onChange={e => updateBlock(block.id, {
                                config: { ...block.config, headers: e.target.value.split(',').map(h => h.trim()) }
                              })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="Columna 1, Columna 2, Columna 3" />
                          </div>
                        )}
                        {block.type === 'sesion' && (
                          <div className="bg-teal-50 rounded-lg p-3 text-xs text-teal-700 border border-teal-100">
                            📅 Este bloque generará un formulario completo de sesión con: título, objetivo, actividad, evidencia, reflexión, IA utilizada, tiempo y autoevaluación.
                          </div>
                        )}
                        {block.type === 'comentario_docente' && (
                          <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700 border border-amber-100">
                            👨‍🏫 Solo docentes y admin pueden editar este bloque. Los alumnos solo pueden leerlo.
                          </div>
                        )}
                        {block.type === 'bloque_ia' && (
                          <div className="bg-purple-50 rounded-lg p-3 text-xs text-purple-700 border border-purple-100">
                            🤖 Este bloque pedirá: herramienta usada, cómo se usó, cómo se verificó y reflexión ética.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Resumen */}
            {blocks.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mt-2">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>🧱 {blocks.length} bloques en total</span>
                  <span>⚠️ {blocks.filter(b => b.is_required).length} obligatorios</span>
                  <span>👁️ {blocks.filter(b => !b.is_visible).length} ocultos</span>
                  <Link href="/admin/plantillas"
                    className="text-blue-600 hover:underline font-medium">
                    ← Volver a plantillas
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
