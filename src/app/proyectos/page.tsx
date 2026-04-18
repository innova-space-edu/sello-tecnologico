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
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [cursosAbiertos, setCursosAbiertos] = useState<Record<string, boolean>>({})
  const rolRef = useRef('')
  const userIdRef = useRef('')

  const fetchProyectos = async (userRole: string, uid: string) => {
    let query = supabase
      .from('projects')
      .select('*, courses(name), profiles!projects_owner_id_fkey(full_name)')
    if (userRole === 'estudiante') query = query.eq('owner_id', uid)
    const { data } = await query.order('created_at', { ascending: false })
    setProyectos(data ?? [])
    setUltimaActualizacion(new Date())
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = perfil?.role ?? ''
      setRol(role); setUserId(user.id)
      rolRef.current = role; userIdRef.current = user.id
      await fetchProyectos(role, user.id)
      channel = supabase.channel('proyectos-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
          fetchProyectos(rolRef.current, userIdRef.current)
        }).subscribe()
    }
    init()
    return () => { channel && supabase.removeChannel(channel) }
  }, [])

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar el proyecto "${titulo}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('projects').delete().eq('id', id)
    fetchProyectos(rol, userId)
  }

  const toggleCurso = (key: string) =>
    setCursosAbiertos(prev => ({ ...prev, [key]: !prev[key] }))

  const esEstudiante = rol === 'estudiante'
  const puedeEliminar = rol === 'admin' || rol === 'docente' || rol === 'coordinador'

  const proyectosFiltrados = proyectos.filter(p => {
    const q = busqueda.toLowerCase()
    const matchBusqueda = !q ||
      p.title?.toLowerCase().includes(q) ||
      p.profiles?.full_name?.toLowerCase().includes(q) ||
      p.courses?.name?.toLowerCase().includes(q)
    const matchEstado = filtroEstado === 'Todos' || p.status === filtroEstado
    return matchBusqueda && matchEstado
  })

  // Agrupar por curso
  const grupos = proyectosFiltrados.reduce((acc: Record<string, { nombre: string; proyectos: any[] }>, p) => {
    const key = p.course_id ?? '__sin_curso__'
    const nombre = p.courses?.name ?? 'Sin curso asignado'
    if (!acc[key]) acc[key] = { nombre, proyectos: [] }
    acc[key].proyectos.push(p)
    return acc
  }, {})

  const gruposOrdenados = Object.entries(grupos).sort(([aKey, a], [bKey, b]) => {
    if (aKey === '__sin_curso__') return 1
    if (bKey === '__sin_curso__') return -1
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  // Abrir todos por defecto al cargar
  useEffect(() => {
    if (gruposOrdenados.length > 0 && Object.keys(cursosAbiertos).length === 0) {
      const init: Record<string, boolean> = {}
      gruposOrdenados.forEach(([k]) => { init[k] = true })
      setCursosAbiertos(init)
    }
  }, [gruposOrdenados.length])

  const expandAll = () => {
    const s: Record<string, boolean> = {}
    gruposOrdenados.forEach(([k]) => { s[k] = true })
    setCursosAbiertos(s)
  }
  const collapseAll = () => {
    const s: Record<string, boolean> = {}
    gruposOrdenados.forEach(([k]) => { s[k] = false })
    setCursosAbiertos(s)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Proyectos</h1>
            <p className="text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
              Agrupados por curso · Sello Tecnológico
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                ⚡ Tiempo real · {ultimaActualizacion.toLocaleTimeString('es-CL')}
              </span>
            </p>
          </div>
          <Link href="/proyectos/nuevo"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
            + Nuevo proyecto
          </Link>
        </div>

        {/* Buscador y filtros */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por proyecto, alumno o curso..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="Todos">Todos los estados</option>
            {['Borrador', 'En progreso', 'En revisión', 'Aprobado', 'Cerrado'].map(s => <option key={s}>{s}</option>)}
          </select>
          {(busqueda || filtroEstado !== 'Todos') && (
            <button onClick={() => { setBusqueda(''); setFiltroEstado('Todos') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2">✕ Limpiar</button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={expandAll}
              className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">↕ Expandir</button>
            <button onClick={collapseAll}
              className="text-xs text-gray-400 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">↕ Colapsar</button>
            <span className="text-xs text-gray-400">{proyectosFiltrados.length} / {proyectos.length}</span>
          </div>
        </div>

        {/* Contenido */}
        {proyectos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🗂️</div>
            <h3 className="text-lg font-semibold text-gray-700">No hay proyectos aún</h3>
            <Link href="/proyectos/nuevo"
              className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
              + Crear proyecto
            </Link>
          </div>
        ) : proyectosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-base font-semibold text-gray-600">Sin resultados para "{busqueda}"</h3>
            <button onClick={() => { setBusqueda(''); setFiltroEstado('Todos') }}
              className="text-sm text-blue-600 hover:underline mt-2">Limpiar búsqueda</button>
          </div>
        ) : (
          <div className="space-y-3">
            {gruposOrdenados.map(([cursoKey, grupo]) => {
              const abierto = cursosAbiertos[cursoKey] ?? true
              const esSinCurso = cursoKey === '__sin_curso__'
              return (
                <div key={cursoKey} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                  {/* Header acordeón del curso */}
                  <button
                    onClick={() => toggleCurso(cursoKey)}
                    className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${
                      esSinCurso ? 'bg-gray-50 hover:bg-gray-100' : 'bg-blue-50 hover:bg-blue-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{esSinCurso ? '📁' : '🏫'}</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${esSinCurso ? 'text-gray-600' : 'text-blue-900'}`}>
                          {grupo.nombre}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          esSinCurso ? 'bg-gray-200 text-gray-500' : 'bg-blue-200 text-blue-700'
                        }`}>
                          {grupo.proyectos.length} proyecto{grupo.proyectos.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Mini resumen de estados */}
                      <div className="hidden sm:flex gap-1.5">
                        {Object.entries(
                          grupo.proyectos.reduce((acc: Record<string, number>, p) => {
                            acc[p.status] = (acc[p.status] || 0) + 1; return acc
                          }, {})
                        ).map(([s, count]) => (
                          <span key={s} className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor[s] ?? 'bg-gray-100 text-gray-500'}`}>
                            {s}: {count}
                          </span>
                        ))}
                      </div>
                      <span className={`text-base font-medium ${esSinCurso ? 'text-gray-400' : 'text-blue-400'}`}>
                        {abierto ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {/* Tabla interna del grupo */}
                  {abierto && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-100">
                          <tr className="bg-gray-50/60">
                            <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs">Proyecto</th>
                            {!esEstudiante && <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs">Alumno</th>}
                            <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs">Estado</th>
                            <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs">Última edición</th>
                            <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {grupo.proyectos.map(p => (
                            <tr key={p.id} className="hover:bg-blue-50/50 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex flex-col gap-0.5">
                                  <Link href={`/proyectos/${p.id}`} className="font-medium text-blue-700 hover:underline">
                                    {p.title}
                                  </Link>
                                  {p.is_draft && (
                                    <span className="text-xs text-orange-500 font-medium">📋 Borrador sincronizado</span>
                                  )}
                                </div>
                              </td>
                              {!esEstudiante && (
                                <td className="px-5 py-3.5 text-gray-500 text-xs">{p.profiles?.full_name ?? '—'}</td>
                              )}
                              <td className="px-5 py-3.5">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-gray-400 text-xs">
                                {p.last_autosave_at
                                  ? new Date(p.last_autosave_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                                  : (p.start_date ?? '—')}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  <Link href={`/proyectos/${p.id}`}
                                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium">
                                    👁️ Ver
                                  </Link>
                                  {(p.owner_id === userId || puedeEliminar) && (
                                    <Link href={`/proyectos/${p.id}/editar`}
                                      className="text-blue-600 hover:bg-blue-50 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium border border-blue-200">
                                      ✏️ Editar
                                    </Link>
                                  )}
                                  {(p.owner_id === userId || puedeEliminar) && (
                                    <button onClick={() => handleDelete(p.id, p.title)}
                                      className="text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium border border-red-200">
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
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
