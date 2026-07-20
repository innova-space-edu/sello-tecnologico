'use client'

import { AutoevaluacionFormat, AutoevaluacionQuestion, DEFAULT_AUTOEVALUACION_FORMAT, getAutoevaluacionSections } from '@/lib/autoevaluacion'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type Course = { id: string; name: string }
type Project = { id: string; title: string; course_id?: string | null }

type Actor = {
  id: string
  role: string
  curso?: string | null
  full_name?: string | null
  email?: string | null
}

type Props = {
  actor: Actor
  courses: Course[]
  projects: Project[]
  selectedFormat?: AutoevaluacionFormat
}

type AnswerValue = string | string[]

function buildInitialAnswers(questions: AutoevaluacionQuestion[]) {
  return Object.fromEntries(
    questions.map(question => [question.id, question.type === 'checkbox' ? [] : ''])
  ) as Record<string, AnswerValue>
}

export default function AutoevaluacionForm({ actor, courses, projects, selectedFormat = DEFAULT_AUTOEVALUACION_FORMAT }: Props) {
  const router = useRouter()
  const questions = selectedFormat.questions?.length ? selectedFormat.questions : DEFAULT_AUTOEVALUACION_FORMAT.questions
  const guessedCourse = useMemo(() => {
    const normalizedActorCourse = String(actor.curso ?? '').trim().toLowerCase()
    return courses.find(course => course.name.trim().toLowerCase() === normalizedActorCourse)?.id ?? ''
  }, [actor.curso, courses])

  const [form, setForm] = useState({
    student_name: actor.full_name ?? '',
    course_id: guessedCourse,
    project_id: projects.length === 1 ? projects[0].id : '',
    project_name: projects.length === 1 ? projects[0].title : '',
    intervention_place: '',
  })
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => buildInitialAnswers(questions))
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState('')

  const sections = getAutoevaluacionSections(questions)

  const setAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const toggleCheckbox = (questionId: string, option: string, checked: boolean) => {
    const current = Array.isArray(answers[questionId]) ? answers[questionId] as string[] : []
    setAnswer(questionId, checked ? [...current, option] : current.filter(item => item !== option))
  }

  const validate = () => {
    if (!form.student_name.trim()) return 'Debes escribir tu nombre completo.'
    if (!form.course_id) return 'Debes seleccionar tu curso.'
    if (!form.project_id) return 'Debes seleccionar el proyecto.'
    if (!form.intervention_place.trim()) return 'Debes escribir el lugar intervenido en el colegio.'
    for (const question of questions) {
      if (!question.required) continue
      const value = answers[question.id]
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return 'Completa todas las preguntas obligatorias antes de finalizar.'
      }
    }
    if (!confirmed) return 'Debes confirmar que revisaste tus respuestas y quieres enviar la autoevaluación.'
    return ''
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const ok = window.confirm('¿Confirmas que ya realizaste la autoevaluación y quieres enviarla para que quede guardada?')
    if (!ok) return

    setSaving(true)
    const response = await fetch('/api/autoevaluacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, answers, confirmed, format_id: selectedFormat.id }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(data.error ?? 'No fue posible guardar la autoevaluación.')
      setSaving(false)
      return
    }

    setSavedId(data.id)
    setSaving(false)
    router.refresh()
  }

  if (savedId) {
    return (
      <section className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-2xl mx-auto border border-green-100">
        <div className="text-5xl mb-3">✅</div>
        <h1 className="text-2xl font-bold text-blue-900">Autoevaluación enviada</h1>
        <p className="text-gray-500 mt-2">Tu respuesta quedó guardada y ahora puede ser revisada por docentes y administración.</p>
        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
          <a href={`/autoevaluacion/respuestas/${savedId}`} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-3 text-sm font-semibold">Ver mi autoevaluación</a>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl px-5 py-3 text-sm font-semibold">Volver al dashboard</button>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="max-w-5xl mx-auto space-y-5">
      <section className="bg-white rounded-2xl shadow-sm p-5 lg:p-6 border border-blue-100">
        <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Formato seleccionado</p>
        <h1 className="text-2xl font-bold text-blue-900 mt-2">{selectedFormat.title}</h1>
        <p className="text-gray-600 mt-2">{selectedFormat.description ?? 'Responde con honestidad. Esta autoevaluación permite revisar el proceso, los avances y las mejoras necesarias.'}</p>
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-4">👤 Datos del estudiante y proyecto</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700">Nombre completo *
            <input value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" placeholder="Escribe tu nombre" />
          </label>
          <label className="text-sm font-medium text-gray-700">Curso *
            <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white">
              <option value="">Selecciona tu curso</option>
              {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Proyecto asociado *
            <select value={form.project_id} onChange={e => { const project = projects.find(item => item.id === e.target.value); setForm({ ...form, project_id: e.target.value, project_name: project?.title ?? '', course_id: project?.course_id ?? form.course_id }) }} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white">
              <option value="">Selecciona tu proyecto</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Lugar intervenido *
            <input value={form.intervention_place} onChange={e => setForm({ ...form, intervention_place: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" placeholder="Ej: patio central, pasillo, sala, jardín" />
          </label>
        </div>
      </section>

      {sections.map(section => (
        <section key={section} className="bg-white rounded-2xl shadow-sm p-5 lg:p-6">
          <h2 className="font-bold text-blue-900 mb-4">{section}</h2>
          <div className="space-y-5">
            {questions.filter(question => question.section === section).map((question, index) => (
              <article key={question.id} className="border border-gray-200 rounded-xl p-4">
                <p className="font-semibold text-gray-800">{index + 1}. {question.prompt} {question.required && <span className="text-red-500">*</span>}</p>

                {question.type === 'text' && (
                  <textarea rows={4} value={String(answers[question.id] ?? '')} onChange={e => setAnswer(question.id, e.target.value)} className="mt-3 w-full border border-gray-300 rounded-xl px-3 py-2.5" placeholder="Escribe tu respuesta" />
                )}

                {question.type === 'rating' && (
                  <div className="mt-4">
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map(value => (
                        <button key={value} type="button" onClick={() => setAnswer(question.id, String(value))} className={`rounded-xl border py-3 font-bold transition-colors ${answers[question.id] === String(value) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'}`}>
                          {value}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      <span>{question.minLabel ?? 'Por mejorar'}</span>
                      <span>{question.maxLabel ?? 'Muy logrado'}</span>
                    </div>
                  </div>
                )}

                {question.type === 'checkbox' && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(question.options ?? []).map(option => (
                      <label key={option} className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 hover:bg-gray-50">
                        <input type="checkbox" className="mt-1" checked={Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes(option)} onChange={e => toggleCheckbox(question.id, option, e.target.checked)} />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === 'single' && (
                  <div className="mt-3 space-y-2">
                    {(question.options ?? []).map(option => (
                      <label key={option} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 hover:bg-gray-50">
                        <input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswer(question.id, option)} />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <label className="flex gap-3 text-sm text-blue-900 font-medium">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />
          <span>Confirmo que respondí esta autoevaluación con honestidad, revisé mis respuestas y finalizo el envío para que quede guardado.</span>
        </label>
      </section>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">⚠️ {error}</div>}

      <div className="flex justify-end pb-6">
        <button disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl px-6 py-3 font-semibold">
          {saving ? 'Guardando…' : 'Finalizar y enviar autoevaluación'}
        </button>
      </div>
    </form>
  )
}
