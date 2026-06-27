import Sidebar from '@/components/Sidebar'
import AutoevaluacionForm from '@/components/autoevaluacion/AutoevaluacionForm'
import AutoevaluacionFormatosPanel from '@/components/autoevaluacion/AutoevaluacionFormatosPanel'
import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'
import {
  DEFAULT_AUTOEVALUACION_FORMAT,
  DEFAULT_AUTOEVALUACION_FORMAT_ID,
  normalizeAutoevaluacionQuestions,
  AutoevaluacionFormat,
} from '@/lib/autoevaluacion'

type SearchParams = Promise<{ formato?: string }>

type Course = { id: string; name: string }
type Student = { id: string; full_name?: string | null; email?: string | null; curso?: string | null }

type SavedFormatRow = {
  id: string
  title: string
  description?: string | null
  questions: unknown
  source?: string | null
  created_at?: string | null
}

export default async function AutoevaluacionPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')

  const params = await searchParams
  const requestedFormatId = params?.formato ?? DEFAULT_AUTOEVALUACION_FORMAT_ID

  const admin = createAdminSupabaseClient()
  const [{ data: courses }, { data: savedFormats }, { data: students }] = await Promise.all([
    admin
      .from('courses')
      .select('id, name')
      .order('name', { ascending: true }),
    admin
      .from('self_evaluation_formats')
      .select('id, title, description, questions, source, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false }),
    admin
      .from('profiles')
      .select('id, full_name, email, curso')
      .eq('role', 'estudiante')
      .order('full_name', { ascending: true }),
  ])

  const canManageFormats = ['admin', 'docente', 'coordinador'].includes(actor.role)
  const canReview = ['admin', 'docente'].includes(actor.role)

  const savedFormatList = ((savedFormats ?? []) as SavedFormatRow[]).map(format => ({
    id: format.id,
    title: format.title,
    description: format.description,
    questions: normalizeAutoevaluacionQuestions(format.questions),
    source: format.source,
    created_at: format.created_at,
    isDefault: false,
  }))

  const formatsForPanel = [
    {
      id: DEFAULT_AUTOEVALUACION_FORMAT_ID,
      title: DEFAULT_AUTOEVALUACION_FORMAT.title,
      description: DEFAULT_AUTOEVALUACION_FORMAT.description,
      questions: DEFAULT_AUTOEVALUACION_FORMAT.questions,
      source: 'default',
      created_at: null,
      isDefault: true,
    },
    ...savedFormatList,
  ]

  const selectedSavedFormat = savedFormatList.find(format => format.id === requestedFormatId)
  const selectedFormat: AutoevaluacionFormat = selectedSavedFormat
    ? {
      id: selectedSavedFormat.id,
      title: selectedSavedFormat.title,
      description: selectedSavedFormat.description,
      questions: selectedSavedFormat.questions,
    }
    : DEFAULT_AUTOEVALUACION_FORMAT

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="max-w-5xl mx-auto mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Nueva sección</p>
            <h1 className="text-2xl font-bold text-blue-900">Autoevaluación STEAM</h1>
            <p className="text-gray-500 mt-1">Gestiona formatos, envía avisos y revisa respuestas de autoevaluación.</p>
          </div>
          {canReview && (
            <a href="/autoevaluacion/respuestas" className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-semibold w-fit">
              Ver respuestas guardadas
            </a>
          )}
        </div>

        <AutoevaluacionFormatosPanel
          formats={formatsForPanel}
          courses={(courses ?? []) as Course[]}
          students={(students ?? []) as Student[]}
          canManageFormats={canManageFormats}
        />

        <div id="autoevaluacion-actual" className="scroll-mt-24">
          <AutoevaluacionForm
            actor={actor}
            courses={(courses ?? []) as Course[]}
            selectedFormat={selectedFormat}
          />
        </div>
      </main>
    </div>
  )
}
