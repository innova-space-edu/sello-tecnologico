import Sidebar from '@/components/Sidebar'
import ReportEditorFinal from '@/components/informes/ReportEditorFinal'

export default async function InformeDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <div className="flex min-h-screen bg-gray-50">
    <Sidebar />
    <main className="min-w-0 flex-1 p-4 pt-16 lg:ml-64 lg:p-8 lg:pt-8">
      <ReportEditorFinal reportId={id} />
    </main>
  </div>
}
