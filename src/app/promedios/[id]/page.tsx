import { notFound, redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import LightSpreadsheet from '@/components/promedios/LightSpreadsheet'
import PromediosHistory from '@/components/promedios/PromediosHistory'
import PromediosKeyboardNavigation from '@/components/promedios/PromediosKeyboardNavigation'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPromediosActor } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function PromediosEditorPage({ params }: Props) {
  const actor = await getPromediosActor()
  if (!actor) redirect('/dashboard')

  const { id } = await params
  const admin = createAdminSupabaseClient()
  const { data: workbook } = await admin
    .from('promedios_workbooks')
    .select('id, title, owner_id')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle()

  if (!workbook || (actor.role !== 'admin' && workbook.owner_id !== actor.id)) notFound()

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <Sidebar />
      <LightSpreadsheet workbookId={workbook.id} title={workbook.title} />
      <PromediosKeyboardNavigation />
      <PromediosHistory workbookId={workbook.id} />
    </div>
  )
}
