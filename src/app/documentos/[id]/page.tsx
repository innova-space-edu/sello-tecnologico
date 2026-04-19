'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  BLOCK_META, BLOCK_COLORS, defaultBlockContent,
  type Document, type TemplateBlock, type BlockValue, type PresenceEntry, type BlockHistoryEntry
} from '@/lib/templates'

// ─── Subcomponentes de bloques ────────────────────────────────────────────────

function BlockTexto({ value, onChange, readOnly, placeholder }: any) {
  return (
    <textarea value={value?.text ?? ''} readOnly={readOnly}
      onChange={e => onChange({ text: e.target.value })}
      rows={4} placeholder={placeholder ?? 'Escribe aquí...'}
      className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
  )
}

function BlockTitulo({ value, onChange, readOnly }: any) {
  return (
    <input value={value?.text ?? ''} readOnly={readOnly}
      onChange={e => onChange({ text: e.target.value })}
      placeholder="Escribe el título..."
      className="w-full border-b-2 border-blue-200 bg-transparent text-xl font-bold text-blue-900 py-2 focus:outline-none focus:border-blue-500" />
  )
}

function BlockLink({ value, onChange, readOnly }: any) {
  return (
    <div className="space-y-2">
      <input value={value?.label ?? ''} readOnly={readOnly}
        onChange={e => onChange({ ...value, label: e.target.value })}
        placeholder="Texto del enlace"
        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      <input value={value?.url ?? ''} readOnly={readOnly}
        onChange={e => onChange({ ...value, url: e.target.value })}
        placeholder="https://..."
        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      {value?.url && (
        <a href={value.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-blue-600 hover:underline text-sm">
          🔗 {value.label || value.url}
        </a>
      )}
    </div>
  )
}

function BlockChecklist({ value, onChange, readOnly, config }: any) {
  const configItems: string[] = config?.items ?? []
  const checked: string[] = value?.checked ?? []
  const customItems: string[] = value?.custom ?? []

  const toggle = (item: string) => {
    if (readOnly) return
    const next = checked.includes(item) ? checked.filter(c => c !== item) : [...checked, item]
    onChange({ ...value, checked: next })
  }
  const addCustom = () => onChange({ ...value, custom: [...customItems, ''] })
  const updateCustom = (i: number, v: string) => {
    const n = [...customItems]; n[i] = v; onChange({ ...value, custom: n })
  }
  const items = configItems.length > 0 ? configItems : customItems

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <label key={i} className={`flex items-center gap-3 cursor-pointer group ${readOnly ? '' : 'hover:bg-green-50'} p-2 rounded-lg`}>
          <div onClick={() => toggle(item)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
              checked.includes(item) ? 'bg-green-500 border-green-500' : 'border-gray-300 group-hover:border-green-300'
            }`}>
            {checked.includes(item) && <span className="text-white text-xs font-bold">✓</span>}
          </div>
          {configItems.length === 0 ? (
            <input value={item} readOnly={readOnly}
              onChange={e => updateCustom(i, e.target.value)}
              className="flex-1 text-sm text-gray-700 bg-transparent border-none outline-none" />
          ) : (
            <span className={`text-sm ${checked.includes(item) ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item}</span>
          )}
        </label>
      ))}
      {!readOnly && configItems.length === 0 && (
        <button onClick={addCustom}
          className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
          + Agregar ítem
        </button>
      )}
    </div>
  )
}

