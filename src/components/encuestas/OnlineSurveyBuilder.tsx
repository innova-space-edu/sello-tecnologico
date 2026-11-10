'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { OnlineQuestion, OnlineQuestionType } from '@/lib/online-surveys'

const TYPES: { value: OnlineQuestionType; label: string; help: string; icon: string }[] = [
  { value: 'short', label: 'Respuesta corta', help: 'Una línea para nombres de proyectos, conceptos o ideas breves.', icon: '✏️' },
  { value: 'long', label: 'Párrafo largo', help: 'Opiniones, explicaciones, propuestas y reflexiones.', icon: '📝' },
  { value: 'single', label: 'Alternativa única', help: 'Elegir una opción entre varias.', icon: '🔘' },
  { value: 'multiple', label: 'Casillas múltiples', help: 'Elegir varias respuestas.', icon: '☑️' },
  { value: 'scale', label: 'Escala 1–5', help: 'Valoración o nivel de acuerdo.', icon: '⭐' },
  { value: 'number', label: 'Número', help: 'Ingresar un valor numérico.', icon: '🔢' },
  { value: 'date', label: 'Fecha', help: 'Elegir una fecha.', icon: '📅' },
]

function newQuestion(type: OnlineQuestionType = 'short'): OnlineQuestion {
  return {
    id: crypto.randomUUID(), prompt: '', type, required: true,
    section: 'General', options: ['Alternativa 1', 'Alternativa 2'],
  }
}
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

