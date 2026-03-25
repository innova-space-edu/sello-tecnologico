'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'

const statusColor: Record<string, string> = {
  'Borrador': 'bg-gray-100 text-gray-600',
  'En progreso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-yellow-100 text-yellow-700',
  'Aprobado': 'bg-green-100 text-green-700',
  'Cerrado': 'bg-red-100 text-red-600',
}

export default function ProyectosPage() {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<any[]>([])
  const [rol, setRol] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date())

  // Refs para poder usarlos dentro del interval sin stale closure
  const rolRef = useRef('')
  const userIdRef = useRef('')

  const fetchProyectos = async (userRole: string, uid: string) => {
    let query = supabase
      .from('projects')
      .select('*, courses(name), profiles!projects_owner_id_fkey(full_name)')

    if (userRole === 'estudiante') {
      query = query.eq('owner_id', uid)
    }

    const { data } = await query.order('created_at', { ascending: false })
    setProyectos(data ?? [])
    setUltimaActualizacion(new Date())
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = perfil?.role ?? ''
      setRol(role)
      setUserId(user.id)
      rolRef.current = role
      userIdRef.current = user.id
      fetchProyectos(role, user.id)
    }
    init()

    // Auto-refresh cada 5 segundos
    const interval = setInterval(() => {
      if (rolRef.current && userIdRef.current) {
        fetchProyectos(rolRef.current, userIdRef.current)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar el proyecto "${titulo}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('projects').delete().eq('id', id)
    fetchProyectos(rol, userId)
  }

  const esEstudiante = rol === 'estudiante'
  const puedeEliminar = rol === 'admin' || rol === 'docente' || rol === 'coordinador'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Proyectos</h1>
            <p className="text-gray-500 mt-1">
              Todos los proyectos del Sello Tecnológico
              <span className="ml-3 text-xs text-gray-400">
                🔄 Actualizado {ultimaActualizacion.toLocaleTimeString('es-CL')}
              </span>
            </p>
          </div>
          <Link href="/proyectos/nuevo"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
            + Nuevo proyecto
          </Link>
        </div>

        {proyectos.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Proyecto</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Curso</th>
                  {!esEstudiante && <th className="text-left px-6 py-3 text-gray-500 font-medium">Alumno</th>}
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proyectos.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/proyectos/${p.id}`} className="font-medium text-blue-700 hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{p.courses?.name ?? '—'}</td>
                    {!esEstudiante && (
                      <td className="px-6 py-4 text-gray-500 text-xs">{(p as any).profiles?.full_name ?? '—'}</td>
                    )}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{p.start_date ?? '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/proyectos/${p.id}`}
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium"
                          title="Ver proyecto">
                          👁️ Ver
                        </Link>
                        {(p.owner_id === userId || puedeEliminar) && (
                          <Link href={`/proyectos/${p.id}/editar`}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium border border-blue-200"
                            title="Editar proyecto">
                            ✏️ Editar
                          </Link>
                        )}
                        {(p.owner_id === userId || puedeEliminar) && (
                          <button onClick={() => handleDelete(p.id, p.title)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium border border-red-200"
                            title="Eliminar proyecto">
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🗂️</div>
            <h3 className="text-lg font-semibold text-gray-700">No hay proyectos aún</h3>
            <Link href="/proyectos/nuevo"
              className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
              + Crear proyecto
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