function BlockSesion({ value, onChange, readOnly }: any) {
  const v = value ?? {}
  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...v, [field]: e.target.value })
  const cls = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
  const area = `${cls} resize-none`
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Título de la sesión</label>
        <input value={v.titulo ?? ''} readOnly={readOnly} onChange={f('titulo')} className={cls} placeholder="Ej: Sesión 1 — Investigación inicial" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Objetivo</label>
        <textarea value={v.objetivo ?? ''} readOnly={readOnly} onChange={f('objetivo')} rows={2} className={area} placeholder="¿Qué esperaban lograr?" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Actividades realizadas</label>
        <textarea value={v.actividad ?? ''} readOnly={readOnly} onChange={f('actividad')} rows={2} className={area} placeholder="¿Qué hicieron en esta sesión?" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Evidencia generada</label>
        <input value={v.evidencia ?? ''} readOnly={readOnly} onChange={f('evidencia')} className={cls} placeholder="Descripción o enlace de la evidencia" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">IA utilizada</label>
        <input value={v.ia_utilizada ?? ''} readOnly={readOnly} onChange={f('ia_utilizada')} className={cls} placeholder="ChatGPT, Gemini, Canva AI... o 'No se usó'" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Tiempo trabajado (minutos)</label>
        <input type="number" value={v.tiempo_minutos ?? ''} readOnly={readOnly} onChange={f('tiempo_minutos')} className={cls} placeholder="Ej: 90" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Dificultad percibida (1-5)</label>
        <select value={v.dificultad ?? '3'} disabled={readOnly} onChange={f('dificultad')} className={cls}>
          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {['Muy fácil','Fácil','Moderada','Difícil','Muy difícil'][n-1]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Reflexión de la sesión</label>
        <textarea value={v.reflexion ?? ''} readOnly={readOnly} onChange={f('reflexion')} rows={3} className={area} placeholder="¿Qué aprendieron? ¿Qué cambiarían?" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Autoevaluación</label>
        <textarea value={v.autoevaluacion ?? ''} readOnly={readOnly} onChange={f('autoevaluacion')} rows={2} className={area} placeholder="¿Cómo evaluarías tu trabajo en esta sesión?" />
      </div>
    </div>
  )
}

function BlockIA({ value, onChange, readOnly }: any) {
  const v = value ?? {}
  const f = (field: string) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
    onChange({ ...v, [field]: e.target.value })
  const area = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Herramienta de IA usada</label>
        <input value={v.herramienta ?? ''} readOnly={readOnly} onChange={f('herramienta')}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          placeholder="ChatGPT, Gemini, Copilot..." />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">¿Cómo se usó?</label>
        <textarea value={v.como_uso ?? ''} readOnly={readOnly} onChange={f('como_uso')} rows={2} className={area} placeholder="Para generar ideas, revisar textos..." />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">¿Cómo verificaron la información?</label>
        <textarea value={v.verificacion ?? ''} readOnly={readOnly} onChange={f('verificacion')} rows={2} className={area} placeholder="Buscamos en fuentes oficiales, comparamos con..." />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Reflexión ética sobre el uso de IA</label>
        <textarea value={v.etica ?? ''} readOnly={readOnly} onChange={f('etica')} rows={2} className={area} placeholder="¿Qué criterios éticos aplicamos?" />
      </div>
    </div>
  )
}

