'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const statusColor: Record<string, string> = {
  'Borrador': 'bg-gray-100 text-gray-600',
  'En progreso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-yellow-100 text-yellow-700',
  'Aprobado': 'bg-green-100 text-green-700',
  'Cerrado': 'bg-red-100 text-red-600',
}

const statusOptions = ['Todos', 'Borrador', 'En progreso', 'En revisión', 'Aprobado', 'Cerrado']

export default function AdminProyectosPage() {
  const supabase = createClient()
  const router = useRouter()

  const [proyectos, setProyectos] = useState<any[]>([])
  const [cursos, setCursos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroCurso, setFiltroCurso] = useState('Todos')
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date())

  // Ref para evitar stale closure en el interval
  const autorizadoRef = useRef(false)

  const fetchProyectos = async () => {
    const { data: proyData } = await supabase
      .from('projects')
      .select('*, courses(name), profiles!projects_owner_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })

    setProyectos(proyData ?? [])
    setUltimaActualizacion(new Date())
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (perfil?.role !== 'admin') { router.push('/dashboard'); return }

      autorizadoRef.current = true

      const { data: cursosData } = await supabase.from('courses').select('id, name').order('name')
      setCursos(cursosData ?? [])

      await fetchProyectos()
      setLoading(false)
    }
    init()

    // Auto-refresh cada 5 segundos
    const interval = setInterval(() => {
      if (autorizadoRef.current) {
        fetchProyectos()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar el proyecto "${titulo}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('projects').delete().eq('id', id)
    setProyectos(prev => prev.filter(p => p.id !== id))
  }

  const proyectosFiltrados = proyectos.filter(p => {
    const matchSearch =
      !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.profiles?.email?.toLowerCase().includes(search.toLowerCase())
    const matchEstado = filtroEstado === 'Todos' || p.status === filtroEstado
    const matchCurso = filtroCurso === 'Todos' || p.course_id === filtroCurso
    return matchSearch && matchEstado && matchCurso
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Link href="/admin" className="hover:text-blue-600">Panel Admin</Link>
              <span>›</span>
              <span className="text-gray-600">Gestión de Proyectos</span>
            </div>
            <h1 className="text-2xl font-bold text-blue-900">🗂️ Gestión de Proyectos</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Revisa y edita todos los proyectos del sistema
              <span className="ml-3 text-xs text-gray-400">
                🔄 Actualizado {ultimaActualizacion.toLocaleTimeString('es-CL')}
              </span>
            </p>
          </div>
          <Link href="/proyectos/nuevo"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
            + Nuevo proyecto
          </Link>
        </div>

        {/* Stats rápidas clicables */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {statusOptions.filter(s => s !== 'Todos').map(estado => {
            const count = proyectos.filter(p => p.status === estado).length
            return (
              <button key={estado}
                onClick={() => setFiltroEstado(prev => prev === estado ? 'Todos' : estado)}
                className={`bg-white rounded-xl shadow-sm p-3 text-center cursor-pointer border-2 transition-all ${
                  filtroEstado === estado ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-gray-200'
                }`}>
                <div className="text-xl font-bold text-gray-800">{count}</div>
                <div className={`text-xs mt-0.5 px-1.5 py-0.5 rounded-full font-medium inline-block ${statusColor[estado]}`}>
                  {estado}
                </div>
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Buscar por título, alumno o correo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {statusOptions.map(s => <option key={s}>{s}</option>)}
          </select>
          <select
            value={filtroCurso}
            onChange={e => setFiltroCurso(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="Todos">Todos los cursos</option>
            {cursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {(search || filtroEstado !== 'Todos' || filtroCurso !== 'Todos') && (
            <button
              onClick={() => { setSearch(''); setFiltroEstado('Todos'); setFiltroCurso('Todos') }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
              ✕ Limpiar
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {proyectosFiltrados.length} de {proyectos.length} proyectos
          </span>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
            <div className="text-3xl mb-3 animate-pulse">🗂️</div>
            Cargando proyectos...
          </div>
        ) : proyectosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-700">Sin resultados</h3>
            <p className="text-gray-400 mt-1 text-sm">Prueba con otros filtros de búsqueda</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium text-xs">Proyecto</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium text-xs">Alumno</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium text-xs">Curso</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium text-xs">Estado</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium text-xs">Fecha inicio</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium text-xs">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {proyectosFiltrados.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-3">
                        <Link href={`/proyectos/${p.id}`}
                          className="font-medium text-blue-700 hover:underline text-sm line-clamp-1 max-w-xs block">
                          {p.title}
                        </Link>
                        {p.year && (
                          <span className="text-xs text-gray-400">Año {p.year} · Sem. {p.semestre}</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="text-sm text-gray-700">{p.profiles?.full_name ?? '—'}</div>
                        <div className="text-xs text-gray-400">{p.profiles?.email ?? ''}</div>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-sm whitespace-nowrap">{p.courses?.name ?? '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColor[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">{p.start_date ?? '—'}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/proyectos/${p.id}`}
                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium whitespace-nowrap">
                            👁️ Ver
                          </Link>
                          <Link href={`/proyectos/${p.id}/editar`}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium border border-blue-200 whitespace-nowrap">
                            ✏️ Editar
                          </Link>
                          <button onClick={() => handleDelete(p.id, p.title)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium border border-red-200 whitespace-nowrap">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
