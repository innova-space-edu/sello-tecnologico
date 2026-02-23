'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CursosPage() {
  const supabase = createClient()
  const router = useRouter()
  const [cursos, setCursos] = useState<any[]>([])

  const fetchCursos = async () => {
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
    setCursos(data ?? [])
  }

  useEffect(() => { fetchCursos() }, [])

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el curso "${nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('courses').delete().eq('id', id)
    fetchCursos()
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Cursos</h1>
            <p className="text-gray-500 mt-1">Gestiona los cursos del Sello Tecnológico</p>
          </div>
          <Link href="/cursos/nuevo"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
            + Nuevo curso
          </Link>
        </div>

        {cursos.length > 0 ? (
          <div className="grid grid-cols-2 gap-6">
            {cursos.map((curso) => (
              <div key={curso.id} className="bg-white rounded-xl shadow-sm p-6 border border-transparent hover:border-blue-300 transition-all">
                <div className="flex items-start justify-between">
                  <Link href={`/cursos/${curso.id}`} className="flex-1">
                    <h2 className="text-lg font-semibold text-blue-900">{curso.name}</h2>
                    <p className="text-gray-500 text-sm mt-1">{curso.level} — {curso.area}</p>
                    <p className="text-gray-400 text-xs mt-2">Año {curso.year}</p>
                  </Link>
                  <div className="flex gap-2 ml-4">
                    <span className="text-2xl">📚</span>
                    <button onClick={() => handleDelete(curso.id, curso.name)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Eliminar curso">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-lg font-semibold text-gray-700">No hay cursos aún</h3>
            <p className="text-gray-400 mt-2">Crea el primer curso para comenzar</p>
            <Link href="/cursos/nuevo"
              className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
              + Crear curso
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
