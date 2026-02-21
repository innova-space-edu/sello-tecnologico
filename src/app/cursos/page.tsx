import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function CursosPage() {
  const supabase = await createServerSupabaseClient()
  const { data: cursos } = await supabase.from('courses').select('*').order('created_at', { ascending: false })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Cursos</h1>
            <p className="text-gray-500 mt-1">Gestiona los cursos del Sello Tecnológico</p>
          </div>
          <Link
            href="/cursos/nuevo"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            + Nuevo curso
          </Link>
        </div>

        {cursos && cursos.length > 0 ? (
          <div className="grid grid-cols-2 gap-6">
            {cursos.map((curso) => (
              <Link
                key={curso.id}
                href={`/cursos/${curso.id}`}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md hover:border-blue-300 border border-transparent transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-blue-900">{curso.name}</h2>
                    <p className="text-gray-500 text-sm mt-1">{curso.level} — {curso.area}</p>
                    <p className="text-gray-400 text-xs mt-2">Año {curso.year}</p>
                  </div>
                  <span className="text-2xl">📚</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-lg font-semibold text-gray-700">No hay cursos aún</h3>
            <p className="text-gray-400 mt-2">Crea el primer curso para comenzar</p>
            <Link
              href="/cursos/nuevo"
              className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              + Crear curso
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
