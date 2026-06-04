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
  max_points: number
  correct_answers: string[]
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
  max_points: 1,
  correct_answers: ['Alternativa 1'],
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
  const [responseCount, setResponseCount] = useState(0)
  const [form, setForm] = useState({ title: '', description: '', course_id: '', is_active: true, allow_anonymous: true })
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()])
  const locked = responseCount > 0
  const totalPoints = questions.reduce((total, question) => total + (Number(question.max_points) || 0), 0)

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id ?? ''
      const [{ data: courseRows }, { data: teacherRows }, { data: memberRow }, { data: profile }] = await Promise.all([
        supabase.from('courses').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name, email, role').in('role', ['docente', 'coordinador', 'utp', 'admin']).order('full_name'),
        userId ? supabase.from('course_members').select('course_id').eq('user_id', userId).limit(1).maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from('profiles').select('curso').eq('id', userId).maybeSingle() : Promise.resolve({ data: null }),
      ])
      const normalizedCourses = (courseRows ?? []) as Course[]
      setCourses(normalizedCourses)
      setTeachers((teacherRows ?? []) as Teacher[])

      if (surveyId) {
        const response = await fetch(`/api/encuestas/${surveyId}`)
        const data = await response.json()
        if (!response.ok) setError(data.error ?? 'No fue posible cargar la encuesta.')
        else {
          setForm({ title: data.title ?? '', description: data.description ?? '', course_id: data.course_id ?? '', is_active: data.is_active !== false, allow_anonymous: data.allow_anonymous !== false })
          setStaffIds(data.staff_ids ?? [])
          setResponseCount(data.response_count ?? 0)
          setQuestions((data.questions ?? []).map((question: any) => ({
            prompt: question.prompt ?? '', question_type: question.question_type ?? 'text', required: Boolean(question.required),
            options: Array.isArray(question.options) ? question.options : [], appreciation_min_label: question.appreciation_min_label ?? 'Muy en desacuerdo',
            appreciation_max_label: question.appreciation_max_label ?? 'Muy de acuerdo', max_points: Number(question.max_points ?? 1),
            correct_answers: Array.isArray(question.correct_answers) ? question.correct_answers : [],
          })))
        }
      } else {
        const memberCourseId = memberRow?.course_id ?? ''
        const profileCourse = normalizedCourses.find(course => course.name === profile?.curso)?.id ?? ''
        if (memberCourseId || profileCourse) setForm(prev => ({ ...prev, course_id: memberCourseId || profileCourse }))
      }
      setLoading(false)
    }
    load()
  }, [surveyId, supabase])

  const updateQuestion = (index: number, patch: Partial<Question>) => setQuestions(prev => prev.map((question, current) => current === index ? { ...question, ...patch } : question))
  const changeType = (index: number, type: Question['question_type']) => setQuestions(prev => prev.map((question, current) => current !== index ? question : {
    ...question,
    question_type: type,
    correct_answers: type === 'single' ? [question.options[0] ?? 'Alternativa 1'] : [],
  }))
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => setQuestions(prev => prev.map((question, current) => {
    if (current !== questionIndex) return question
    const oldValue = question.options[optionIndex]
    return { ...question, options: question.options.map((option, optionCurrent) => optionCurrent === optionIndex ? value : option), correct_answers: question.correct_answers.map(answer => answer === oldValue ? value : answer) }
  }))
  const addOption = (questionIndex: number) => setQuestions(prev => prev.map((question, current) => current === questionIndex ? { ...question, options: [...question.options, `Alternativa ${question.options.length + 1}`] } : question))
  const removeOption = (questionIndex: number, optionIndex: number) => setQuestions(prev => prev.map((question, current) => {
    if (current !== questionIndex) return question
    const removed = question.options[optionIndex]
    const options = question.options.filter((_, optionCurrent) => optionCurrent !== optionIndex)
    const correct = question.correct_answers.filter(answer => answer !== removed)
    return { ...question, options, correct_answers: question.question_type === 'single' && correct.length === 0 && options[0] ? [options[0]] : correct }
  }))
  const toggleCorrect = (questionIndex: number, option: string, checked: boolean) => setQuestions(prev => prev.map((question, current) => current !== questionIndex ? question : {
    ...question,
    correct_answers: question.question_type === 'single' ? [option] : checked ? [...new Set([...question.correct_answers, option])] : question.correct_answers.filter(answer => answer !== option),
  }))

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError('')
    if (!form.title.trim() || !form.course_id) return setError('Completa el título y selecciona un curso.')
    if (!locked && (questions.length === 0 || questions.some(question => !question.prompt.trim()))) return setError('Cada pregunta debe tener un enunciado.')
    setSaving(true)
    const response = await fetch(surveyId ? `/api/encuestas/${surveyId}` : '/api/encuestas', { method: surveyId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, questions, staff_ids: staffIds }) })
    const data = await response.json()
    if (!response.ok) { setError(data.error ?? 'No fue posible guardar la encuesta.'); setSaving(false); return }
    router.push(`/encuestas/${surveyId ?? data.id}`); router.refresh()
  }

  if (loading) return <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">Cargando editor…</div>

  return <form onSubmit={save} className="space-y-5">
    {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">⚠️ {error}</div>}
    {locked && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">🔒 Esta encuesta ya tiene {responseCount} respuesta(s). La pauta y los puntajes quedaron bloqueados para preservar las notas. Todavía puedes cerrar o reabrir la encuesta y cambiar los docentes autorizados.</div>}

    <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
      <h2 className="font-bold text-blue-900 mb-4">📋 Datos de la encuesta</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm font-medium text-gray-700 md:col-span-2">Título *<input disabled={locked} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 disabled:bg-gray-100" /></label>
        <label className="text-sm font-medium text-gray-700 md:col-span-2">Descripción<textarea disabled={locked} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 disabled:bg-gray-100" /></label>
        <label className="text-sm font-medium text-gray-700">Curso asociado *<select disabled={locked} value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 disabled:bg-gray-100"><option value="">Selecciona un curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
        <div className="space-y-2 pt-6"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Encuesta activa</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allow_anonymous} onChange={e => setForm({ ...form, allow_anonymous: e.target.checked })} /> Permitir respuestas anónimas</label></div>
      </div>
    </section>

    <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6"><details className="group"><summary className="cursor-pointer list-none flex justify-between font-bold text-blue-900"><span>👨‍🏫 Docentes autorizados ({staffIds.length})</span><span>▼</span></summary><div className="mt-4 border rounded-lg divide-y max-h-60 overflow-y-auto">{teachers.map(teacher => <label key={teacher.id} className="flex gap-3 px-4 py-3 text-sm"><input type="checkbox" checked={staffIds.includes(teacher.id)} onChange={e => setStaffIds(prev => e.target.checked ? [...new Set([...prev, teacher.id])] : prev.filter(id => id !== teacher.id))} />{teacher.full_name ?? teacher.email} · {teacher.role}</label>)}</div></details></section>

    <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
      <div className="flex flex-wrap justify-between gap-3 mb-4"><div><h2 className="font-bold text-blue-900">🧩 Ítems evaluados</h2><p className="text-xs text-gray-400 mt-1">Total de la encuesta: {totalPoints.toFixed(1)} puntos · exigencia: 60% para nota 4,0.</p></div><button disabled={locked} type="button" onClick={() => setQuestions(prev => [...prev, emptyQuestion()])} className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">+ Agregar ítem</button></div>
      <div className="space-y-4">{questions.map((question, index) => <article key={index} className="border rounded-xl p-4 space-y-3">
        <div className="flex justify-between gap-3"><h3 className="font-semibold">Ítem {index + 1}</h3><button disabled={locked} type="button" onClick={() => setQuestions(prev => prev.filter((_, current) => current !== index))} className="text-red-500 text-sm disabled:opacity-50">Eliminar</button></div>
        <input disabled={locked} value={question.prompt} onChange={e => updateQuestion(index, { prompt: e.target.value })} placeholder="Escribe la pregunta o afirmación" className="w-full border rounded-lg px-3 py-2.5 text-sm disabled:bg-gray-100" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><select disabled={locked} value={question.question_type} onChange={e => changeType(index, e.target.value as Question['question_type'])} className="border rounded-lg px-3 py-2.5 text-sm disabled:bg-gray-100"><option value="single">Alternativa única</option><option value="multiple">Selección múltiple</option><option value="appreciation">Evaluación apreciativa 1–5</option><option value="text">Respuesta abierta</option></select><label className="flex items-center gap-2 text-sm"><input disabled={locked} type="checkbox" checked={question.required} onChange={e => updateQuestion(index, { required: e.target.checked })} /> Obligatoria</label><label className="text-sm">Puntaje máximo<input disabled={locked} type="number" min="0.1" step="0.1" value={question.max_points} onChange={e => updateQuestion(index, { max_points: Number(e.target.value) })} className="ml-2 w-24 border rounded-lg px-2 py-1.5 disabled:bg-gray-100" /></label></div>
        {(question.question_type === 'single' || question.question_type === 'multiple') && <div className="space-y-2"><p className="text-xs text-gray-500">Marca la(s) alternativa(s) correcta(s).</p>{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex gap-2"><input disabled={locked} type={question.question_type === 'single' ? 'radio' : 'checkbox'} name={`correct-${index}`} checked={question.correct_answers.includes(option)} onChange={e => toggleCorrect(index, option, e.target.checked)} /><input disabled={locked} value={option} onChange={e => updateOption(index, optionIndex, e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /><button disabled={locked} type="button" onClick={() => removeOption(index, optionIndex)} className="text-red-400 px-2 disabled:opacity-50">✕</button></div>)}<button disabled={locked} type="button" onClick={() => addOption(index)} className="text-blue-600 text-sm disabled:opacity-50">+ Agregar alternativa</button></div>}
        {question.question_type === 'appreciation' && <div><p className="text-xs text-gray-500 mb-2">La escala otorga puntaje proporcional: 1 = 20%, 5 = 100%.</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input disabled={locked} value={question.appreciation_min_label} onChange={e => updateQuestion(index, { appreciation_min_label: e.target.value })} className="border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /><input disabled={locked} value={question.appreciation_max_label} onChange={e => updateQuestion(index, { appreciation_max_label: e.target.value })} className="border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /></div></div>}
        {question.question_type === 'text' && <p className="text-xs text-gray-500">La respuesta abierta recibe el puntaje máximo cuando contiene texto.</p>}
      </article>)}</div>
    </section>
    <div className="flex justify-end gap-3 pb-5"><button type="button" onClick={() => router.back()} className="bg-gray-100 px-5 py-2.5 rounded-lg text-sm font-semibold">Cancelar</button><button disabled={saving} className="bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">{saving ? 'Guardando…' : locked ? 'Guardar configuración' : surveyId ? 'Guardar cambios' : 'Crear encuesta'}</button></div>
  </form>
}
