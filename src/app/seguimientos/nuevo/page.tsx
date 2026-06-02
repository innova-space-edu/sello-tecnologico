import Sidebar from '@/components/Sidebar'
import SeguimientoForm from '@/components/seguimientos/SeguimientoForm'
import Link from 'next/link'

export default function NuevoSeguimientoPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href="/seguimientos" className="text-blue-600 text-sm hover:underline">← Volver a Seguimiento</Link>
          <h1 className="text-2xl font-bold text-blue-900 mt-2">Nueva sesión de seguimiento</h1>
          <p className="text-gray-500 mt-1">Evalúa el avance del proyecto y deja retroalimentación visible para los estudiantes seleccionados.</p>
        </div>
        <div className="max-w-6xl">
          <SeguimientoForm />
        </div>
      </main>
    </div>
  )
}
