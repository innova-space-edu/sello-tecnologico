'use client'

import { AUTOEVALUACION_QUESTIONS, AutoevaluacionQuestion, AutoevaluacionQuestionType } from '@/lib/autoevaluacion'
import { useEffect, useMemo, useState } from 'react'

type Props = {
  mode: 'copy' | 'new'
}

type EditableQuestion = AutoevaluacionQuestion & {
  localId: string
}

const questionTypes: { value: AutoevaluacionQuestionType; label: string; hint: string }[] = [
  { value: 'rating', label: 'Escala numérica', hint: 'Ideal para responsabilidad, participación o logro.' },
  { value: 'text', label: 'Respuesta escrita', hint: 'Ideal para reflexión, autocrítica o plan de mejora.' },
  { value: 'checkbox', label: 'Selección múltiple', hint: 'Permite marcar varias evidencias o acciones.' },
  { value: 'single', label: 'Selección única', hint: 'Permite elegir una decisión o nivel principal.' },
]

const defaultOptions = ['Opción 1', 'Opción 2', 'Opción 3']

function makeId(prefix = 'pregunta') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function questionToEditable(question: AutoevaluacionQuestion): EditableQuestion {
  return {
    ...question,
    id: question.id,
    localId: makeId(question.id),
    options: question.options ?? [],
  }
}

function createBlankQuestion(section: string): EditableQuestion {
  return {
    id: makeId('custom'),
    localId: makeId('local'),
    section,
    prompt: 'Nueva pregunta de autoevaluación',
    type: 'text',
    required: false,
    options: [],
    minLabel: 'Por mejorar',
    maxLabel: 'Muy logrado',
  }
}

