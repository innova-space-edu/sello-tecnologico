import Link from 'next/link'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import OnlineSurveyBuilder from '@/components/encuestas/OnlineSurveyBuilder'
import { getOnlineSurveyActor } from '@/lib/online-surveys'

export default async function CrearEncuestaOnlinePage() {
  if (!(await getOnlineSurveyActor())) redirect('/login')
  return <div className="flex min-h-screen bg-slate-50">
    <Sidebar />
    <main className="min-w-0 flex-1 px-4 pb-12 pt-16 lg:ml-64 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/mis-encuestas" className="mb-5 inline-block text-sm font-bold text-blue-700 hover:underline">← Mis encuestas</Link>
        <OnlineSurveyBuilder />
      </div>
    </main>
  </div>
}
