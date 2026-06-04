import Sidebar from '@/components/Sidebar'
import EncuestaBuilder from '@/components/encuestas/EncuestaBuilder'
import Link from 'next/link'

export default function NuevaEncuestaPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href="/encuestas" className="text-blue-600 text-sm hover:underline">← Volver a Encuestas</Link>
          <h1 className="text-2xl font-bold text-blue-900 mt-2">Nueva encuesta</h1>
          <p className="text-gray-500 mt-1">Crea preguntas editables, asocia un curso y comparte la encuesta mediante enlace o QR.</p>
        </div>
        <div className="max-w-6xl"><EncuestaBuilder /></div>
      </main>
    </div>
  )
}
