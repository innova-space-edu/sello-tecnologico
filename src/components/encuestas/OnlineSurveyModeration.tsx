'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { OnlineQuestion } from '@/lib/online-surveys'

type PendingSurvey = {
  id: string; title: string; description: string; status: string;
  created_at: string; questions: OnlineQuestion[]; author_name: string; author_role: string
}
export default function OnlineSurveyModeration() {
  const [surveys, setSurveys] = useState<PendingSurvey[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function refresh() {
    const response = await fetch('/api/admin/encuestas-online', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'No se pudo cargar la revisión.')
    setSurveys(data.surveys ?? [])
  }
  useEffect(() => {
    void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [])
  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id); setError('')
    try {
      const response = await fetch('/api/encuestas/online/' + id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo revisar el formulario.')
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error en la revisión')
    } finally { setBusy('') }
  }
  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-800">{error}</p>}
    {loading && <p className="text-slate-500">Consultando encuestas…</p>}
    {!loading && surveys.length === 0 && <p className="rounded-xl border border-green-100 bg-white p-8 text-center text-slate-600">No hay encuestas pendientes de revisión.</p>}
    {surveys.map(survey => <article key={survey.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-black text-blue-950">{survey.title}</h2>
          <p className="mt-1 text-xs text-slate-500">{survey.author_name} · {survey.author_role} · {new Date(survey.created_at).toLocaleDateString('es-CL')}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-950">{survey.status === 'rejected' ? 'Rechazada anteriormente' : 'Pendiente'}</span>
      </div>
      {survey.description && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{survey.description}</p>}
      <details className="mt-4 rounded-xl bg-slate-50 p-4" open>
        <summary className="cursor-pointer font-bold text-slate-900">Revisar todas las preguntas ({survey.questions.length})</summary>
        <div className="mt-4 space-y-3">
          {survey.questions.map((question, index) => <div key={question.id} className="rounded-lg border border-slate-100 bg-white p-3 text-sm text-slate-700">
            <p className="font-bold">{index + 1}. {question.prompt}</p>
            <p className="mt-1 text-xs text-slate-500">{question.type} · {question.section} · {question.required ? 'Obligatoria' : 'Opcional'}</p>
            {['single','multiple'].includes(question.type) && <p className="mt-2 text-xs text-slate-600">{question.options.join(' · ')}</p>}
          </div>)}
        </div>
      </details>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={busy === survey.id} onClick={() => decide(survey.id, 'approve')}
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">✓ Aprobar publicación</button>
        {survey.status === 'pending_review' && <button type="button" disabled={busy === survey.id} onClick={() => decide(survey.id, 'reject')}
          className="rounded-xl bg-red-50 px-5 py-2.5 text-sm font-bold text-red-700 disabled:opacity-40">Rechazar</button>}
        <Link href={'/mis-encuestas/creadas/' + survey.id} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-blue-700">Abrir detalle</Link>
      </div>
    </article>)}
  </div>
}
