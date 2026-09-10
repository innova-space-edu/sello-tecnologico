import { notFound, redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import OnlyOfficeSpreadsheet from '@/components/promedios/OnlyOfficeSpreadsheet'
import PromediosHistory from '@/components/promedios/PromediosHistory'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPromediosActor } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

const fallbackTools = [
  'Fuente', 'Tamaño', 'B', 'I', 'U', 'Color texto', 'Relleno', 'Alinear', 'Combinar',
  'Imagen', 'Gráfico', 'Figura', 'Enlace', 'QR', 'Carta/A4/Oficio', 'Vertical', 'Horizontal', 'Hoja curso',
]

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

  const onlyOfficeConfigured = Boolean(process.env.ONLYOFFICE_URL || process.env.NEXT_PUBLIC_ONLYOFFICE_URL)

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        {!onlyOfficeConfigured && (
          <div className="sticky top-0 z-40 overflow-x-auto border-b border-amber-200 bg-white shadow-sm">
            <div className="flex min-w-max items-center gap-1 px-3 py-2">
              <span className="mr-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Barra de herramientas</span>
              {fallbackTools.map((tool) => (
                <span key={tool} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-500" title="Se habilita con ONLYOFFICE_URL">
                  {tool}
                </span>
              ))}
              <span className="ml-2 rounded-md bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">Modo ligero: las herramientas avanzadas se habilitan al conectar ONLYOFFICE.</span>
            </div>
          </div>
        )}
        <OnlyOfficeSpreadsheet workbookId={workbook.id} title={workbook.title} />
      </div>
      <PromediosHistory workbookId={workbook.id} />
    </div>
  )
}
