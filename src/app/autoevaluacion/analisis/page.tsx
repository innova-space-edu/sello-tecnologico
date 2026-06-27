import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'
import AnalizadorAutoevaluacion from '@/components/analisis/AnalizadorAutoevaluacion'

type Props = { searchParams: Promise<{ curso?: string; nombre?: string }> }
type CourseRow = { id: string; name: string }

export default async function AnalisisAutoevaluacionPage({ searchParams }: Props) {
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
    .select('id, student_name, project_name, intervention_place, status, created_at, answers, courses(id, name), self_evaluation_formats(title, questions)')
    .order('created_at', { ascending: false })

  if (curso) query = query.eq('course_id', curso)
  if (nombre) query = query.ilike('student_name', `%${nombre}%`)

  const { data: responses } = await query
  const rows = (responses ?? []) as any[]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-5"><Link href="/autoevaluacion/respuestas" className="text-blue-600 text-sm hover:underline">Volver a respuestas</Link></div>
        <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div><p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Analisis</p><h1 className="text-2xl font-bold text-blue-900 mt-1">Analisis de autoevaluaciones</h1><p className="text-gray-500 mt-2">Lectura grupal e individual con graficos donut modernos.</p></div>
            <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-bold self-start">{rows.length} resultados</span>
          </div>
        </section>
        <form className="bg-white rounded-xl shadow-sm p-5 mb-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="text-sm font-medium text-gray-700">Curso<select name="curso" defaultValue={curso} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white"><option value="">Todos los cursos</option>{((courses ?? []) as CourseRow[]).map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
          <label className="text-sm font-medium text-gray-700">Nombre<input name="nombre" defaultValue={nombre} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" placeholder="Buscar estudiante" /></label>
          <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold">Filtrar</button>
        </form>
        <AnalizadorAutoevaluacion rows={rows} />
      </main>
    </div>
  )
}
