import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

type Props = {
  searchParams: Promise<{ curso?: string; nombre?: string }>
}

type CourseRow = { id: string; name: string }
type CourseValue = { id?: string | null; name?: string | null }
type CourseRelation = CourseValue | CourseValue[] | null
type SelfEvaluationListRow = {
  id: string
  student_name: string
  project_name: string
  intervention_place: string
  status: string | null
  created_at: string
  courses?: CourseRelation
}

function getCourseName(courses: CourseRelation) {
  if (Array.isArray(courses)) return courses[0]?.name ?? null
  return courses?.name ?? null
}

export default async function AutoevaluacionRespuestasPage({ searchParams }: Props) {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')
  if (!['admin', 'docente'].includes(actor.role)) redirect('/autoevaluacion')

  const params = await searchParams
  const curso = String(params.curso ?? '')
  const nombre = String(params.nombre ?? '').trim()

  const admin = createAdminSupabaseClient()
  const { data: courses } = await admin.from('courses').select('id, name').order('name', { ascending: true })

  let query = admin
    .from('self_evaluations')
    .select('id, student_name, project_name, intervention_place, status, created_at, courses(id, name), profiles(full_name, email)')
    .order('created_at', { ascending: false })

  if (curso) query = query.eq('course_id', curso)
  if (nombre) query = query.ilike('student_name', `%${nombre}%`)

  const { data: responses } = await query

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-5">
          <Link href="/autoevaluacion" className="text-blue-600 text-sm hover:underline">← Volver a Autoevaluación</Link>
        </div>

        <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Docentes y administración</p>
              <h1 className="text-2xl font-bold text-blue-900 mt-1">Respuestas de autoevaluación</h1>
              <p className="text-gray-500 mt-2">Filtra por curso o nombre para revisar cada encuesta enviada por los estudiantes.</p>
            </div>
            <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-bold self-start">{responses?.length ?? 0} resultados</span>
          </div>
        </section>

        <form className="bg-white rounded-xl shadow-sm p-5 mb-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="text-sm font-medium text-gray-700">Curso
            <select name="curso" defaultValue={curso} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white">
              <option value="">Todos los cursos</option>
              {((courses ?? []) as CourseRow[]).map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Nombre estudiante
            <input name="nombre" defaultValue={nombre} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" placeholder="Buscar por nombre" />
          </label>
          <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold">Filtrar</button>
        </form>

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          {responses && responses.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {((responses ?? []) as SelfEvaluationListRow[]).map(response => {
                const courseName = getCourseName(response.courses ?? null)
                return (
                  <Link key={response.id} href={`/autoevaluacion/respuestas/${response.id}`} className="block px-5 lg:px-6 py-5 hover:bg-blue-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-1 font-semibold">Enviada</span>
                          <span className="text-xs text-gray-400">📚 {courseName ?? 'Sin curso'}</span>
                          <span className="text-xs text-gray-400">🕐 {new Date(response.created_at).toLocaleString('es-CL')}</span>
                        </div>
                        <h2 className="font-bold text-gray-800">{response.student_name}</h2>
                        <p className="text-sm text-gray-500 mt-1">{response.project_name} · {response.intervention_place}</p>
                      </div>
                      <span className="text-blue-600 text-sm font-semibold">Ver encuesta →</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">
              <div className="text-5xl mb-3">📝</div>
              <h2 className="text-lg font-semibold text-gray-700">No hay autoevaluaciones con esos filtros</h2>
              <p className="mt-2">Prueba con otro curso o deja el nombre vacío.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
