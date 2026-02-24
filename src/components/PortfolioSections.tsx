'use client'
import { createClient } from '@/lib/supabase'
import { useState, useRef } from 'react'

type SectionType = 'texto' | 'alternativas' | 'imagen'

interface Section {
  id: string
  title: string
  type: SectionType
  content?: string
  options?: string[]
  selected_option?: string
  file_url?: string
  file_name?: string
  file_type?: string
  order_index: number
}

export default function PortfolioSections({
  portfolioId,
  initialSections = [],
  editable = true,
}: {
  portfolioId: string
  initialSections?: Section[]
  editable?: boolean
}) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [adding, setAdding] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [newSection, setNewSection] = useState({ title: '', type: 'texto' as SectionType })
  const [activeImageSection, setActiveImageSection] = useState<string | null>(null)

  // Agregar sección nueva
  const handleAddSection = async () => {
    if (!newSection.title.trim()) return
    const order = sections.length

    const { data, error } = await supabase.from('portfolio_sections').insert({
      portfolio_id: portfolioId,
      title: newSection.title,
      type: newSection.type,
      options: newSection.type === 'alternativas' ? ['Opción 1', 'Opción 2', 'Opción 3'] : null,
      order_index: order,
    }).select().single()

    if (!error && data) {
      setSections(prev => [...prev, {
        ...data,
        options: data.options ?? (newSection.type === 'alternativas' ? ['Opción 1', 'Opción 2', 'Opción 3'] : undefined),
      }])
      setNewSection({ title: '', type: 'texto' })
      setAdding(false)
    }
  }

  // Guardar contenido de sección
  const handleSaveSection = async (section: Section) => {
    setSavingId(section.id)
    await supabase.from('portfolio_sections').update({
      title: section.title,
      content: section.content,
      options: section.options,
      selected_option: section.selected_option,
    }).eq('id', section.id)
    setSavingId(null)
  }

  // Eliminar sección
  const handleDeleteSection = async (id: string) => {
    if (!confirm('¿Eliminar esta sección?')) return
    await supabase.from('portfolio_sections').delete().eq('id', id)
    setSections(prev => prev.filter(s => s.id !== id))
  }

  // Subir imagen
  const handleImageUpload = async (sectionId: string, file: File) => {
    setUploadingId(sectionId)
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()
    const path = `${user?.id}/portfolio/${sectionId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('evidencias')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Error al subir imagen: ' + uploadError.message)
      setUploadingId(null)
      return
    }

    const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(path)
    const file_url = urlData.publicUrl

    await supabase.from('portfolio_sections').update({
      file_url,
      file_name: file.name,
      file_type: file.type,
    }).eq('id', sectionId)

    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, file_url, file_name: file.name, file_type: file.type }
      : s
    ))
    setUploadingId(null)
    setActiveImageSection(null)
  }

  // Mover sección arriba/abajo
  const moveSection = async (index: number, dir: 'up' | 'down') => {
    const newSections = [...sections]
    const targetIndex = dir === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newSections.length) return
    ;[newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]]

    // Actualizar order_index en DB
    await supabase.from('portfolio_sections').update({ order_index: targetIndex }).eq('id', newSections[targetIndex].id)
    await supabase.from('portfolio_sections').update({ order_index: index }).eq('id', newSections[index].id)

    setSections(newSections)
  }

  // Actualizar opción de alternativas
  const updateOption = (sectionId: string, optIdx: number, value: string) => {
    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, options: s.options?.map((o, i) => i === optIdx ? value : o) }
      : s
    ))
  }

  const addOption = (sectionId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, options: [...(s.options ?? []), `Opción ${(s.options?.length ?? 0) + 1}`] }
      : s
    ))
  }

  const removeOption = (sectionId: string, optIdx: number) => {
    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, options: s.options?.filter((_, i) => i !== optIdx) }
      : s
    ))
  }

  const typeIcon: Record<SectionType, string> = {
    texto: '📝',
    alternativas: '☑️',
    imagen: '🖼️',
  }

  const typeLabel: Record<SectionType, string> = {
    texto: 'Texto libre',
    alternativas: 'Alternativas',
    imagen: 'Imagen',
  }

  return (
    <div className="space-y-4">

      {/* Secciones existentes */}
      {sections.map((section, index) => (
        <div key={section.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">

          {/* Header de la sección */}
          <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
            <span className="text-lg">{typeIcon[section.type]}</span>

            {editable ? (
              <input
                value={section.title}
                onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                className="flex-1 bg-transparent font-semibold text-blue-900 text-sm focus:outline-none border-b border-dashed border-gray-300 focus:border-blue-400"
              />
            ) : (
              <p className="flex-1 font-semibold text-blue-900 text-sm">{section.title}</p>
            )}

            <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
              {typeLabel[section.type]}
            </span>

            {editable && (
              <div className="flex items-center gap-1">
                <button onClick={() => moveSection(index, 'up')} disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs">▲</button>
                <button onClick={() => moveSection(index, 'down')} disabled={index === sections.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs">▼</button>
                <button onClick={() => handleDeleteSection(section.id)}
                  className="p-1 text-red-300 hover:text-red-500 text-xs ml-1">🗑️</button>
              </div>
            )}
          </div>

          {/* Contenido según tipo */}
          <div className="p-5">

            {/* TEXTO */}
            {section.type === 'texto' && (
              editable ? (
                <textarea
                  value={section.content ?? ''}
                  onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, content: e.target.value } : s))}
                  rows={4}
                  placeholder="Escribe aquí tu respuesta..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4">
                  {section.content ?? <span className="text-gray-400 italic">Sin respuesta</span>}
                </p>
              )
            )}

            {/* ALTERNATIVAS */}
            {section.type === 'alternativas' && (
              <div className="space-y-2">
                {section.options?.map((opt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {/* Marcar selección */}
                    <button
                      onClick={() => {
                        if (!editable) return
                        setSections(prev => prev.map(s => s.id === section.id
                          ? { ...s, selected_option: s.selected_option === opt ? undefined : opt }
                          : s
                        ))
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        section.selected_option === opt
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300 hover:border-blue-400'
                      }`}>
                      {section.selected_option === opt && <span className="text-white text-xs">✓</span>}
                    </button>

                    {editable ? (
                      <input
                        value={opt}
                        onChange={e => updateOption(section.id, i, e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <span className={`text-sm ${section.selected_option === opt ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
                        {opt}
                      </span>
                    )}

                    {editable && (
                      <button onClick={() => removeOption(section.id, i)}
                        className="text-red-300 hover:text-red-500 text-xs shrink-0">✕</button>
                    )}
                  </div>
                ))}

                {editable && (
                  <button onClick={() => addOption(section.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center gap-1">
                    + Agregar opción
                  </button>
                )}
              </div>
            )}

            {/* IMAGEN */}
            {section.type === 'imagen' && (
              <div>
                {section.file_url ? (
                  <div>
                    <img src={section.file_url} alt={section.title}
                      className="w-full max-h-64 object-contain rounded-lg bg-gray-50 border border-gray-100" />
                    <p className="text-xs text-gray-400 mt-2">{section.file_name}</p>
                    {editable && (
                      <button
                        onClick={() => {
                          setActiveImageSection(section.id)
                          fileRef.current?.click()
                        }}
                        className="mt-2 text-xs text-blue-600 hover:underline">
                        📷 Cambiar imagen
                      </button>
                    )}
                  </div>
                ) : (
                  editable ? (
                    <button
                      onClick={() => {
                        setActiveImageSection(section.id)
                        fileRef.current?.click()
                      }}
                      disabled={uploadingId === section.id}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50">
                      {uploadingId === section.id ? (
                        <p className="text-sm text-blue-600">Subiendo imagen...</p>
                      ) : (
                        <>
                          <div className="text-3xl mb-2">🖼️</div>
                          <p className="text-sm text-gray-500">Clic para subir imagen</p>
                          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP</p>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="w-full border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
                      Sin imagen
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Botón guardar por sección */}
          {editable && (
            <div className="px-5 pb-4 flex justify-end">
              <button
                onClick={() => handleSaveSection(section)}
                disabled={savingId === section.id}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                {savingId === section.id ? 'Guardando...' : '💾 Guardar sección'}
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Input oculto para imágenes */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file && activeImageSection) handleImageUpload(activeImageSection, file)
          e.target.value = ''
        }}
      />

      {/* Formulario agregar sección */}
      {editable && (
        adding ? (
          <div className="bg-white rounded-xl shadow-sm border-2 border-blue-200 p-5">
            <p className="font-semibold text-blue-900 text-sm mb-4">Nueva sección</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Título de la sección</label>
                <input
                  value={newSection.title}
                  onChange={e => setNewSection({...newSection, title: e.target.value})}
                  placeholder="Ej: Mis reflexiones, Herramientas usadas..."
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de sección</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['texto', 'alternativas', 'imagen'] as SectionType[]).map(t => (
                    <button key={t} onClick={() => setNewSection({...newSection, type: t})}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        newSection.type === t
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:border-blue-300'
                      }`}>
                      <span className="text-2xl">{typeIcon[t]}</span>
                      <span className="text-xs font-semibold">{typeLabel[t]}</span>
                      <span className="text-xs text-gray-400">
                        {t === 'texto' ? 'Respuesta libre' : t === 'alternativas' ? 'Selección' : 'Subir foto'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddSection}
                  disabled={!newSection.title.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
                  ✅ Agregar sección
                </button>
                <button onClick={() => { setAdding(false); setNewSection({ title: '', type: 'texto' }) }}
                  className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium">
            + Agregar sección personalizada
          </button>
        )
      )}
    </div>
  )
}
