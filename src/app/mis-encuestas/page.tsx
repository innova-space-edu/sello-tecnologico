import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

type AssignedSurvey = {
  survey_id: string
  surveys?: {
    id: string
    title: string
    description?: string | null
    slug: string
    is_active: boolean
    created_at: string
    courses?: { name?: string | null }[] | null
  } | null
}

export default async function MisEncuestasPage() {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')

  const admin = createAdminSupabaseClient()
  const [{ data: assigned }, { data: responses }] = await Promise.all([
    admin.from('survey_students').select('survey_id, surveys(id, title, description, slug, is_active, created_at, courses(name))').eq('student_id', actor.id).order('created_at', { ascending: false }),
    admin.from('survey_responses').select('id, survey_id, earned_points, max_points, achievement_percent, grade, feedback, feedback_updated_at, created_at').eq('registered_user_id', actor.id).order('created_at', { ascending: false }),
  ])

  const latestBySurvey = new Map<string, any>()
  for (const response of responses ?? []) {
    if (!latestBySurvey.has(response.survey_id)) latestBySurvey.set(response.survey_id, response)
  }

  const rows = (assigned ?? []) as unknown as AssignedSurvey[]
  const pending = rows.filter(row => !latestBySurvey.has(row.survey_id)).length
  const completed = rows.length - pending

  return <div className="flex min-h-screen bg-gray-50">
    <Sidebar />
    <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
      <div className="mb-6"><h1 className="text-2xl font-bold text-blue-900">Mis encuestas</h1><p className="text-gray-500 mt-1">Revisa tus encuestas asignadas, resultados y retroalimentaciones.</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5"><p className="text-sm text-gray-500">Encuestas asignadas</p><p className="text-2xl font-bold text-blue-900 mt-1">{rows.length}</p></div>
        <div className="bg-white rounded-xl shadow-sm p-5"><p className="text-sm text-gray-500">Pendientes</p><p className="text-2xl font-bold text-yellow-700 mt-1">{pending}</p></div>
        <div className="bg-white rounded-xl shadow-sm p-5"><p className="text-sm text-gray-500">Respondidas</p><p className="text-2xl font-bold text-green-700 mt-1">{completed}</p></div>
      </div>

      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        {rows.length > 0 ? <div className="divide-y divide-gray-100">{rows.map(row => {
          const survey = row.surveys
          const response = latestBySurvey.get(row.survey_id)
          const courseName = survey?.courses?.[0]?.name ?? 'Sin curso'
          return <div key={row.survey_id} className="px-5 lg:px-6 py-5">
            <div className="flex flex-wrap justify-between gap-4 items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2 items-center mb-2"><span className={`text-xs rounded-full px-2.5 py-1 font-semibold ${response ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{response ? 'Respondida' : 'Pendiente'}</span><span className="text-xs text-gray-400">📚 {courseName}</span></div>
                <h2 className="font-bold text-gray-800">{survey?.title ?? 'Encuesta'}</h2>
                {survey?.description && <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{survey.description}</p>}
                {response?.feedback && <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3"><p className="text-xs uppercase tracking-wide font-semibold text-blue-500">Retroalimentación docente</p><p className="text-sm text-blue-900 mt-1 whitespace-pre-wrap">{response.feedback}</p></div>}
              </div>
              <div className="shrink-0 text-right">
                {response ? <><p className="text-sm font-bold text-blue-700">{Number(response.earned_points ?? 0).toFixed(1)}/{Number(response.max_points ?? 0).toFixed(1)} pts</p><p className="text-sm text-gray-500 mt-1">{Number(response.achievement_percent ?? 0).toFixed(1)}% de logro</p><p className={`inline-block mt-2 rounded-full px-3 py-1 text-sm font-bold ${Number(response.grade ?? 1) >= 4 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Nota {Number(response.grade ?? 1).toFixed(1)}</p><div><Link href={`/mis-encuestas/${row.survey_id}`} className="inline-block mt-3 text-sm font-semibold text-blue-600 hover:underline">Ver resultado completo →</Link></div></> : survey?.is_active ? <Link href={`/formularios/${survey.slug}`} className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">Responder encuesta</Link> : <span className="text-sm text-gray-400">Encuesta cerrada</span>}
              </div>
            </div>
          </div>
        })}</div> : <div className="p-12 text-center text-gray-400">Todavía no tienes encuestas asignadas.</div>}
      </section>
    </main>
  </div>
}
