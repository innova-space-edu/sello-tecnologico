import Sidebar from '@/components/Sidebar'
import SeguimientoForm from '@/components/seguimientos/SeguimientoForm'
import Link from 'next/link'

export default async function EditarSeguimientoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href={`/seguimientos/${id}`} className="text-blue-600 text-sm hover:underline">← Volver a la ficha</Link>
          <h1 className="text-2xl font-bold text-blue-900 mt-2">Editar seguimiento</h1>
          <p className="text-gray-500 mt-1">Actualiza participantes, evaluación, retroalimentación o fotografías.</p>
        </div>
        <div className="max-w-6xl">
          <SeguimientoForm sessionId={id} />
        </div>
      </main>
    </div>
  )
}
