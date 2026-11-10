'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { OnlineQuestion } from '@/lib/online-surveys'
import OnlineSurveyShare from './OnlineSurveyShare'

type Survey = {
  id: string
  title: string
  description: string
  slug: string
  status: string
  questions: OnlineQuestion[]
  created_at: string
}
type Response = { id: string; answers: Record<string, string | string[]>; created_at: string }
type Detail = { survey: Survey; responses: Response[]; total: number }
const statusLabels: Record<string, string> = {
  pending_review: 'Pendiente de revisión',
  published: 'Publicada · acepta respuestas',
  closed: 'Cerrada',
  rejected: 'Requiere correcciones',
}
function displayAnswer(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(', ') : value ?? '—'
}

export default function OnlineSurveyDetail({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    const response = await fetch('/api/encuestas/online/' + id, { cache: 'no-store' })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error ?? 'No se pudo cargar la encuesta.')
    setData(json)
  }
  useEffect(() => {
    let cancelled = false
    fetch('/api/encuestas/online/' + id, { cache: 'no-store' })
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Encuesta no disponible.')
        return json as Detail
      })
      .then(json => { if (!cancelled) setData(json) })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Error al consultar') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  async function changeStatus(action: string) {
    setActing(true); setError('')
    try {
      const response = await fetch('/api/encuestas/online/' + id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'No se pudo actualizar.')
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo actualizar')
    } finally { setActing(false) }
  }

  if (loading) return <div className="rounded-2xl bg-white p-8 text-slate-600">Cargando encuesta…</div>
  if (!data) return <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">{error || 'Encuesta no disponible.'}</p>
  const { survey, responses, total } = data

  return <div className="space-y-5">
    <header className="rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 p-6 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-200">CreaLab · Encuesta creada</p>
      <h1 className="mt-2 text-2xl font-black">{survey.title}</h1>
      {survey.description && <p className="mt-2 whitespace-pre-wrap text-sm text-blue-100">{survey.description}</p>}
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-white/20 px-3 py-1.5">{statusLabels[survey.status] ?? survey.status}</span>
        <span className="rounded-full bg-white/20 px-3 py-1.5">{survey.questions.length} preguntas</span>
        <span className="rounded-full bg-white/20 px-3 py-1.5">{total} respuestas</span>
      </div>
    </header>

    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {total === 0 && <Link href={'/mis-encuestas/creadas/' + id + '/editar'} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700">✏️ Editar preguntas</Link>}
      {survey.status === 'published' && <button type="button" disabled={acting} onClick={() => changeStatus('close')} className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-900 disabled:opacity-40">Cerrar respuestas</button>}
      {survey.status === 'closed' && <button type="button" disabled={acting} onClick={() => changeStatus('reopen')} className="rounded-xl bg-green-100 px-4 py-2.5 text-sm font-bold text-green-900 disabled:opacity-40">Reabrir encuesta</button>}
      {survey.status === 'rejected' && <button type="button" disabled={acting} onClick={() => changeStatus('resubmit')} className="rounded-xl bg-blue-100 px-4 py-2.5 text-sm font-bold text-blue-800 disabled:opacity-40">Solicitar nueva revisión</button>}
    </div>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-blue-950">Preguntas</h2>
          <div className="mt-3 space-y-3">
            {survey.questions.map((question, index) => <div key={question.id} className="rounded-xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-800">{index + 1}. {question.prompt} {question.required ? '*' : ''}</p>
              <p className="mt-1 text-xs text-slate-500">{question.section} · {question.type}</p>
              {['single', 'multiple'].includes(question.type) && <p className="mt-2 text-sm text-slate-600">Opciones: {question.options.join(' · ')}</p>}
            </div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-blue-950">Respuestas recibidas ({total})</h2>
          <p className="mt-1 text-xs text-slate-500">Por privacidad, los visitantes no tienen que indicar su nombre o correo. Se muestran las 200 respuestas más recientes.</p>
          {responses.length === 0
            ? <p className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Todavía no hay respuestas.</p>
            : <div className="mt-4 space-y-3">
              {responses.map((response, index) => <details key={response.id} className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-800">Respuesta {total - index} · {new Date(response.created_at).toLocaleString('es-CL')}</summary>
                <div className="mt-4 space-y-3">
                  {survey.questions.map(question => <div key={question.id} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-blue-900">{question.prompt}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{displayAnswer(response.answers[question.id])}</p>
                  </div>)}
                </div>
              </details>)}
            </div>}
        </section>
      </div>

      <aside className="space-y-4">
        <OnlineSurveyShare slug={survey.slug} published={survey.status === 'published'} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <h3 className="font-black text-blue-950">Seguridad del formulario</h3>
          <p className="mt-2">Solo las preguntas aprobadas se publican. Las respuestas no son visibles para quienes reciben el enlace.</p>
        </div>
      </aside>
    </div>
  </div>
}