export default function FormatoAutoevaluacionEditor({ mode }: Props) {
  const storageKey = mode === 'copy' ? 'autoevaluacion_formato_copia' : 'autoevaluacion_formato_nuevo'
  const [title, setTitle] = useState(mode === 'copy' ? 'Copia editable · Autoevaluación STEAM' : 'Nuevo formato de autoevaluación')
  const [description, setDescription] = useState(mode === 'copy'
    ? 'Formato duplicado desde la autoevaluación actual para reutilizarlo o adaptarlo a otra actividad.'
    : 'Crea un formato nuevo para que los estudiantes puedan evaluarse de otra manera.'
  )
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    mode === 'copy' ? AUTOEVALUACION_QUESTIONS.map(questionToEditable) : [
      createBlankQuestion('Autoevaluación personal'),
      {
        ...createBlankQuestion('Autoevaluación personal'),
        id: makeId('responsabilidad'),
        prompt: '¿Cómo evalúas tu responsabilidad en esta actividad?',
        type: 'rating',
        required: true,
      },
      {
        ...createBlankQuestion('Plan de mejora'),
        id: makeId('mejora'),
        prompt: '¿Qué mejorarías en una próxima oportunidad?',
        type: 'text',
        required: true,
      },
    ]
  )
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as { title?: string; description?: string; questions?: EditableQuestion[] }
      if (parsed.title) setTitle(parsed.title)
      if (parsed.description) setDescription(parsed.description)
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) setQuestions(parsed.questions)
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  const sections = useMemo(() => Array.from(new Set(questions.map(question => question.section || 'Sin sección'))), [questions])

  const updateQuestion = (localId: string, updates: Partial<EditableQuestion>) => {
    setQuestions(prev => prev.map(question => question.localId === localId ? { ...question, ...updates } : question))
  }

  const addQuestion = (section: string) => {
    setQuestions(prev => [...prev, createBlankQuestion(section)])
  }

  const duplicateQuestion = (question: EditableQuestion) => {
    setQuestions(prev => [
      ...prev,
      {
        ...question,
        id: makeId('copia'),
        localId: makeId('local'),
        prompt: `${question.prompt} (copia)`,
      },
    ])
  }

  const removeQuestion = (localId: string) => {
    if (!window.confirm('¿Eliminar esta pregunta del formato?')) return
    setQuestions(prev => prev.filter(question => question.localId !== localId))
  }

  const addOption = (localId: string) => {
    const target = questions.find(question => question.localId === localId)
    updateQuestion(localId, { options: [...(target?.options ?? []), `Opción ${(target?.options?.length ?? 0) + 1}`] })
  }

  const updateOption = (localId: string, optionIndex: number, value: string) => {
    const target = questions.find(question => question.localId === localId)
    const nextOptions = [...(target?.options ?? [])]
    nextOptions[optionIndex] = value
    updateQuestion(localId, { options: nextOptions })
  }

  const removeOption = (localId: string, optionIndex: number) => {
    const target = questions.find(question => question.localId === localId)
    updateQuestion(localId, { options: (target?.options ?? []).filter((_, index) => index !== optionIndex) })
  }

  const saveDraft = () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ title, description, questions }))
    setSavedMessage('Formato guardado como borrador en este navegador.')
    window.setTimeout(() => setSavedMessage(''), 3000)
  }

  const resetToOriginal = () => {
    if (!window.confirm('¿Restaurar el formato inicial? Se perderán los cambios no guardados.')) return
    window.localStorage.removeItem(storageKey)
    setTitle(mode === 'copy' ? 'Copia editable · Autoevaluación STEAM' : 'Nuevo formato de autoevaluación')
    setDescription(mode === 'copy'
      ? 'Formato duplicado desde la autoevaluación actual para reutilizarlo o adaptarlo a otra actividad.'
      : 'Crea un formato nuevo para que los estudiantes puedan evaluarse de otra manera.'
    )
    setQuestions(mode === 'copy' ? AUTOEVALUACION_QUESTIONS.map(questionToEditable) : [createBlankQuestion('Autoevaluación personal')])
  }

  const exportJson = () => {
    const payload = JSON.stringify({ title, description, questions }, null, 2)
    navigator.clipboard.writeText(payload)
    setSavedMessage('Formato copiado al portapapeles en JSON para reutilizarlo después.')
    window.setTimeout(() => setSavedMessage(''), 3000)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <section className="bg-white rounded-2xl shadow-sm p-5 lg:p-6 border border-blue-100">
        <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">
          {mode === 'copy' ? 'Editar copia reutilizable' : 'Crear formato nuevo'}
        </p>
        <h1 className="text-2xl font-bold text-blue-900 mt-2">{title}</h1>
        <p className="text-gray-600 mt-2">{description}</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700">Nombre del formato
            <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" />
          </label>
          <label className="text-sm font-medium text-gray-700">Descripción o propósito
            <input value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" />
          </label>
        </div>
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={saveDraft} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold">
            Guardar borrador
          </button>
          <button type="button" onClick={exportJson} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl px-4 py-2.5 text-sm font-semibold">
            Copiar formato JSON
          </button>
          <button type="button" onClick={resetToOriginal} className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-sm font-semibold">
            Restaurar
          </button>
        </div>
        {savedMessage && <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">✅ {savedMessage}</p>}
      </section>

      <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <h2 className="font-bold text-blue-900">Formas de evaluación disponibles</h2>
        <p className="text-sm text-blue-900/70 mt-1">Puedes combinar escala numérica, respuesta escrita, selección múltiple y selección única según la actividad.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          {questionTypes.map(type => (
            <div key={type.value} className="bg-white border border-blue-100 rounded-xl p-3">
              <p className="text-sm font-semibold text-blue-900">{type.label}</p>
              <p className="text-xs text-gray-500 mt-1">{type.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {sections.map(section => (
        <section key={section} className="bg-white rounded-2xl shadow-sm p-5 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="font-bold text-blue-900">{section}</h2>
            <button type="button" onClick={() => addQuestion(section)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl px-4 py-2 text-sm font-semibold w-fit">
              + Agregar pregunta aquí
            </button>
          </div>

          <div className="space-y-4">
            {questions.filter(question => question.section === section).map((question, index) => (
              <article key={question.localId} className="border border-gray-200 rounded-xl p-4 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">Pregunta {index + 1}
                      <textarea rows={2} value={question.prompt} onChange={e => updateQuestion(question.localId, { prompt: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-96">
                    <label className="text-sm font-medium text-gray-700">Sección
                      <input value={question.section} onChange={e => updateQuestion(question.localId, { section: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" />
                    </label>
                    <label className="text-sm font-medium text-gray-700">Tipo
                      <select value={question.type} onChange={e => {
                        const nextType = e.target.value as AutoevaluacionQuestionType
                        updateQuestion(question.localId, {
                          type: nextType,
                          options: ['checkbox', 'single'].includes(nextType) && (question.options ?? []).length === 0 ? defaultOptions : question.options,
                        })
                      }} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white">
                        {questionTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </label>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={Boolean(question.required)} onChange={e => updateQuestion(question.localId, { required: e.target.checked })} />
                  Pregunta obligatoria
                </label>

                {question.type === 'rating' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="text-sm font-medium text-gray-700">Texto nivel bajo
                      <input value={question.minLabel ?? ''} onChange={e => updateQuestion(question.localId, { minLabel: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" placeholder="Por mejorar" />
                    </label>
                    <label className="text-sm font-medium text-gray-700">Texto nivel alto
                      <input value={question.maxLabel ?? ''} onChange={e => updateQuestion(question.localId, { maxLabel: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" placeholder="Muy logrado" />
                    </label>
                  </div>
                )}

                {['checkbox', 'single'].includes(question.type) && (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-sm font-semibold text-gray-700">Opciones de respuesta</p>
                      <button type="button" onClick={() => addOption(question.localId)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-1.5 font-semibold">
                        + Opción
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(question.options ?? []).map((option, optionIndex) => (
                        <div key={`${question.localId}-${optionIndex}`} className="flex gap-2">
                          <input value={option} onChange={e => updateOption(question.localId, optionIndex, e.target.value)} className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                          <button type="button" onClick={() => removeOption(question.localId, optionIndex)} className="text-red-500 hover:bg-red-50 rounded-xl px-3 text-sm font-semibold">
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  <button type="button" onClick={() => duplicateQuestion(question)} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl px-3 py-2 text-xs font-semibold">
                    Duplicar pregunta
                  </button>
                  <button type="button" onClick={() => removeQuestion(question.localId)} className="bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl px-3 py-2 text-xs font-semibold">
                    Eliminar pregunta
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="bg-white rounded-2xl shadow-sm p-5 lg:p-6 border border-gray-100">
        <button type="button" onClick={() => addQuestion('Nueva sección')} className="w-full border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 rounded-2xl px-4 py-5 text-sm font-semibold transition-colors">
          + Agregar pregunta en una nueva sección
        </button>
      </section>
    </div>
  )
}
