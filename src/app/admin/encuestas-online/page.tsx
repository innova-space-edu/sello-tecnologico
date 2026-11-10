import Link from 'next/link'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import OnlineSurveyModeration from '@/components/encuestas/OnlineSurveyModeration'
import { requireAdminSession } from '@/lib/admin-auth'

export default async function ModerarEncuestasOnlinePage() {
  try { await requireAdminSession() } catch { redirect('/dashboard') }
  return <div className="flex min-h-screen bg-slate-50">
    <Sidebar />
    <main className="min-w-0 flex-1 px-4 pb-12 pt-16 lg:ml-64 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="mb-5 inline-block text-sm font-bold text-blue-700">← Panel Admin</Link>
        <header className="mb-6 rounded-2xl bg-blue-900 p-6 text-white">
          <h1 className="text-2xl font-black">Encuestas en línea · Revisión</h1>
          <p className="mt-2 text-sm text-blue-100">Aprueba o rechaza encuestas creadas por estudiantes antes de habilitar sus enlaces públicos y códigos QR.</p>
        </header>
        <OnlineSurveyModeration />
      </div>
    </main>
  </div>
}
