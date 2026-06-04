'use client'

import { createClient } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'

type Question = {
  id: string
  prompt: string
  question_type: 'text' | 'single' | 'multiple' | 'appreciation'
  required: boolean
  options: string[] | null
  appreciation_min_label?: string | null
  appreciation_max_label?: string | null
  sort_order?: number | null
}

type Survey = {
  id: string
  title: string
  description?: string | null
  course_id: string
  is_active: boolean
  courses?: { name?: string | null } | null
  survey_questions?: Question[] | null
}

export default function ResponderEncuesta({ slug }: { slug: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        setUserId(auth.user.id)
        setEmail(auth.user.email ?? '')
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', auth.user.id)
          .single()
        setName(profile?.full_name ?? '')
        setEmail(profile?.email ?? auth.user.email ?? '')
      }

      const { data, error: surveyError } = await supabase
        .from('surveys')
        .select('id, title, description, course_id, is_active, courses(name), survey_questions(id, prompt, question_type, required, options, appreciation_min_label, appreciation_max_label, sort_order)')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (surveyError || !data) {
        setError('La encuesta no está disponible o fue cerrada.')
      } else {
        const normalized = data as unknown as Survey
        normalized.survey_questions = [...(normalized.survey_questions ?? [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        setSurvey(normalized)
      }
      setLoading(false)
    }
    load()
  }, [slug, supabase])

  const updateMultiple = (questionId: string, option: string, checked: boolean) => {
    const current = Array.isArray(answers[questionId]) ? answers[questionId] as string[] : []
    setAnswers(prev => ({
      ...prev,
      [questionId]: checked ? [...current, option] : current.filter(item => item !== option),
    }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!survey) return
    setError('')

    for (const question of survey.survey_questions ?? []) {
      const value = answers[question.id]
      if (question.required && (!value || (Array.isArray(value) && value.length === 0))) {
        setError('Completa todas las preguntas obligatorias.')
        return
      }
    }

    setSaving(true)
    const responseId = crypto.randomUUID()
    const { error: responseError } = await supabase
      .from('survey_responses')
      .insert({
        id: responseId,
        survey_id: survey.id,
        course_id: survey.course_id,
        registered_user_id: userId,
        respondent_name: name.trim() || null,
        respondent_email: email.trim() || null,
      })

    if (responseError) {
      setError(responseError.message || 'No fue posible guardar tu respuesta.')
      setSaving(false)
      return
    }

    const rows = (survey.survey_questions ?? []).map(question => {
      const value = answers[question.id]
      return {
        response_id: responseId,
        question_id: question.id,
        value_text: typeof value === 'string' ? value : null,
        value_json: Array.isArray(value) ? value : null,
        value_number: question.question_type === 'appreciation' && value ? Number(value) : null,
      }
    }).filter(row => row.value_text !== null || row.value_json !== null || row.value_number !== null)

    if (rows.length > 0) {
      const { error: answerError } = await supabase.from('survey_answers').insert(rows)
      if (answerError) {
        setError(answerError.message)
        setSaving(false)
        return
      }
    }

    setSent(true)
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-gray-500">Cargando encuesta…</div>
  if (error && !survey) return <div className="min-h-screen grid place-items-center p-6"><div className="max-w-lg bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">{error}</div></div>
  if (sent) return <div className="min-h-screen grid place-items-center p-6"><div className="max-w-lg bg-white shadow-sm rounded-2xl p-8 text-center"><div className="text-5xl mb-3">✅</div><h1 className="text-xl font-bold text-blue-900">Respuesta enviada</h1><p className="text-gray-500 mt-2">Gracias por compartir tu opinión.</p></div></div>

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <form onSubmit={submit} className="max-w-3xl mx-auto space-y-5">
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Encuesta · Sello Tecnológico</p>
          <h1 className="text-2xl font-bold text-blue-900 mt-2">{survey?.title}</h1>
          {survey?.description && <p className="text-gray-600 mt-2 whitespace-pre-wrap">{survey.description}</p>}
          <p className="text-sm text-gray-400 mt-3">Curso: {survey?.courses?.name ?? '—'}</p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700">Nombre o identificación opcional<input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-gray-700">Correo opcional<input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5" /></label>
        </section>

        {(survey?.survey_questions ?? []).map((question, index) => (
          <section key={question.id} className="bg-white rounded-2xl shadow-sm p-6">
            <p className="font-semibold text-gray-800">{index + 1}. {question.prompt} {question.required && <span className="text-red-500">*</span>}</p>
            {question.question_type === 'text' && <textarea rows={4} value={(answers[question.id] as string) ?? ''} onChange={e => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))} className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2.5" />}
            {question.question_type === 'single' && <div className="mt-3 space-y-2">{(question.options ?? []).map(option => <label key={option} className="flex gap-2 items-center"><input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswers(prev => ({ ...prev, [question.id]: option }))} /> <span>{option}</span></label>)}</div>}
            {question.question_type === 'multiple' && <div className="mt-3 space-y-2">{(question.options ?? []).map(option => <label key={option} className="flex gap-2 items-center"><input type="checkbox" checked={Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes(option)} onChange={e => updateMultiple(question.id, option, e.target.checked)} /> <span>{option}</span></label>)}</div>}
            {question.question_type === 'appreciation' && <div className="mt-4"><div className="grid grid-cols-5 gap-2">{[1,2,3,4,5].map(value => <button type="button" key={value} onClick={() => setAnswers(prev => ({ ...prev, [question.id]: String(value) }))} className={`rounded-lg border py-3 font-bold ${answers[question.id] === String(value) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>{value}</button>)}</div><div className="flex justify-between text-xs text-gray-400 mt-2"><span>{question.appreciation_min_label}</span><span>{question.appreciation_max_label}</span></div></div>}
          </section>
        ))}

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">⚠️ {error}</div>}
        <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl px-5 py-3 font-semibold">{saving ? 'Enviando…' : 'Enviar respuesta'}</button>
      </form>
    </main>
  )
}
