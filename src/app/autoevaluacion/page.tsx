import Sidebar from '@/components/Sidebar'
import AutoevaluacionForm from '@/components/autoevaluacion/AutoevaluacionForm'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

export default async function AutoevaluacionPage() {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')

  const admin = createAdminSupabaseClient()
  const { data: courses } = await admin
    .from('courses')
    .select('id, name')
    .order('name', { ascending: true })

  const canReview = ['admin', 'docente'].includes(actor.role)
  const canManageFormats = ['admin', 'docente', 'coordinador'].includes(actor.role)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="max-w-5xl mx-auto mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Nueva sección</p>
            <h1 className="text-2xl font-bold text-blue-900">Autoevaluación STEAM</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {canReview && (
              <Link href="/autoevaluacion/respuestas" className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-semibold">
                Ver respuestas guardadas
              </Link>
            )}
          </div>
        </div>

        <section className="max-w-5xl mx-auto mb-5 bg-white rounded-2xl shadow-sm p-5 lg:p-6 border border-blue-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Formatos de autoevaluación</p>
              <h2 className="text-xl font-bold text-blue-900 mt-1">Usar, copiar o crear formatos</h2>
              <p className="text-sm text-gray-500 mt-1">
                Desde aquí puedes abrir la autoevaluación actual, editar una copia reutilizable o crear otro formato con nuevas formas de evaluarse.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2 shrink-0">
              <a href="#autoevaluacion-actual" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold text-center">
                Responder autoevaluación actual
              </a>
              {canManageFormats && (
                <>
                  <Link href="/autoevaluacion/formatos/copiar" className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-4 py-2.5 rounded-xl text-sm font-semibold text-center">
                    Editar copia del formato
                  </Link>
                  <Link href="/autoevaluacion/formatos/nuevo" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold text-center">
                    Crear nuevo formato
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        <div id="autoevaluacion-actual" className="scroll-mt-24">
          <AutoevaluacionForm actor={actor} courses={(courses ?? []) as { id: string; name: string }[]} />
        </div>
      </main>
    </div>
  )
}
