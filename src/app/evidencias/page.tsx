'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const typeIcon: Record<string, string> = {
  'documento': '📄', 'foto': '🖼️', 'video': '🎥',
  'enlace': '🔗', 'presentación': '📊', 'código': '💻',
}

const etapaColor: Record<string, string> = {
  inicial: 'bg-yellow-100 text-yellow-700',
  intermedia: 'bg-blue-100 text-blue-700',
  final: 'bg-green-100 text-green-700',
}
const etapaIcon: Record<string, string> = {
  inicial: '🟡', intermedia: '🔵', final: '🟢',
}

export default function EvidenciasPage() {
  const supabase = createClient()
  const [evidencias, setEvidencias] = useState<any[]>([])
  const [rol, setRol] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroEtapa, setFiltroEtapa] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState<string>('')

  const fetchEvidencias = async (userRole: string, uid: string) => {
    let query = supabase
      .from('evidences')
      .select(`
        *,
        projects(id, title, courses(name), project_groups(group_name)),
        profiles!evidences_created_by_fkey(id, full_name, email, curso)
      `)

    if (userRole === 'estudiante') {
      query = query.eq('created_by', uid)
    }

    const { data } = await query.order('created_at', { ascending: false })
    setEvidencias(data ?? [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = perfil?.role ?? ''
      setRol(role)
      setUserId(user.id)
      fetchEvidencias(role, user.id)
    }
    init()
  }, [])

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar la evidencia "${titulo}"?`)) return
    await supabase.from('evidences').delete().eq('id', id)
    fetchEvidencias(rol, userId)
  }

  const esEstudiante = rol === 'estudiante'

  const evidenciasFiltradas = evidencias.filter(ev => {
    const matchTipo = filtroTipo === 'todos' || ev.type === filtroTipo
    const matchEtapa = filtroEtapa === 'todas' || ev.evidencia_tipo === filtroEtapa
    const matchBusqueda = !busqueda ||
      ev.title?.toLowerCase().includes(busqueda.toLowerCase()) ||
      ev.projects?.title?.toLowerCase().includes(busqueda.toLowerCase()) ||
      ev.profiles?.full_name?.toLowerCase().includes(busqueda.toLowerCase())
    return matchTipo && matchEtapa && matchBusqueda
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Evidencias</h1>
            <p className="text-gray-500 mt-1">Archivos y documentos del Sello Tecnológico</p>
          </div>
          <Link href="/evidencias/nueva"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shrink-0">
            📎 + Nueva evidencia
          </Link>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-5 flex flex-wrap gap-3">
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar por título, proyecto o alumno..."
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="todos">Todos los tipos</option>
            {['documento', 'foto', 'video', 'enlace', 'presentación', 'código'].map(t => (
              <option key={t} value={t}>{typeIcon[t]} {t}</option>
            ))}
          </select>
          <select value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="todas">Todas las etapas</option>
            <option value="inicial">🟡 Inicial</option>
            <option value="intermedia">🔵 Intermedia</option>
            <option value="final">🟢 Final</option>
          </select>
          {(filtroTipo !== 'todos' || filtroEtapa !== 'todas' || busqueda) && (
            <button onClick={() => { setFiltroTipo('todos'); setFiltroEtapa('todas'); setBusqueda('') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2">
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Contador */}
        {evidencias.length > 0 && (
          <p className="text-xs text-gray-400 mb-4">
            Mostrando {evidenciasFiltradas.length} de {evidencias.length} evidencias
          </p>
        )}

        {evidenciasFiltradas.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            {evidenciasFiltradas.map((ev) => {
              const uploader = ev.profiles
              const proyecto = ev.projects
              const curso = proyecto?.courses?.name
              const grupo = proyecto?.project_groups?.group_name
              const isImage = ev.file_type?.startsWith('image/')
              const isVideo = ev.file_type?.startsWith('video/')

              return (
                <div key={ev.id} className="bg-white rounded-xl shadow-sm border border-transparent hover:border-blue-300 hover:shadow-md transition-all overflow-hidden">
                  {/* Miniatura de imagen */}
                  {isImage && ev.file_url && (
                    <Link href={`/evidencias/${ev.id}`}>
                      <div className="relative h-36 bg-gray-100 overflow-hidden">
                        <img
                          src={ev.file_url}
                          alt={ev.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      </div>
                    </Link>
                  )}
                  {/* Miniatura video */}
                  {isVideo && ev.file_url && (
                    <Link href={`/evidencias/${ev.id}`}>
                      <div className="relative h-36 bg-gray-900 flex items-center justify-center overflow-hidden">
                        <video src={ev.file_url} className="w-full h-full object-cover opacity-60" muted />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center text-xl shadow">▶</div>
                        </div>
                      </div>
                    </Link>
                  )}

                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl shrink-0">{typeIcon[ev.type] ?? '📎'}</div>
                      <div className="flex-1 min-w-0">

                        {/* Título */}
                        <Link href={`/evidencias/${ev.id}`}
                          className="font-semibold text-gray-800 hover:text-blue-700 block truncate">
                          {ev.title}
                        </Link>

                        {/* Proyecto + Curso + Grupo */}
                        <div className="mt-1 space-y-0.5">
                          {proyecto && (
                            <Link href={`/proyectos/${proyecto.id}`}
                              className="text-xs text-blue-600 hover:underline font-medium block truncate">
                              📌 {proyecto.title}
                            </Link>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {curso && <p className="text-xs text-gray-400">📚 {curso}</p>}
                            {grupo && <p className="text-xs text-gray-400">👥 {grupo}</p>}
                          </div>
                        </div>

                        {/* Quién subió */}
                        {uploader && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                              {uploader.full_name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {uploader.full_name ?? uploader.email}
                              {uploader.curso && <span className="text-gray-400"> · {uploader.curso}</span>}
                            </p>
                          </div>
                        )}

                        {ev.description && (
                          <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{ev.description}</p>
                        )}

                        {/* Tags y etapa */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ev.evidencia_tipo && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${etapaColor[ev.evidencia_tipo] ?? 'bg-gray-100 text-gray-500'}`}>
                              {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo}
                            </span>
                          )}
                          {ev.tags?.slice(0, 2).map((tag: string) => (
                            <span key={tag} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                          {ev.tags?.length > 2 && (
                            <span className="text-xs text-gray-400">+{ev.tags.length - 2}</span>
                          )}
                        </div>
                      </div>

                      {/* Acciones rápidas */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <Link href={`/evidencias/${ev.id}`}
                          className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors text-sm text-center"
                          title="Ver evidencia">
                          👁️
                        </Link>
                        {ev.file_url && (
                          <a href={ev.file_url} download={ev.file_name || true} target="_blank" rel="noopener noreferrer"
                            className="text-green-400 hover:text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors text-sm text-center"
                            title="Descargar">
                            ⬇️
                          </a>
                        )}
                        {(ev.created_by === userId || !esEstudiante) && (
                          <Link href={`/evidencias/${ev.id}/editar`}
                            className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-1.5 rounded-lg transition-colors text-sm text-center"
                            title="Editar">✏️</Link>
                        )}
                        {(ev.created_by === userId || !esEstudiante) && (
                          <button onClick={() => handleDelete(ev.id, ev.title)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors text-sm"
                            title="Eliminar">🗑️</button>
                        )}
                      </div>
                    </div>

                    {/* Drive link */}
                    {ev.drive_url && (
                      <a href={ev.drive_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline">
                        🔗 Ver en Drive
                      </a>
                    )}

                    {/* Fecha */}
                    <p className="text-xs text-gray-300 mt-2">
                      {new Date(ev.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : evidencias.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📎</div>
            <h3 className="text-lg font-semibold text-gray-700">No hay evidencias aún</h3>
            <Link href="/evidencias/nueva"
              className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
              📎 + Subir primera evidencia
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-base font-semibold text-gray-600">No se encontraron resultados</h3>
            <button onClick={() => { setFiltroTipo('todos'); setFiltroEtapa('todas'); setBusqueda('') }}
              className="text-sm text-blue-600 hover:underline mt-2">Limpiar filtros</button>
          </div>
        )}
      </main>
    </div>
  )
}
