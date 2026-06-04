'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type Question = {
  prompt: string
  question_type: 'text' | 'single' | 'multiple' | 'appreciation'
  required: boolean
  options: string[]
  appreciation_min_label: string
  appreciation_max_label: string
}

type Course = { id: string; name: string }
type Teacher = { id: string; full_name?: string | null; email?: string | null; role?: string | null }

const emptyQuestion = (): Question => ({
  prompt: '',
  question_type: 'single',
  required: false,
  options: ['Alternativa 1', 'Alternativa 2'],
  appreciation_min_label: 'Muy en desacuerdo',
  appreciation_max_label: 'Muy de acuerdo',
})

export default function EncuestaBuilder({ surveyId }: { surveyId?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [staffIds, setStaffIds] = useState<string[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    course_id: '',
    is_active: true,
    allow_anonymous: true,
  })
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()])

  useEffect(() => {
    const load = async () => {
      const [{ data: courseRows }, { data: teacherRows }] = await Promise.all([
        supabase.from('courses').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name, email, role').in('role', ['docente', 'coordinador', 'utp', 'admin']).order('full_name'),
      ])
      setCourses((courseRows ?? []) as Course[])
      setTeachers((teacherRows ?? []) as Teacher[])

      if (surveyId) {
        const response = await fetch(`/api/encuestas/${surveyId}`)
        const data = await response.json()
        if (!response.ok) {
          setError(data.error ?? 'No fue posible cargar la encuesta.')
        } else {
          setForm({
            title: data.title ?? '',
            description: data.description ?? '',
            course_id: data.course_id ?? '',
            is_active: data.is_active !== false,
            allow_anonymous: data.allow_anonymous !== false,
          })
          setStaffIds(data.staff_ids ?? [])
          setQuestions((data.questions ?? []).map((question: any) => ({
            prompt: question.prompt ?? '',
            question_type: question.question_type ?? 'text',
            required: Boolean(question.required),
            options: Array.isArray(question.options) ? question.options : [],
            appreciation_min_label: question.appreciation_min_label ?? 'Muy en desacuerdo',
            appreciation_max_label: question.appreciation_max_label ?? 'Muy de acuerdo',
          })))
        }
      }
      setLoading(false)
    }
    load()
  }, [surveyId, supabase])

  const updateQuestion = (index: number, patch: Partial<Question>) => {
    setQuestions(prev => prev.map((question, current) => current === index ? { ...question, ...patch } : question))
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions(prev => prev.map((question, current) => current === questionIndex
      ? { ...question, options: question.options.map((option, optionCurrent) => optionCurrent === optionIndex ? value : option) }
      : question))
  }

  const addOption = (questionIndex: number) => {
    setQuestions(prev => prev.map((question, current) => current === questionIndex
      ? { ...question, options: [...question.options, `Alternativa ${question.options.length + 1}`] }
      : question))
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions(prev => prev.map((question, current) => current === questionIndex
      ? { ...question, options: question.options.filter((_, optionCurrent) => optionCurrent !== optionIndex) }
      : question))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!form.title.trim() || !form.course_id) {
      setError('Completa el título y selecciona un curso.')
      return
    }
    if (questions.length === 0 || questions.some(question => !question.prompt.trim())) {
      setError('Cada pregunta debe tener un enunciado.')
      return
    }

    setSaving(true)
    const response = await fetch(surveyId ? `/api/encuestas/${surveyId}` : '/api/encuestas', {
      method: surveyId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, questions, staff_ids: staffIds }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? 'No fue posible guardar la encuesta.')
      setSaving(false)
      return
    }

    router.push(`/encuestas/${surveyId ?? data.id}`)
    router.refresh()
  }

  if (loading) return <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">Cargando editor…</div>

  return (
    <form onSubmit={save} className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">⚠️ {error}</div>}

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-4">📋 Datos de la encuesta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700 md:col-span-2">Título *<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-gray-700 md:col-span-2">Descripción<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-gray-700">Curso asociado *<select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5"><option value="">Selecciona un curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Encuesta activa y disponible mediante enlace</label>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.allow_anonymous} onChange={e => setForm({ ...form, allow_anonymous: e.target.checked })} /> Permitir respuestas anónimas</label>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <details className="group">
          <summary className="cursor-pointer list-none flex justify-between font-bold text-blue-900"><span>👨‍🏫 Docentes autorizados para ver resultados ({staffIds.length})</span><span className="text-gray-400">▼</span></summary>
          <div className="mt-4 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {teachers.map(teacher => <label key={teacher.id} className="flex gap-3 px-4 py-3 hover:bg-blue-50 text-sm"><input type="checkbox" checked={staffIds.includes(teacher.id)} onChange={e => setStaffIds(prev => e.target.checked ? [...prev, teacher.id] : prev.filter(id => id !== teacher.id))} /><span>{teacher.full_name ?? teacher.email} <span className="text-gray-400">· {teacher.role}</span></span></label>)}
          </div>
        </details>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <div className="flex flex-wrap justify-between gap-3 mb-4"><div><h2 className="font-bold text-blue-900">🧩 Ítems de la encuesta</h2><p className="text-xs text-gray-400 mt-1">Combina alternativas, texto libre y escala apreciativa.</p></div><button type="button" onClick={() => setQuestions(prev => [...prev, emptyQuestion()])} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-semibold">+ Agregar ítem</button></div>
        <div className="space-y-4">
          {questions.map((question, index) => (
            <article key={index} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex justify-between gap-3"><h3 className="font-semibold text-gray-700">Ítem {index + 1}</h3><button type="button" onClick={() => setQuestions(prev => prev.filter((_, current) => current !== index))} className="text-red-500 text-sm">Eliminar</button></div>
              <input value={question.prompt} onChange={e => updateQuestion(index, { prompt: e.target.value })} placeholder="Escribe la pregunta o afirmación" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><select value={question.question_type} onChange={e => updateQuestion(index, { question_type: e.target.value as Question['question_type'] })} className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm"><option value="single">Alternativa única</option><option value="multiple">Selección múltiple</option><option value="appreciation">Evaluación apreciativa 1–5</option><option value="text">Respuesta abierta</option></select><label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={question.required} onChange={e => updateQuestion(index, { required: e.target.checked })} /> Respuesta obligatoria</label></div>
              {(question.question_type === 'single' || question.question_type === 'multiple') && <div className="space-y-2">{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex gap-2"><input value={option} onChange={e => updateOption(index, optionIndex, e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" /><button type="button" onClick={() => removeOption(index, optionIndex)} className="text-red-400 px-2">✕</button></div>)}<button type="button" onClick={() => addOption(index)} className="text-blue-600 text-sm">+ Agregar alternativa</button></div>}
              {question.question_type === 'appreciation' && <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input value={question.appreciation_min_label} onChange={e => updateQuestion(index, { appreciation_min_label: e.target.value })} placeholder="Etiqueta para 1" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" /><input value={question.appreciation_max_label} onChange={e => updateQuestion(index, { appreciation_max_label: e.target.value })} placeholder="Etiqueta para 5" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>}
            </article>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-3 pb-5"><button type="button" onClick={() => router.back()} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold">Cancelar</button><button disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">{saving ? 'Guardando…' : surveyId ? 'Guardar cambios' : 'Crear encuesta'}</button></div>
    </form>
  )
}
