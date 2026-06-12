import Sidebar from '@/components/Sidebar'
import CompartirFormulario from '@/components/encuestas/CompartirFormulario'
import FeedbackEncuesta from '@/components/encuestas/FeedbackEncuesta'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canReadSurvey, getSurveyActor } from '@/lib/survey-auth'

type SurveyQuestion = {
  id: string
  prompt: string
  question_type: string
  sort_order: number
  max_points: number
  options?: string[] | null
  option_scores?: Record<string, number> | null
}

function countSelections(question: SurveyQuestion, responses: any[]) {
  const options = Array.isArray(question.options) ? question.options : []
  return options.map(option => {
    const selected = responses.reduce((total, response) => {
      const answer = (response.survey_answers ?? []).find((row: any) => row.question_id === question.id)
      if (!answer) return total
      if (question.question_type === 'multiple') return total + (Array.isArray(answer.value_json) && answer.value_json.includes(option) ? 1 : 0)
      return total + (answer.value_text === option ? 1 : 0)
    }, 0)
    return {
      option,
      score: Number(question.option_scores?.[option] ?? 0),
      selected,
      percent: responses.length > 0 ? (selected / responses.length) * 100 : 0,
    }
  })
}

export default async function EncuestaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')
  if (!(await canReadSurvey(actor, id))) redirect('/encuestas')

  const admin = createAdminSupabaseClient()
  const [{ data: survey }, { data: questions }, { data: responses }] = await Promise.all([
    admin.from('surveys').select('id, title, description, slug, is_active, allow_anonymous, creator_id, created_at, courses(name)').eq('id', id).single(),
    admin.from('survey_questions').select('id, prompt, question_type, sort_order, max_points, options, option_scores').eq('survey_id', id).order('sort_order'),
    admin.from('survey_responses').select('id, respondent_name, respondent_email, registered_user_id, created_at, earned_points, max_points, achievement_percent, grade, feedback, feedback_updated_at, survey_answers(question_id, value_text, value_json, value_number, awarded_points)').eq('survey_id', id).order('created_at', { ascending: false }),
  ])

  if (!survey) redirect('/encuestas')
  const canEdit = actor.role === 'admin' || survey.creator_id === actor.id
  const normalizedQuestions = (questions ?? []) as SurveyQuestion[]
  const normalizedResponses = responses ?? []
  const questionMap = new Map(normalizedQuestions.map(question => [question.id, question]))
  const closedQuestions = normalizedQuestions.filter(question => ['single', 'multiple'].includes(question.question_type))
  const courseName = survey.courses?.[0]?.name ?? 'Sin curso'
  const totalResponses = normalizedResponses.length
  const averageGrade = totalResponses > 0 ? normalizedResponses.reduce((total, response) => total + Number(response.grade ?? 1), 0) / totalResponses : 0
  const averageAchievement = totalResponses > 0 ? normalizedResponses.reduce((total, response) => total + Number(response.achievement_percent ?? 0), 0) / totalResponses : 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-5"><Link href="/encuestas" className="text-blue-600 text-sm hover:underline">← Volver a Encuestas</Link></div>

        <div className="max-w-7xl space-y-5">
          <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
            <div className="flex flex-wrap justify-between gap-4 items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-xs rounded-full px-2.5 py-1 font-semibold ${survey.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{survey.is_active ? 'Activa' : 'Cerrada'}</span>
                  <span className="text-xs text-gray-400">📚 {courseName}</span>
                </div>
                <h1 className="text-2xl font-bold text-blue-900">{survey.title}</h1>
                {survey.description && <p className="text-gray-500 mt-2 whitespace-pre-wrap">{survey.description}</p>}
              </div>
              {canEdit && <Link href={`/encuestas/${id}/editar`} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">✏️ Editar encuesta</Link>}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5"><p className="text-sm text-gray-500">Respuestas</p><p className="text-2xl font-bold text-blue-900 mt-1">{totalResponses}</p></div>
            <div className="bg-white rounded-xl shadow-sm p-5"><p className="text-sm text-gray-500">Promedio de logro</p><p className="text-2xl font-bold text-blue-900 mt-1">{averageAchievement.toFixed(1)}%</p></div>
            <div className="bg-white rounded-xl shadow-sm p-5"><p className="text-sm text-gray-500">Promedio de notas</p><p className="text-2xl font-bold text-blue-900 mt-1">{totalResponses > 0 ? averageGrade.toFixed(1) : '—'}</p></div>
          </div>

          {closedQuestions.length > 0 && <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
            <div className="mb-4"><h2 className="font-bold text-blue-900">📊 Tendencias por alternativa</h2><p className="text-sm text-gray-500 mt-1">Análisis interno para revisar cómo se distribuyen las respuestas y detectar necesidades de refuerzo.</p></div>
            <div className="space-y-4">{closedQuestions.map((question, index) => {
              const rows = countSelections(question, normalizedResponses)
              return <details key={question.id} className="border border-gray-200 rounded-lg p-4" open={index === 0}>
                <summary className="cursor-pointer font-semibold text-gray-700">{question.sort_order + 1}. {question.prompt}</summary>
                <div className="overflow-x-auto mt-4"><table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-3">Alternativa</th><th className="py-2 px-3 text-right">Puntaje</th><th className="py-2 px-3 text-right">Selecciones</th><th className="py-2 pl-3 text-right">Porcentaje</th></tr></thead>
                  <tbody>{rows.map(row => <tr key={row.option} className="border-b last:border-0"><td className="py-2 pr-3 text-gray-700">{row.option}</td><td className="py-2 px-3 text-right font-semibold text-blue-700">{row.score.toFixed(1)}</td><td className="py-2 px-3 text-right text-gray-700">{row.selected}</td><td className="py-2 pl-3 text-right text-gray-700">{row.percent.toFixed(1)}%</td></tr>)}</tbody>
                </table></div>
              </details>
            })}</div>
          </section>}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 space-y-5">
              <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center mb-4">
                  <div><h2 className="font-bold text-blue-900">🗳️ Respuestas evaluadas</h2><p className="text-sm text-gray-500 mt-1">Puntajes, notas y retroalimentaciones visibles solo para administración y docentes autorizados.</p></div>
                  <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-bold">{totalResponses}</span>
                </div>
                {normalizedResponses.length > 0 ? <div className="space-y-3">{normalizedResponses.map((response: any, index: number) => (
                  <details key={response.id} className="border border-gray-200 rounded-lg p-4 group">
                    <summary className="cursor-pointer list-none flex flex-wrap justify-between gap-3 items-center">
                      <span className="font-semibold text-gray-700">Respuesta {normalizedResponses.length - index} · {response.respondent_name || response.respondent_email || 'Anónima'}</span>
                      <div className="flex flex-wrap gap-2 items-center text-xs">
                        <span className="bg-gray-100 text-gray-700 rounded-full px-2.5 py-1">{Number(response.earned_points ?? 0).toFixed(1)}/{Number(response.max_points ?? 0).toFixed(1)} pts</span>
                        <span className="bg-blue-100 text-blue-700 rounded-full px-2.5 py-1">{Number(response.achievement_percent ?? 0).toFixed(1)}%</span>
                        <span className={`rounded-full px-2.5 py-1 font-bold ${Number(response.grade ?? 1) >= 4 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Nota {Number(response.grade ?? 1).toFixed(1)}</span>
                        <span className="text-gray-400">{new Date(response.created_at).toLocaleString('es-CL')}</span>
                      </div>
                    </summary>
                    <div className="mt-4 space-y-3">
                      {(response.survey_answers ?? []).map((answer: any) => {
                        const question = questionMap.get(answer.question_id)
                        const value = answer.value_json ? answer.value_json.join(', ') : answer.value_number ?? answer.value_text ?? '—'
                        return <div key={answer.question_id} className="bg-gray-50 rounded-lg p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">{question?.prompt ?? 'Pregunta'}</p><span className="text-xs font-bold text-blue-700">{Number(answer.awarded_points ?? 0).toFixed(1)}/{Number(question?.max_points ?? 0).toFixed(1)} pts</span></div><p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{String(value)}</p></div>
                      })}
                      <FeedbackEncuesta responseId={response.id} initialFeedback={response.feedback} />
                    </div>
                  </details>
                ))}</div> : <div className="p-8 text-center text-gray-400">Todavía no hay respuestas.</div>}
              </section>
            </div>

            <aside className="space-y-5">
              <CompartirFormulario slug={survey.slug} />
              <section className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-bold text-blue-900 mb-3">📌 Resumen</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Curso</dt><dd className="font-medium text-gray-700 text-right">{courseName}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Ítems</dt><dd className="font-medium text-gray-700">{normalizedQuestions.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Respuestas</dt><dd className="font-medium text-gray-700">{totalResponses}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Exigencia</dt><dd className="font-medium text-gray-700">60% = 4,0</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Escala</dt><dd className="font-medium text-gray-700">1,0 a 7,0</dd></div>
                </dl>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