export default function OnlineSurveyBuilder({ surveyId }: { surveyId?: string }) {
  const router = useRouter()
  const [questions, setQuestions] = useState<OnlineQuestion[]>(() => [newQuestion()])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(surveyId))
  const [error, setError] = useState('')
  const [responseCount, setResponseCount] = useState(0)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!surveyId) return
    let cancelled = false
    fetch('/api/encuestas/online/' + encodeURIComponent(surveyId), { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'No fue posible cargar la encuesta.')
        return data
      })
      .then(data => {
        if (cancelled) return
        setTitle(data.survey.title)
        setDescription(data.survey.description)
        setQuestions(data.survey.questions)
        setResponseCount(data.total ?? 0)
        setStatus(data.survey.status)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Error de lectura') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [surveyId])

  const locked = responseCount > 0
  function updateQuestion(id: string, patch: Partial<OnlineQuestion>) {
    setQuestions(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row))
  }
  function changeType(id: string, type: OnlineQuestionType) {
    updateQuestion(id, { type })
  }
  function updateOption(id: string, index: number, text: string) {
    setQuestions(rows => rows.map(row =>
      row.id === id ? { ...row, options: row.options.map((item, i) => i === index ? text : item) } : row))
  }
  function moveQuestion(index: number, amount: number) {
    setQuestions(rows => {
      const next = [...rows]
      const other = index + amount
      if (other < 0 || other >= next.length) return rows
      ;[next[index], next[other]] = [next[other], next[index]]
      return next
    })
  }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (locked || saving) return
    setSaving(true)
    setError('')
    try {
      const url = surveyId ? '/api/encuestas/online/' + surveyId : '/api/encuestas/online'
      const response = await fetch(url, {
        method: surveyId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, questions }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el formulario.')
      router.push('/mis-encuestas/creadas/' + (surveyId ?? data.id))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setSaving(false)
    }
  }

  if (loading) return <div className="rounded-2xl bg-white p-7 text-slate-600">Cargando el editor…</div>

  return <form onSubmit={save} className="space-y-5">
    <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-900 to-blue-700 p-6 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-200">CreaLab · Laboratorio de proyectos</p>
      <h1 className="mt-2 text-2xl font-black">{surveyId ? 'Editar encuesta en línea' : 'Crear encuesta en línea'}</h1>
      <p className="mt-2 text-sm text-blue-100">Diseña preguntas de cualquier disciplina. Obtén un enlace y un QR para compartir el formulario.</p>
      <p className="mt-3 rounded-lg bg-white/10 p-3 text-xs text-blue-50">Para proteger a la comunidad, las encuestas creadas por estudiantes requieren aprobación antes de publicarse. Las cuentas docentes y administradoras pueden publicar directamente.</p>
    </section>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {locked && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Ya se recibieron {responseCount} respuestas. Las preguntas están bloqueadas para conservar su integridad.</p>}
    {status === 'rejected' && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Esta encuesta requiere correcciones antes de su publicación.</p>}

    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-black text-blue-950">1. Datos de la encuesta</h2>
      <label className="block text-sm font-semibold text-slate-700">Título *<input required minLength={3} maxLength={160} disabled={locked} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ej.: Opiniones sobre nuestro proyecto de energía sustentable" className={'mt-1 ' + inputClass} /></label>
      <label className="block text-sm font-semibold text-slate-700">Descripción (opcional)<textarea maxLength={2000} rows={3} disabled={locked} value={description} onChange={event => setDescription(event.target.value)} placeholder="Explica el propósito de la encuesta y a quién está dirigida." className={'mt-1 ' + inputClass} /></label>
    </section>

    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
      <h2 className="font-black text-blue-950">2. Tipos de pregunta</h2>
      <p className="mt-1 text-xs text-slate-600">Puedes combinar formatos en un mismo formulario.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {TYPES.map(type => <button key={type.value} type="button" disabled={locked || questions.length >= 25}
          onClick={() => setQuestions(rows => [...rows, newQuestion(type.value)])}
          title={type.help} className="rounded-xl border border-blue-100 bg-white px-3 py-3 text-left text-xs font-semibold text-blue-900 transition hover:border-blue-500 hover:bg-blue-100 disabled:opacity-40">
          <span className="mr-2 text-lg">{type.icon}</span>{type.label}
        </button>)}
      </div>
    </section>

    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-black text-blue-950">3. Preguntas ({questions.length}/25)</h2>
        <button type="button" disabled={locked || questions.length >= 25} onClick={() => setQuestions(rows => [...rows, newQuestion()])} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">＋ Agregar pregunta</button>
      </div>
      {questions.map((q, index) => <article key={q.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-black text-slate-800">Pregunta {index + 1}</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" disabled={locked || index === 0} onClick={() => moveQuestion(index, -1)} className="rounded-lg border px-2.5 py-1.5 disabled:opacity-30" aria-label={'Mover pregunta ' + (index+1) + ' arriba'}>↑</button>
            <button type="button" disabled={locked || index === questions.length-1} onClick={() => moveQuestion(index, 1)} className="rounded-lg border px-2.5 py-1.5 disabled:opacity-30" aria-label={'Mover pregunta ' + (index+1) + ' abajo'}>↓</button>
            <button type="button" disabled={locked || questions.length >= 25} onClick={() => setQuestions(rows => [...rows.slice(0, index+1), { ...q, id: crypto.randomUUID() }, ...rows.slice(index+1)])} className="rounded-lg border px-2.5 py-1.5 disabled:opacity-40">Duplicar</button>
            <button type="button" disabled={locked || questions.length === 1} onClick={() => setQuestions(rows => rows.filter(item => item.id !== q.id))} className="rounded-lg border border-red-100 px-2.5 py-1.5 text-red-700 disabled:opacity-40">Eliminar</button>
          </div>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Enunciado *<input disabled={locked} required minLength={3} maxLength={240} value={q.prompt} onChange={event => updateQuestion(q.id, { prompt: event.target.value })} placeholder="Escribe aquí tu pregunta" className={'mt-1 ' + inputClass} /></label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Formato
            <select disabled={locked} value={q.type} onChange={event => changeType(q.id, event.target.value as OnlineQuestionType)} className={'mt-1 ' + inputClass}>
              {TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Sección
            <input disabled={locked} maxLength={80} value={q.section} onChange={event => updateQuestion(q.id, { section: event.target.value })} placeholder="General" className={'mt-1 ' + inputClass}/>
          </label>
        </div>
        {['single','multiple'].includes(q.type) && <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600">Alternativas</p>
          {q.options.map((option, optionIndex) => <div key={optionIndex} className="flex gap-2">
            <input disabled={locked} maxLength={140} value={option} onChange={event => updateOption(q.id, optionIndex, event.target.value)} className={inputClass} aria-label={'Alternativa ' + (optionIndex+1)} />
            <button type="button" disabled={locked || q.options.length <= 2} onClick={() => updateQuestion(q.id, { options: q.options.filter((_, i) => i !== optionIndex) })} className="rounded-lg border px-3 text-red-700 disabled:opacity-30">✕</button>
          </div>)}
          <button type="button" disabled={locked || q.options.length >= 12} onClick={() => updateQuestion(q.id, { options: [...q.options, 'Alternativa ' + (q.options.length+1)] })} className="text-xs font-bold text-blue-700 disabled:opacity-30">＋ Añadir alternativa</button>
        </div>}
        {q.type === 'long' && <p className="text-xs text-slate-500">El participante tendrá un cuadro de respuesta amplia (máximo 3000 caracteres).</p>}
        {q.type === 'short' && <p className="text-xs text-slate-500">El participante escribirá hasta 240 caracteres.</p>}
        {q.type === 'scale' && <p className="text-xs text-slate-500">Se ofrecerán cinco valores, del 1 al 5.</p>}
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" disabled={locked} checked={q.required} onChange={event => updateQuestion(q.id, { required: event.target.checked })} /> Respuesta obligatoria</label>
      </article>)}
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
      <Link href={surveyId ? '/mis-encuestas/creadas/' + surveyId : '/mis-encuestas'} className="text-sm font-bold text-slate-600 hover:text-blue-700">← Cancelar</Link>
      <button type="submit" disabled={saving || locked} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-40">{saving ? 'Guardando…' : surveyId ? 'Guardar cambios' : 'Crear y preparar para compartir'}</button>
    </div>
  </form>
}
