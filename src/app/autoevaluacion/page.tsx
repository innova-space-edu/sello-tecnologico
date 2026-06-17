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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="max-w-5xl mx-auto mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Nueva sección</p>
            <h1 className="text-2xl font-bold text-blue-900">Autoevaluación STEAM</h1>
          </div>
          {canReview && (
            <Link href="/autoevaluacion/respuestas" className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-semibold">
              Ver respuestas guardadas
            </Link>
          )}
        </div>
        <AutoevaluacionForm actor={actor} courses={(courses ?? []) as { id: string; name: string }[]} />
      </main>
    </div>
  )
}
