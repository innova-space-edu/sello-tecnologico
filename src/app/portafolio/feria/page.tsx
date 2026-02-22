import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  'Borrador': 'bg-gray-200 text-gray-600',
  'En progreso': 'bg-blue-200 text-blue-800',
  'En revisión': 'bg-yellow-200 text-yellow-800',
  'Aprobado': 'bg-green-200 text-green-800',
  'Cerrado': 'bg-gray-200 text-gray-600',
}

const typeIcon: Record<string, string> = {
  'documento': '📄', 'foto': '🖼️', 'video': '🎥',
  'enlace': '🔗', 'presentación': '📊', 'código': '💻',
}

export default async function FeriaPage() {
  const supabase = await createServerSupabaseClient()

  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()
  const { data: cursos } = await supabase.from('courses').select('*').order('name')
  const { data: proyectos } = await supabase
    .from('projects')
    .select('*')
    .in('status', ['En progreso', 'En revisión', 'Aprobado'])
    .order('created_at', { ascending: false })
  const { data: evidencias } = await supabase.from('evidences').select('*')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-blue-800">

      {/* Header feria */}
      <div className="text-center py-12 px-8">
        {settings?.logo_url && (
          <img src={settings.logo_url} alt="Logo" className="h-16 object-contain mx-auto mb-4" />
        )}
        <h1 className="text-4xl font-bold text-white mb-2">
          {settings?.repo_name ?? 'Sello Tecnológico'}
        </h1>
        <p className="text-blue-300 text-lg">{settings?.school_name ?? 'Colegio Providencia'} · {settings?.year_active ?? 2026}</p>
        <Link href="/portafolio"
          className="inline-block mt-4 text-blue-300 hover:text-white text-sm transition-colors">
          ← Volver al portafolio
        </Link>
      </div>

      {/* Proyectos por curso */}
      <div className="max-w-7xl mx-auto px-8 pb-16 space-y-12">
        {cursos?.map(curso => {
          const proyectosCurso = proyectos?.filter(p => p.course_id === curso.id) ?? []
          if (proyectosCurso.length === 0) return null

          return (
            <div key={curso.id}>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px flex-1 bg-blue-700" />
                <h2 className="text-xl font-bold text-white px-4">{curso.name}</h2>
                <div className="h-px flex-1 bg-blue-700" />
              </div>

              <div className="grid grid-cols-3 gap-6">
                {proyectosCurso.map(p => {
                  const evProyecto = evidencias?.filter(ev => ev.project_id === p.id) ?? []
                  return (
                    <div key={p.id} className="bg-white bg-opacity-10 backdrop-blur rounded-2xl p-6 border border-blue-700 border-opacity-50">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-white text-lg leading-tight flex-1 pr-2">{p.title}</h3>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${statusColor[p.status]}`}>
                          {p.status}
                        </span>
                      </div>

                      {p.description && (
                        <p className="text-blue-200 text-sm mb-4 leading-relaxed line-clamp-3">{p.description}</p>
                      )}

                      {p.objectives && (
                        <div className="mb-4">
                          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">Objetivos</p>
                          <p className="text-blue-100 text-sm line-clamp-2">{p.objectives}</p>
                        </div>
                      )}

                      {evProyecto.length > 0 && (
                        <div>
                          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-2">
                            Evidencias ({evProyecto.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {evProyecto.map(ev => (
                              <span key={ev.id}
                                className="flex items-center gap-1 bg-blue-800 bg-opacity-60 text-blue-100 text-xs px-2.5 py-1 rounded-full">
                                {typeIcon[ev.type] ?? '📎'} {ev.title.length > 12 ? ev.title.slice(0, 12) + '...' : ev.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {p.end_date && (
                        <p className="text-blue-400 text-xs mt-4">📅 Hasta: {p.end_date}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer feria */}
      <div className="text-center py-6 border-t border-blue-800">
        <p className="text-blue-400 text-sm">Innova Space Education {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
