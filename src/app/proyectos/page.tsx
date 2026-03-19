'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState } from 'react'

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

  const fetchProyectos = async (userRole: string, userId: string) => {
    let query = supabase.from('projects').select('*, courses(name), profiles!projects_owner_id_fkey(full_name)')

    // Estudiantes solo ven sus propios proyectos
    // Admin/docente/coordinador ven TODOS
    if (userRole === 'estudiante') {
      query = query.eq('owner_id', userId)
    }

    const { data } = await query.order('created_at', { ascending: false })
    setProyectos(data ?? [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = perfil?.role ?? ''
      setRol(role)
      setUserId(user.id)
      fetchProyectos(role, user.id)
    }
    init()
  }, [])

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar el proyecto "${titulo}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('projects').delete().eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) fetchProyectos(rol, user.id)
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
            <p className="text-gray-500 mt-1">Todos los proyectos del Sello Tecnológico</p>
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
                      <div className="flex items-center gap-1">
                        {(p.owner_id === userId || puedeEliminar) && (
                          <Link href={`/proyectos/${p.id}/editar`}
                            className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors text-sm"
                            title="Editar proyecto">
                            ✏️
                          </Link>
                        )}
                        {(p.owner_id === userId || puedeEliminar) && (
                          <button onClick={() => handleDelete(p.id, p.title)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
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
