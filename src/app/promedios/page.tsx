import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PromediosWorkspace from '@/components/promedios/PromediosWorkspace'
import { getPromediosActor } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

export default async function PromediosPage() {
  const actor = await getPromediosActor()
  if (!actor) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <PromediosWorkspace />
      </main>
    </div>
  )
}
