'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const typeIcon: Record<string, string> = {
  'documento': '📄', 'foto': '🖼️', 'video': '🎥',
  'enlace': '🔗', 'presentación': '📊', 'código': '💻',
}

export default function EvidenciasPage() {
  const supabase = createClient()
  const [evidencias, setEvidencias] = useState<any[]>([])
  const [rol, setRol] = useState<string>('')

  const fetchEvidencias = async () => {
    const { data } = await supabase
      .from('evidences')
      .select('*, projects(title)')
      .order('created_at', { ascending: false })
    setEvidencias(data ?? [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRol(perfil?.role ?? '')
      fetchEvidencias()
    }
    init()
  }, [])

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar la evidencia "${titulo}"?`)) return
    await supabase.from('evidences').delete().eq('id', id)
    fetchEvidencias()
  }

  const esEstudiante = rol === 'estudiante'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Evidencias</h1>
            <p className="text-gray-500 mt-1">Archivos y documentos del Sello Tecnológico</p>
          </div>
          {!esEstudiante && (
            <Link href="/evidencias/nueva"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
              + Nueva evidencia
            </Link>
          )}
        </div>

        {evidencias.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            {evidencias.map((ev) => (
              <div key={ev.id} className="bg-white rounded-xl shadow-sm p-5 border border-transparent hover:border-blue-300 transition-all">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{typeIcon[ev.type] ?? '📎'}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{ev.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{ev.projects?.title ?? 'Sin proyecto'}</p>
                    {ev.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{ev.description}</p>}
                    {ev.tags && ev.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ev.tags.map((tag: string) => (
                          <span key={tag} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                    {ev.drive_url && (
                      <a href={ev.drive_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline">
                        🔗 Ver en Drive
                      </a>
                    )}
                  </div>
                  {!esEstudiante && (
                    <button onClick={() => handleDelete(ev.id, ev.title)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0"
                      title="Eliminar evidencia">
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📎</div>
            <h3 className="text-lg font-semibold text-gray-700">No hay evidencias aún</h3>
            {!esEstudiante && (
              <Link href="/evidencias/nueva"
                className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
                + Subir evidencia
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
