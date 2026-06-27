import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AUTOEVALUACION_QUESTIONS, getAnswerDisplayValue, getAutoevaluacionSections, normalizeAutoevaluacionQuestions } from '@/lib/autoevaluacion'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

type CourseValue = { name?: string | null }
type CourseRelation = CourseValue | CourseValue[] | null
type FormatValue = { title?: string | null; questions?: unknown }
type FormatRelation = FormatValue | FormatValue[] | null

function getCourseName(courses: CourseRelation) {
  if (Array.isArray(courses)) return courses[0]?.name ?? null
  return courses?.name ?? null
}

function getFormat(format: FormatRelation) {
  if (Array.isArray(format)) return format[0] ?? null
  return format ?? null
}

export default async function AutoevaluacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')

  const admin = createAdminSupabaseClient()
  const { data: response } = await admin
    .from('self_evaluations')
    .select('id, user_id, student_name, project_name, intervention_place, answers, confirmed, status, created_at, courses(name), profiles(full_name, email, role), self_evaluation_formats(title, questions)')
    .eq('id', id)
    .single()

  if (!response) redirect('/autoevaluacion')

  const canReview = ['admin', 'docente'].includes(actor.role)
  if (!canReview && response.user_id !== actor.id) redirect('/autoevaluacion')

  const courseName = getCourseName(response.courses as CourseRelation)
  const format = getFormat((response as any).self_evaluation_formats as FormatRelation)
  const dynamicQuestions = normalizeAutoevaluacionQuestions(format?.questions)
  const questions = dynamicQuestions.length > 0 ? dynamicQuestions : AUTOEVALUACION_QUESTIONS
  const formatTitle = format?.title ?? 'Autoevaluación STEAM'
  const answers = response.answers && typeof response.answers === 'object' && !Array.isArray(response.answers)
    ? response.answers as Record<string, unknown>
    : {}
  const sections = getAutoevaluacionSections(questions)
  const ratingQuestions = questions.filter(question => question.type === 'rating')
  const ratingValues = ratingQuestions
    .map(question => Number(answers[question.id]))
    .filter(value => Number.isFinite(value))
  const averageRating = ratingValues.length > 0
    ? ratingValues.reduce((total, value) => total + value, 0) / ratingValues.length
    : 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="max-w-6xl mx-auto space-y-5">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <Link href={canReview ? '/autoevaluacion/respuestas' : '/autoevaluacion'} className="text-blue-600 text-sm hover:underline">← Volver</Link>
          </div>

          <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-1 font-semibold">{response.status ?? 'enviada'}</span>
                  <span className="text-xs text-gray-400">📚 {courseName ?? 'Sin curso'}</span>
                  <span className="text-xs text-gray-400">🕐 {new Date(response.created_at).toLocaleString('es-CL')}</span>
                </div>
                <h1 className="text-2xl font-bold text-blue-900">Autoevaluación de {response.student_name}</h1>
                <p className="text-gray-500 mt-2">{formatTitle} · {response.project_name} · {response.intervention_place}</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-center min-w-36">
                <p className="text-xs text-blue-500 font-semibold uppercase">Promedio autoevaluación</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{averageRating ? averageRating.toFixed(1) : '—'}/4</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <aside className="space-y-4">
              <section className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-bold text-blue-900 mb-3">📌 Resumen</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Estudiante</dt><dd className="font-medium text-gray-800 text-right">{response.student_name}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Curso</dt><dd className="font-medium text-gray-800 text-right">{courseName ?? '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Formato</dt><dd className="font-medium text-gray-800 text-right">{formatTitle}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Proyecto</dt><dd className="font-medium text-gray-800 text-right">{response.project_name}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Lugar</dt><dd className="font-medium text-gray-800 text-right">{response.intervention_place}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Confirmada</dt><dd className="font-medium text-gray-800 text-right">{response.confirmed ? 'Sí' : 'No'}</dd></div>
                </dl>
              </section>
            </aside>

            <section className="lg:col-span-2 space-y-5">
              {sections.map(section => (
                <div key={section} className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
                  <h2 className="font-bold text-blue-900 mb-4">{section}</h2>
                  <div className="space-y-3">
                    {questions.filter(question => question.section === section).map(question => {
                      const value = answers[question.id]
                      const isRating = question.type === 'rating'
                      return (
                        <article key={question.id} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-800">{question.prompt}</p>
                            {isRating && <span className="shrink-0 bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-bold">{getAnswerDisplayValue(value)}/4</span>}
                          </div>
                          {!isRating && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{getAnswerDisplayValue(value)}</p>}
                        </article>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
