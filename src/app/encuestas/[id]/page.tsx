import Sidebar from '@/components/Sidebar'
import CompartirEncuesta from '@/components/encuestas/CompartirEncuesta'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canReadSurvey, getSurveyActor } from '@/lib/survey-auth'

export default async function EncuestaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')
  if (!(await canReadSurvey(actor, id))) redirect('/encuestas')

  const admin = createAdminSupabaseClient()
  const [{ data: survey }, { data: questions }, { data: responses }] = await Promise.all([
    admin.from('surveys').select('id, title, description, slug, is_active, allow_anonymous, creator_id, created_at, courses(name)').eq('id', id).single(),
    admin.from('survey_questions').select('id, prompt, question_type, sort_order').eq('survey_id', id).order('sort_order'),
    admin.from('survey_responses').select('id, respondent_name, respondent_email, registered_user_id, created_at, survey_answers(question_id, value_text, value_json, value_number)').eq('survey_id', id).order('created_at', { ascending: false }),
  ])

  if (!survey) redirect('/encuestas')
  const canEdit = actor.role === 'admin' || survey.creator_id === actor.id
  const questionMap = new Map((questions ?? []).map(question => [question.id, question]))

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
                  <span className="text-xs text-gray-400">📚 {survey.courses?.name ?? 'Sin curso'}</span>
                </div>
                <h1 className="text-2xl font-bold text-blue-900">{survey.title}</h1>
                {survey.description && <p className="text-gray-500 mt-2 whitespace-pre-wrap">{survey.description}</p>}
              </div>
              {canEdit && <Link href={`/encuestas/${id}/editar`} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">✏️ Editar encuesta</Link>}
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 space-y-5">
              <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center mb-4">
                  <div><h2 className="font-bold text-blue-900">🗳️ Respuestas recibidas</h2><p className="text-sm text-gray-500 mt-1">Solo visible para administración y docentes autorizados.</p></div>
                  <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-bold">{responses?.length ?? 0}</span>
                </div>
                {responses && responses.length > 0 ? <div className="space-y-3">{responses.map((response: any, index: number) => (
                  <details key={response.id} className="border border-gray-200 rounded-lg p-4 group">
                    <summary className="cursor-pointer list-none flex flex-wrap justify-between gap-2 items-center">
                      <span className="font-semibold text-gray-700">Respuesta {responses.length - index} · {response.respondent_name || response.respondent_email || 'Anónima'}</span>
                      <span className="text-xs text-gray-400">{new Date(response.created_at).toLocaleString('es-CL')}</span>
                    </summary>
                    <div className="mt-4 space-y-3">
                      {(response.survey_answers ?? []).map((answer: any) => {
                        const question = questionMap.get(answer.question_id)
                        const value = answer.value_json ? answer.value_json.join(', ') : answer.value_number ?? answer.value_text ?? '—'
                        return <div key={answer.question_id} className="bg-gray-50 rounded-lg p-3"><p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">{question?.prompt ?? 'Pregunta'}</p><p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{String(value)}</p></div>
                      })}
                    </div>
                  </details>
                ))}</div> : <div className="p-8 text-center text-gray-400">Todavía no hay respuestas.</div>}
              </section>
            </div>

            <aside className="space-y-5">
              <CompartirEncuesta slug={survey.slug} />
              <section className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-bold text-blue-900 mb-3">📌 Resumen</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Curso</dt><dd className="font-medium text-gray-700 text-right">{survey.courses?.name ?? '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Ítems</dt><dd className="font-medium text-gray-700">{questions?.length ?? 0}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Respuestas</dt><dd className="font-medium text-gray-700">{responses?.length ?? 0}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Anónimas</dt><dd className="font-medium text-gray-700">{survey.allow_anonymous ? 'Permitidas' : 'No permitidas'}</dd></div>
                </dl>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
