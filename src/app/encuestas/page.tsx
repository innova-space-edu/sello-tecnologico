import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canManageSurveys, getSurveyActor } from '@/lib/survey-auth'

export default async function EncuestasPage() {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')
  if (!canManageSurveys(actor)) redirect('/dashboard')

  const admin = createAdminSupabaseClient()
  let query = admin
    .from('surveys')
    .select('id, title, slug, description, is_active, created_at, creator_id, courses(name), survey_responses(count)')
    .order('created_at', { ascending: false })

  if (actor.role !== 'admin') {
    const { data: accessRows } = await admin
      .from('survey_course_staff')
      .select('survey_id')
      .eq('teacher_id', actor.id)
    const ids = Array.from(new Set((accessRows ?? []).map(row => row.survey_id)))
    if (ids.length === 0) {
      query = query.eq('creator_id', actor.id)
    } else {
      query = query.or(`creator_id.eq.${actor.id},id.in.(${ids.join(',')})`)
    }
  }

  const { data: surveys } = await query

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex flex-wrap justify-between gap-4 items-start mb-7">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Encuestas</h1>
            <p className="text-gray-500 mt-1">Crea formularios, comparte enlaces o QR y revisa opiniones por curso.</p>
          </div>
          <Link href="/encuestas/nuevo" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">+ Nueva encuesta</Link>
        </div>

        {surveys && surveys.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {surveys.map((survey: any) => (
              <Link key={survey.id} href={`/encuestas/${survey.id}`} className="bg-white rounded-xl shadow-sm p-5 border border-transparent hover:border-blue-300 transition-colors">
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <h2 className="font-bold text-blue-900">{survey.title}</h2>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{survey.description || 'Sin descripción'}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2.5 py-1 font-semibold ${survey.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{survey.is_active ? 'Activa' : 'Cerrada'}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-4">
                  <span>📚 {survey.courses?.name ?? 'Sin curso'}</span>
                  <span>🗳️ {survey.survey_responses?.[0]?.count ?? 0} respuestas</span>
                  <span>🔗 /encuesta/{survey.slug}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
            <div className="text-5xl mb-3">🗳️</div>
            <h2 className="text-lg font-semibold text-gray-700">Todavía no hay encuestas</h2>
            <p className="mt-2">Crea una encuesta para comenzar a recopilar opiniones.</p>
          </div>
        )}
      </main>
    </div>
  )
}
