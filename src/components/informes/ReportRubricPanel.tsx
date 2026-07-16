'use client'

import { calculateChileanGrade } from '@/lib/project-report'

type Criterion = {
  id: string
  title: string
  description?: string | null
  max_points: number
  student_example?: string | null
  teacher_example?: string | null
}

type Props = {
  rubric: { id: string; title: string; description?: string | null; total_points: number; published: boolean } | null
  criteria: Criterion[]
  isStaff: boolean
  scores: Record<string, number>
  feedback: Record<string, string>
  generalFeedback: string
  finalGrade?: number | null
  earnedPoints?: number | null
  onScoreChange: (criterionId: string, value: number) => void
  onFeedbackChange: (criterionId: string, value: string) => void
  onGeneralFeedbackChange: (value: string) => void
  onCreateDefault: () => void
  onCalculate: () => void
}

export default function ReportRubricPanel({ rubric, criteria, isStaff, scores, feedback, generalFeedback, finalGrade, earnedPoints, onScoreChange, onFeedbackChange, onGeneralFeedbackChange, onCreateDefault, onCalculate }: Props) {
  if (!rubric) {
    return <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-blue-900">📊 Rúbrica de evaluación</h2>
      <p className="mt-2 text-sm text-gray-500">Todavía no hay una rúbrica publicada para este curso.</p>
      {isStaff && <button type="button" onClick={onCreateDefault} className="mt-4 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-700">Crear y publicar rúbrica de 100 puntos</button>}
    </section>
  }

  const total = criteria.reduce((sum, criterion) => sum + Number(criterion.max_points || 0), 0)
  const earned = criteria.reduce((sum, criterion) => sum + Math.min(Number(scores[criterion.id] ?? 0), Number(criterion.max_points)), 0)
  const previewGrade = calculateChileanGrade(earned, total, 60)

  return <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
    <div className="border-b border-gray-100 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-bold text-blue-900">📊 {rubric.title}</h2><p className="mt-1 text-xs text-gray-500">Escala chilena de 1,0 a 7,0 · exigencia 60% para nota 4,0.</p></div>
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">{total} puntos</span>
      </div>
      {rubric.description && <p className="mt-3 text-sm text-gray-600">{rubric.description}</p>}
    </div>
    <div className="divide-y divide-gray-100">
      {criteria.map((criterion, index) => <div key={criterion.id} className="p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-gray-800">{index + 1}. {criterion.title}</p>{criterion.description && <p className="mt-1 text-xs leading-relaxed text-gray-500">{criterion.description}</p>}</div><span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">Máx. {criterion.max_points}</span></div>
        {criterion.student_example && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">💡 {criterion.student_example}</p>}
        {isStaff && <div className="mt-3 grid grid-cols-[110px_1fr] gap-2"><label className="text-xs font-bold text-gray-500">Puntaje<input type="number" min={0} max={criterion.max_points} step="0.5" value={scores[criterion.id] ?? 0} onChange={event => onScoreChange(criterion.id, Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" /></label><label className="text-xs font-bold text-gray-500">Retroalimentación<textarea value={feedback[criterion.id] ?? ''} onChange={event => onFeedbackChange(criterion.id, event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" /></label></div>}
        {!isStaff && scores[criterion.id] != null && <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800"><strong>{scores[criterion.id]} / {criterion.max_points} puntos</strong>{feedback[criterion.id] && <p className="mt-1 text-xs">{feedback[criterion.id]}</p>}</div>}
      </div>)}
    </div>
    <div className="border-t border-gray-100 bg-gray-50 p-5">
      {isStaff ? <><label className="text-xs font-bold uppercase tracking-wide text-gray-500">Retroalimentación general<textarea value={generalFeedback} onChange={event => onGeneralFeedbackChange(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" /></label><div className="mt-4 rounded-xl border border-purple-100 bg-purple-50 p-4"><div className="flex items-center justify-between text-sm text-purple-900"><span>Puntaje actual</span><strong>{earned.toFixed(1)} / {total.toFixed(1)}</strong></div><div className="mt-2 flex items-center justify-between"><span className="text-sm text-purple-700">Nota estimada</span><strong className="text-2xl text-purple-900">{previewGrade.toFixed(1)}</strong></div></div><button type="button" onClick={onCalculate} className="mt-4 w-full rounded-xl bg-green-600 px-4 py-3 font-bold text-white hover:bg-green-700">🧮 Calcular nota y guardar evaluación</button></> : finalGrade != null ? <div className="rounded-xl bg-green-50 p-4 text-center"><p className="text-sm text-green-700">Resultado final</p><p className="mt-1 text-3xl font-black text-green-800">Nota {Number(finalGrade).toFixed(1)}</p><p className="mt-1 text-sm text-green-700">{earnedPoints ?? earned} / {total} puntos</p>{generalFeedback && <p className="mt-3 whitespace-pre-wrap text-left text-sm text-green-900">{generalFeedback}</p>}</div> : <p className="text-center text-sm text-gray-400">La evaluación todavía no ha sido publicada.</p>}
    </div>
  </section>
}
