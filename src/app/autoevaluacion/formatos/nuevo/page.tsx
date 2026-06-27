import Sidebar from '@/components/Sidebar'
import FormatoAutoevaluacionEditor from '@/components/autoevaluacion/FormatoAutoevaluacionEditor'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSurveyActor } from '@/lib/survey-auth'

export default async function NuevoFormatoAutoevaluacionPage() {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')

  const canEdit = ['admin', 'docente', 'coordinador'].includes(actor.role)
  if (!canEdit) redirect('/autoevaluacion')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="max-w-5xl mx-auto mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <Link href="/autoevaluacion" className="text-blue-600 text-sm hover:underline">← Volver a autoevaluación</Link>
            <h1 className="text-2xl font-bold text-blue-900 mt-2">Crear otro formato de autoevaluación</h1>
            <p className="text-gray-500 mt-1">Diseña una nueva forma de evaluarse con preguntas escritas, escala, selección única o selección múltiple.</p>
          </div>
        </div>
        <FormatoAutoevaluacionEditor mode="new" />
      </main>
    </div>
  )
}