function BlockComentarioDocente({ value, onChange, isDocente }: any) {
  const v = value ?? {}
  if (!isDocente && !v.texto) return (
    <div className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
      ⏳ El docente aún no ha agregado retroalimentación en este bloque.
    </div>
  )
  if (!isDocente) return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-600 font-semibold text-sm">👨‍🏫 Retroalimentación del docente</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          v.estado === 'aprobado' ? 'bg-green-100 text-green-700' :
          v.estado === 'revisar'  ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
        }`}>{v.estado === 'aprobado' ? '✅ Aprobado' : v.estado === 'revisar' ? '🔄 A revisar' : '⏳ Pendiente'}</span>
      </div>
      <p className="text-sm text-gray-700">{v.texto}</p>
    </div>
  )
  return (
    <div className="space-y-2">
      <select value={v.estado ?? 'pendiente'} onChange={e => onChange({ ...v, estado: e.target.value })}
        className="border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
        <option value="pendiente">⏳ Sin revisar</option>
        <option value="revisado">👁️ Revisado</option>
        <option value="revisar">🔄 Necesita revisión</option>
        <option value="aprobado">✅ Aprobado</option>
      </select>
      <textarea value={v.texto ?? ''} onChange={e => onChange({ ...v, texto: e.target.value })} rows={3}
        placeholder="Escribe tu retroalimentación para el estudiante..."
        className="w-full border border-amber-200 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50" />
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DocumentoPage() {
  const supabase    = createClient()
  const router      = useRouter()
  const params      = useParams()
  const documentId  = params.id as string

  const [doc, setDoc]           = useState<Document | null>(null)
  const [blocks, setBlocks]     = useState<TemplateBlock[]>([])
  const [values, setValues]     = useState<Record<string, BlockValue>>({})
  const [presence, setPresence] = useState<PresenceEntry[]>([])
  const [history, setHistory]   = useState<BlockHistoryEntry[]>([])
  const [userId, setUserId]     = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [savingBlocks, setSavingBlocks] = useState<Record<string, boolean>>({})
  const [savedBlocks, setSavedBlocks]   = useState<Record<string, boolean>>({})
  const [showHistory, setShowHistory]   = useState(false)
  const [loading, setLoading]           = useState(true)
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({})

  const isDocente = ['admin','docente','coordinador'].includes(userRole)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      setUserId(user.id)
      setUserName(p?.full_name ?? 'Anónimo')
      setUserRole(p?.role ?? 'estudiante')
      await fetchDocument(user.id)
      setLoading(false)
    }
    init()
    return () => { Object.values(saveTimers.current).forEach(clearTimeout) }
  }, [documentId])

  // Realtime: cambios en block_values
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`doc-${documentId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'block_values',
        filter: `document_id=eq.${documentId}`
      }, payload => {
        const bv = payload.new as BlockValue
        if (!bv || bv.edited_by === userId) return
        setValues(prev => ({ ...prev, [bv.block_id]: bv }))
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'document_presence',
        filter: `document_id=eq.${documentId}`
      }, () => fetchPresence())
      .subscribe()

    // Limpiar presencia al salir
    return () => {
      supabase.removeChannel(channel)
      supabase.from('document_presence').delete()
        .eq('document_id', documentId).eq('user_id', userId).then(() => {})
    }
  }, [userId, documentId])

  // Mantener presencia activa
  useEffect(() => {
    if (!userId || !userName) return
    const upsertPresence = (blockId?: string, blockLabel?: string) => {
      supabase.from('document_presence').upsert({
        document_id: documentId, user_id: userId,
        user_name: userName,
        block_id: blockId ?? null, block_label: blockLabel ?? null,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'document_id,user_id' }).then(() => {})
    }
    upsertPresence()
    const interval = setInterval(() => upsertPresence(activeBlock ?? undefined), 15000)
    return () => clearInterval(interval)
  }, [userId, userName, activeBlock, documentId])

  const fetchDocument = async (uid: string) => {
    const { data: d } = await supabase.from('documents').select('*, templates(*, template_blocks(*))').eq('id', documentId).single()
    if (!d) { router.push('/dashboard'); return }
    setDoc(d)
    const sorted = (d.templates?.template_blocks ?? []).sort((a: any, b: any) => a.order_index - b.order_index)
    setBlocks(sorted)
    const { data: bv } = await supabase.from('block_values').select('*, profiles(full_name)').eq('document_id', documentId)
    const map: Record<string, BlockValue> = {}
    for (const v of (bv ?? [])) map[v.block_id] = v
    setValues(map)
    fetchPresence()
  }

  const fetchPresence = async () => {
    const cutoff = new Date(Date.now() - 30000).toISOString()
    const { data } = await supabase.from('document_presence')
      .select('*').eq('document_id', documentId).gte('last_seen', cutoff)
    setPresence(data ?? [])
  }

  const fetchHistory = async () => {
    const { data } = await supabase.from('block_history')
      .select('*').eq('document_id', documentId).order('edited_at', { ascending: false }).limit(50)
    setHistory(data ?? [])
  }

  const onBlockChange = useCallback((blockId: string, blockLabel: string, content: Record<string, any>) => {
    // Optimistic update
    setValues(prev => ({
      ...prev,
      [blockId]: { ...(prev[blockId] ?? { id:'', document_id: documentId, block_id: blockId, created_at: '', edited_at: '' }), content, edited_by: userId, edited_at: new Date().toISOString() },
    }))

    // Actualizar presencia
    supabase.from('document_presence').upsert({
      document_id: documentId, user_id: userId, user_name: userName,
      block_id: blockId, block_label: blockLabel, last_seen: new Date().toISOString(),
    }, { onConflict: 'document_id,user_id' }).then(() => {})

    // Debounce save
    if (saveTimers.current[blockId]) clearTimeout(saveTimers.current[blockId])
    setSavingBlocks(prev => ({ ...prev, [blockId]: true }))
    saveTimers.current[blockId] = setTimeout(() => saveBlock(blockId, blockLabel, content), 1500)
  }, [userId, userName, documentId])

  const saveBlock = async (blockId: string, blockLabel: string, content: Record<string, any>) => {
    const previous = values[blockId]?.content ?? null
    const { data: existing } = await supabase.from('block_values')
      .select('id').eq('document_id', documentId).eq('block_id', blockId).single()

    if (existing?.id) {
      await supabase.from('block_values').update({
        content, edited_by: userId, edited_at: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      await supabase.from('block_values').insert({
        document_id: documentId, block_id: blockId, content,
        edited_by: userId, edited_at: new Date().toISOString()
      })
    }

    // Guardar historial
    await supabase.from('block_history').insert({
      document_id: documentId, block_id: blockId, block_label: blockLabel,
      previous_content: previous, new_content: content,
      edited_by: userId, edited_by_name: userName, edited_at: new Date().toISOString()
    })

    // Actualizar timestamp del documento
    await supabase.from('documents').update({ updated_at: new Date().toISOString() }).eq('id', documentId)

    setSavingBlocks(prev => ({ ...prev, [blockId]: false }))
    setSavedBlocks(prev => ({ ...prev, [blockId]: true }))
    setTimeout(() => setSavedBlocks(prev => ({ ...prev, [blockId]: false })), 2000)
  }

  const renderBlock = (block: TemplateBlock) => {
    const content = values[block.id]?.content ?? defaultBlockContent(block.type)
    const onChange = (c: Record<string, any>) => onBlockChange(block.id, block.label, c)
    const readOnly = block.type === 'comentario_docente' && !isDocente
    const blockPresence = presence.filter(p => p.block_id === block.id && p.user_id !== userId)

    const m = BLOCK_META[block.type]
    const c = BLOCK_COLORS[m.color]
    const isActive = activeBlock === block.id
    const isSaving = savingBlocks[block.id]
    const isSaved  = savedBlocks[block.id]

    if (block.type === 'separador') return (
      <div key={block.id} className="py-2">
        <hr className="border-gray-200" />
      </div>
    )

    return (
      <div key={block.id}
        className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${
          isActive ? `border-blue-400 shadow-md` : `${c.border} hover:border-blue-200`
        }`}
        onClick={() => setActiveBlock(block.id)}>

        {/* Header bloque */}
        <div className={`flex items-center gap-3 px-4 py-2.5 ${c.bg} border-b ${c.border}`}>
          <span className="text-base">{m.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800">{block.label}</span>
              {block.is_required && <span className="text-xs text-red-500 font-medium">*</span>}
            </div>
            {block.instructions && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{block.instructions}</p>
            )}
          </div>
          {/* Presencia en este bloque */}
          {blockPresence.length > 0 && (
            <div className="flex items-center gap-1">
              {blockPresence.slice(0, 3).map(p => (
                <span key={p.user_id} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                  ✏️ {p.user_name?.split(' ')[0] ?? 'Alguien'}
                </span>
              ))}
            </div>
          )}
          {/* Estado de guardado */}
          {isSaving && <span className="text-xs text-yellow-600 flex-shrink-0">💾 Guardando...</span>}
          {isSaved  && <span className="text-xs text-green-600 flex-shrink-0">✅ Guardado</span>}
          {values[block.id]?.profiles?.full_name && !isSaving && !isSaved && (
            <span className="text-xs text-gray-300 flex-shrink-0">
              {values[block.id].profiles!.full_name.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Contenido del bloque */}
        <div className="p-4">
          {block.type === 'titulo'             && <BlockTitulo value={content} onChange={onChange} readOnly={readOnly} />}
          {block.type === 'subtitulo'          && <BlockTitulo value={content} onChange={onChange} readOnly={readOnly} />}
          {block.type === 'texto'              && <BlockTexto  value={content} onChange={onChange} readOnly={readOnly} placeholder={block.instructions} />}
          {block.type === 'link'               && <BlockLink   value={content} onChange={onChange} readOnly={readOnly} />}
          {block.type === 'checklist'          && <BlockChecklist value={content} onChange={onChange} readOnly={readOnly} config={block.config} />}
          {block.type === 'sesion'             && <BlockSesion value={content} onChange={onChange} readOnly={readOnly} />}
          {block.type === 'bloque_ia'          && <BlockIA     value={content} onChange={onChange} readOnly={readOnly} />}
          {block.type === 'comentario_docente' && <BlockComentarioDocente value={content} onChange={onChange} isDocente={isDocente} />}
          {block.type === 'imagen' && (
            <div className="space-y-2">
              <input value={content.url ?? ''} readOnly={readOnly}
                onChange={e => onChange({ ...content, url: e.target.value })}
                placeholder="URL de la imagen (Drive, Imgur, etc.)"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
              {content.url && (
                <img src={content.url} alt={content.alt ?? ''} className="max-h-48 rounded-lg object-contain border border-gray-100" onError={e => (e.currentTarget.style.display = 'none')} />
              )}
              <input value={content.caption ?? ''} readOnly={readOnly}
                onChange={e => onChange({ ...content, caption: e.target.value })}
                placeholder="Descripción de la imagen"
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-pink-200 text-gray-500" />
            </div>
          )}
          {block.type === 'archivo' && (
            <div className="space-y-2">
              <input value={content.url ?? ''} readOnly={readOnly}
                onChange={e => onChange({ ...content, url: e.target.value })}
                placeholder="URL del archivo (Drive, Dropbox, etc.)"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              <input value={content.name ?? ''} readOnly={readOnly}
                onChange={e => onChange({ ...content, name: e.target.value })}
                placeholder="Nombre descriptivo del archivo"
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-200" />
              {content.url && (
                <a href={content.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-orange-600 hover:underline text-sm">
                  📎 {content.name || 'Descargar archivo'}
                </a>
              )}
            </div>
          )}
          {block.type === 'tabla' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>{(block.config?.headers ?? ['Col 1','Col 2']).map((h: string, i: number) => (
                    <th key={i} className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(content.rows ?? [['']]).map((row: string[], ri: number) => (
                    <tr key={ri}>
                      {row.map((cell: string, ci: number) => (
                        <td key={ci} className="border border-gray-200 px-2 py-1">
                          <input value={cell} readOnly={readOnly}
                            onChange={e => {
                              const rows = [...(content.rows ?? [['']])]
                              rows[ri] = [...rows[ri]]; rows[ri][ci] = e.target.value
                              onChange({ ...content, rows })
                            }}
                            className="w-full text-sm bg-transparent outline-none focus:bg-blue-50 px-1 py-0.5 rounded" />
                        </td>
                      ))}
                      {!readOnly && (
                        <td className="border border-gray-100 px-1">
                          <button onClick={() => onChange({ ...content, rows: (content.rows ?? []).filter((_: any, i: number) => i !== ri) })}
                            className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!readOnly && (
                <button onClick={() => onChange({ ...content, rows: [...(content.rows ?? []), (block.config?.headers ?? ['','']).map(() => '')] })}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">+ Agregar fila</button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading || !doc) return (
    <div className="flex min-h-screen bg-gray-50"><Sidebar />
      <main className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400"><div className="text-4xl mb-3 animate-pulse">📄</div><p>Cargando documento...</p></div>
      </main>
    </div>
  )

  const otrosEditando = presence.filter(p => p.user_id !== userId)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              {doc.project_id && <Link href={`/proyectos/${doc.project_id}`} className="hover:text-blue-600">← Proyecto</Link>}
            </div>
            <h1 className="text-2xl font-bold text-blue-900">{doc.title}</h1>
            <p className="text-gray-400 text-sm mt-1">
              Plantilla: {(doc as any).templates?.name ?? '—'} · Actualizado: {new Date(doc.updated_at).toLocaleString('es-CL')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Presencia en vivo */}
            {otrosEditando.length > 0 && (
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs text-green-700 font-medium">
                  {otrosEditando.map(p => p.user_name?.split(' ')[0]).join(', ')} editando
                </span>
              </div>
            )}
            <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory() }}
              className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
              📋 Historial
            </button>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              doc.status === 'aprobado'   ? 'bg-green-100 text-green-700' :
              doc.status === 'en_progreso'? 'bg-blue-100 text-blue-700' :
              doc.status === 'revisión'   ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-600'
            }`}>{doc.status}</span>
          </div>
        </div>

        {/* Panel de historial */}
        {showHistory && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <h3 className="font-bold text-gray-700 text-sm mb-3">📋 Historial de cambios (últimos 50)</h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">Sin cambios registrados aún.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="flex items-start gap-3 text-xs border-b border-gray-50 pb-2">
                    <span className="text-gray-300 flex-shrink-0">
                      {new Date(h.edited_at).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </span>
                    <span className="font-medium text-blue-700 flex-shrink-0">{h.edited_by_name ?? 'Alguien'}</span>
                    <span className="text-gray-500">editó <span className="font-medium text-gray-700">{h.block_label ?? 'un bloque'}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bloques del documento */}
        <div className="space-y-3 max-w-3xl">
          {blocks.filter(b => b.is_visible || isDocente).map(block => renderBlock(block))}

          {blocks.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="text-4xl mb-3">🧱</div>
              <p className="text-gray-400">Esta plantilla no tiene bloques configurados.</p>
              {isDocente && (
                <Link href="/admin/plantillas" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                  Configurar plantilla →
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
