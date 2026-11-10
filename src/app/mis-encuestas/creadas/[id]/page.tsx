import Link from 'next/link'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import OnlineSurveyDetail from '@/components/encuestas/OnlineSurveyDetail'
import { getOnlineSurveyActor, isUuid } from '@/lib/online-surveys'

export default async function EncuestaOnlineDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await getOnlineSurveyActor())) redirect('/login')
  if (!isUuid(id)) redirect('/mis-encuestas')
  return <div className="flex min-h-screen bg-slate-50">
    <Sidebar />
    <main className="min-w-0 flex-1 px-4 pb-12 pt-16 lg:ml-64 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/mis-encuestas" className="mb-5 inline-block text-sm font-bold text-blue-700 hover:underline">← Mis encuestas</Link>
        <OnlineSurveyDetail id={id} />
      </div>
    </main>
  </div>
}
