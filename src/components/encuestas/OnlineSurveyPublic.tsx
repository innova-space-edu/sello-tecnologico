'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { OnlineQuestion } from '@/lib/online-surveys'

type PublicSurvey = { slug: string; title: string; description: string; questions: OnlineQuestion[] }
const field = 'mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'

export default function OnlineSurveyPublic({ slug }: { slug: string }) {
  const [survey, setSurvey] = useState<PublicSurvey | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/formularios-online/' + encodeURIComponent(slug), { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Formulario no disponible.')
        return data.survey as PublicSurvey
      })
      .then(value => { if (!cancelled) setSurvey(value) })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el formulario.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  const update = (id: string, value: string | string[]) => setAnswers(prev => ({ ...prev, [id]: value }))
  function toggle(id: string, option: string, checked: boolean) {
    setAnswers(prev => {
      const current = Array.isArray(prev[id]) ? prev[id] as string[] : []
      return { ...prev, [id]: checked ? [...current, option] : current.filter(value => value !== option) }
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!survey || sending) return
    setError('')
    for (const question of survey.questions) {
      const value = answers[question.id]
      if (question.required && (value == null || value === '' || (Array.isArray(value) && value.length === 0))) {
        setError('Responde la pregunta obligatoria: ' + question.prompt)
        return
      }
    }
    setSending(true)
    try {
      const key = 'crealab-online-respondent-' + slug
      let token = window.localStorage.getItem(key)
      if (!token) {
        token = crypto.randomUUID()
        window.localStorage.setItem(key, token)
      }
      const response = await fetch('/api/formularios-online/' + encodeURIComponent(slug), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answers }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No fue posible enviar la respuesta.')
      setSent(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error al responder.')
    } finally { setSending(false) }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">Cargando formulario…</main>
  if (!survey) return <main className="grid min-h-screen place-items-center bg-slate-50 px-4"><div className="max-w-lg rounded-2xl border border-amber-100 bg-white p-8 text-center">
    <h1 className="text-xl font-black text-blue-950">Formulario no disponible</h1>
    <p className="mt-3 text-sm text-slate-600">{error || 'No encontramos este formulario.'}</p>
    <Link href="/comunidad" className="mt-5 inline-block font-bold text-blue-700 hover:underline">Visitar Comunidad CreaLab</Link>
  </div></main>
  if (sent) return <main className="grid min-h-screen place-items-center bg-slate-50 px-4"><div className="max-w-lg rounded-2xl bg-white p-9 text-center shadow-sm">
    <div className="text-5xl">✅</div>
    <h1 className="mt-4 text-2xl font-black text-blue-950">Respuesta recibida</h1>
    <p className="mt-3 text-sm text-slate-600">Tu respuesta se guardó correctamente. Gracias por participar.</p>
    <Link href="/comunidad" className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">Volver a Comunidad</Link>
  </div></main>

  const sections = [...new Set(survey.questions.map(q => q.section || 'General'))]
  return <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:py-12">
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <header className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="h-2 bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-400" />
        <div className="p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">CreaLab · Encuesta pública</p>
          <h1 className="mt-3 text-2xl font-black text-blue-950 sm:text-3xl">{survey.title}</h1>
          {survey.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{survey.description}</p>}
          <p className="mt-4 text-xs text-slate-500">No necesitas registrarte para responder. Las preguntas marcadas con * son obligatorias.</p>
        </div>
      </header>

      {sections.map(section => <section key={section} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="border-b border-slate-100 pb-3 font-black text-blue-950">{section}</h2>
        {survey.questions.filter(q => (q.section || 'General') === section).map(q => <fieldset key={q.id} className="space-y-2 rounded-xl border border-slate-100 p-4">
          <legend className="max-w-full px-1 text-sm font-bold text-slate-900">{q.prompt} {q.required && <span className="text-red-600">*</span>}</legend>
          {q.type === 'short' && <input type="text" maxLength={240} required={q.required} value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
            onChange={event => update(q.id, event.target.value)} placeholder="Escribe una respuesta corta" className={field} />}
          {q.type === 'long' && <textarea rows={5} maxLength={3000} required={q.required} value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
            onChange={event => update(q.id, event.target.value)} placeholder="Escribe tu respuesta" className={field} />}
          {q.type === 'single' && <div className="mt-3 space-y-2">{q.options.map(option => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:bg-blue-50">
            <input type="radio" name={q.id} required={q.required} checked={answers[q.id] === option} onChange={() => update(q.id, option)} />{option}
          </label>)}</div>}
          {q.type === 'multiple' && <div className="mt-3 space-y-2">{q.options.map(option => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:bg-blue-50">
            <input type="checkbox" checked={Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(option)}
              onChange={event => toggle(q.id, option, event.target.checked)} />{option}
          </label>)}</div>}
          {q.type === 'scale' && <div className="mt-3 grid grid-cols-5 gap-2">{[1,2,3,4,5].map(value => <button type="button" key={value}
            onClick={() => update(q.id, String(value))}
            aria-pressed={answers[q.id] === String(value)}
            className={'rounded-xl border px-3 py-3 text-sm font-black ' + (answers[q.id] === String(value) ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-700')}>{value}</button>)}</div>}
          {q.type === 'number' && <input type="number" min={-1000000000} max={1000000000} step="any" required={q.required} value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''} onChange={event => update(q.id, event.target.value)} className={field} />}
          {q.type === 'date' && <input type="date" required={q.required} value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''} onChange={event => update(q.id, event.target.value)} className={field} />}
        </fieldset>)}
      </section>)}

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={sending} className="w-full rounded-xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-40">
        {sending ? 'Enviando respuesta…' : 'Enviar respuesta'}
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">Las respuestas se almacenan sin exigir datos de identificación. CreaLab utiliza un identificador aleatorio del navegador para evitar envíos duplicados y un control técnico seudonimizado contra el abuso.</p>
      <p className="text-center text-xs font-bold text-blue-700"><Link href="/comunidad" className="hover:underline">CreaLab · Innova Space Education</Link></p>
    </form>
  </main>
}
