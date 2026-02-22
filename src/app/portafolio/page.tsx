import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  'Borrador': 'bg-gray-100 text-gray-600',
  'En progreso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-yellow-100 text-yellow-700',
  'Aprobado': 'bg-green-100 text-green-700',
  'Cerrado': 'bg-red-100 text-red-600',
}

const typeIcon: Record<string, string> = {
  'documento': '📄', 'foto': '🖼️', 'video': '🎥',
  'enlace': '🔗', 'presentación': '📊', 'código': '💻',
}

export default async function PortafolioPage() {
  const supabase = await createServerSupabaseClient()

  const { data: cursos } = await supabase
    .from('courses')
    .select('*')
    .order('name', { ascending: true })

  const { data: proyectos } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: evidencias } = await supabase
    .from('evidences')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">

        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Portafolio</h1>
            <p className="text-gray-500 mt-1">Vista general de cursos, proyectos y evidencias</p>
          </div>
          <Link href="/portafolio/feria"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
            🎪 Modo Feria
          </Link>
        </div>

        {/* Por curso */}
        {cursos && cursos.length > 0 ? (
          <div className="space-y-8">
            {cursos.map(curso => {
              const proyectosCurso = proyectos?.filter(p => p.course_id === curso.id) ?? []
              const evidenciasCurso = evidencias?.filter(ev =>
                proyectosCurso.some(p => p.id === ev.project_id)
              ) ?? []

              return (
                <div key={curso.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* Header del curso */}
                  <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-8 py-5">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold text-white">{curso.name}</h2>
                        <p className="text-blue-200 text-sm mt-0.5">
                          {curso.level} {curso.area && `· ${curso.area}`} · {curso.year}
                        </p>
                      </div>
                      <div className="flex gap-4 text-center">
                        <div className="bg-blue-700 rounded-xl px-4 py-2">
                          <div className="text-xl font-bold text-white">{proyectosCurso.length}</div>
                          <div className="text-blue-200 text-xs">Proyectos</div>
                        </div>
                        <div className="bg-blue-700 rounded-xl px-4 py-2">
                          <div className="text-xl font-bold text-white">{evidenciasCurso.length}</div>
                          <div className="text-blue-200 text-xs">Evidencias</div>
                        </div>
                        <div className="bg-blue-700 rounded-xl px-4 py-2">
                          <div className="text-xl font-bold text-white">
                            {proyectosCurso.filter(p => p.status === 'Aprobado').length}
                          </div>
                          <div className="text-blue-200 text-xs">Aprobados</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Proyectos del curso */}
                  {proyectosCurso.length > 0 ? (
                    <div className="p-6">
                      <div className="grid grid-cols-2 gap-4">
                        {proyectosCurso.map(p => {
                          const evProyecto = evidencias?.filter(ev => ev.project_id === p.id) ?? []
                          return (
                            <Link key={p.id} href={`/proyectos/${p.id}`}
                              className="border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all">
                              <div className="flex justify-between items-start mb-3">
                                <h3 className="font-semibold text-gray-800 text-sm leading-tight flex-1 pr-2">{p.title}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor[p.status]}`}>
                                  {p.status}
                                </span>
                              </div>

                              {p.description && (
                                <p className="text-xs text-gray-400 mb-3 line-clamp-2">{p.description}</p>
                              )}

                              {/* Evidencias del proyecto */}
                              {evProyecto.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {evProyecto.slice(0, 4).map(ev => (
                                    <span key={ev.id} className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                      {typeIcon[ev.type] ?? '📎'} {ev.title.length > 15 ? ev.title.slice(0, 15) + '...' : ev.title}
                                    </span>
                                  ))}
                                  {evProyecto.length > 4 && (
                                    <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                                      +{evProyecto.length - 4} más
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex justify-between items-center text-xs text-gray-400">
                                <span>{evProyecto.length} evidencia{evProyecto.length !== 1 ? 's' : ''}</span>
                                {p.end_date && <span>Hasta: {p.end_date}</span>}
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">
                      Sin proyectos en este curso aún
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-gray-700">No hay cursos aún</h3>
            <p className="text-gray-400 mt-2">Crea cursos y proyectos para ver el portafolio</p>
          </div>
        )}
      </main>
    </div>
  )
}
