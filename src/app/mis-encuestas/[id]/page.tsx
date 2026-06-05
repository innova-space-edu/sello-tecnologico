import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

export default async function MiEncuestaDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')
  const admin = createAdminSupabaseClient()
  const { data: assignment } = await admin.from('survey_students').select('survey_id, surveys(id,title,description,slug,is_active,courses(name))').eq('survey_id', id).eq('student_id', actor.id).maybeSingle()
  if (!assignment?.surveys) redirect('/mis-encuestas')
  const survey: any = Array.isArray(assignment.surveys) ? assignment.surveys[0] : assignment.surveys
  const [{ data: response }, { data: questions }] = await Promise.all([
    admin.from('survey_responses').select('id,earned_points,max_points,achievement_percent,grade,feedback,created_at,survey_answers(question_id,value_text,value_json,value_number,awarded_points)').eq('survey_id', id).eq('registered_user_id', actor.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('survey_questions').select('id,prompt,max_points').eq('survey_id', id).order('sort_order'),
  ])
  const q = new Map((questions ?? []).map(row => [row.id, row]))
  const course = Array.isArray(survey.courses) ? survey.courses[0]?.name : survey.courses?.name
  return <div className="flex min-h-screen bg-gray-50"><Sidebar /><main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8"><div className="max-w-5xl space-y-5">
    <Link href="/mis-encuestas" className="text-blue-600 text-sm hover:underline">← Volver a Mis encuestas</Link>
    <section className="bg-white rounded-xl shadow-sm p-5"><p className="text-xs text-gray-400">📚 {course ?? 'Sin curso'}</p><h1 className="text-2xl font-bold text-blue-900 mt-1">{survey.title}</h1>{survey.description && <p className="text-gray-500 mt-2">{survey.description}</p>}</section>
    {!response ? <section className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-yellow-800">Encuesta pendiente. {survey.is_active && <Link href={`/formularios/${survey.slug}`} className="ml-2 text-blue-700 font-semibold underline">Responder ahora</Link>}</section> : <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="bg-white rounded-xl shadow-sm p-5">Puntaje<br/><b className="text-2xl text-blue-900">{Number(response.earned_points).toFixed(1)}/{Number(response.max_points).toFixed(1)}</b></div><div className="bg-white rounded-xl shadow-sm p-5">Logro<br/><b className="text-2xl text-blue-900">{Number(response.achievement_percent).toFixed(1)}%</b></div><div className="bg-white rounded-xl shadow-sm p-5">Nota<br/><b className="text-2xl text-blue-900">{Number(response.grade).toFixed(1)}</b></div></div>
      {response.feedback && <section className="bg-blue-50 border border-blue-100 rounded-xl p-5"><b className="text-blue-900">Retroalimentación docente</b><p className="mt-2 text-blue-900 whitespace-pre-wrap">{response.feedback}</p></section>}
      <section className="bg-white rounded-xl shadow-sm p-5"><h2 className="font-bold text-blue-900 mb-3">📊 Desglose por pregunta</h2><div className="space-y-3">{(response.survey_answers ?? []).map((a:any) => { const question:any=q.get(a.question_id); const value=a.value_json ? a.value_json.join(', ') : a.value_number ?? a.value_text ?? '—'; return <div key={a.question_id} className="bg-gray-50 rounded-lg p-3"><div className="flex justify-between gap-2"><b className="text-sm text-gray-700">{question?.prompt ?? 'Pregunta'}</b><span className="text-xs font-bold text-blue-700">{Number(a.awarded_points).toFixed(1)}/{Number(question?.max_points ?? 0).toFixed(1)} pts</span></div><p className="text-sm text-gray-500 mt-1">{String(value)}</p></div>})}</div></section>
    </>}
  </div></main></div>
}
