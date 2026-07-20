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
    .select('*, project_groups(id, group_name)')
    .in('status', ['En progreso', 'En revisión', 'Aprobado'])
    .order('created_at', { ascending: false })
  const { data: evidencias } = await supabase.from('evidences').select('*')

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50">

      {/* Header feria */}
      <div className="text-center py-12 px-8">
        {settings?.logo_url && (
          <img src={settings.logo_url} alt="Logo" className="h-16 object-contain mx-auto mb-4" />
        )}
        <h1 className="mb-2 text-4xl font-black text-slate-900">
          {settings?.repo_name ?? 'Sello Tecnológico'}
        </h1>
        <p className="text-lg text-slate-600">{settings?.school_name ?? 'Colegio Providencia'} · {settings?.year_active ?? 2026}</p>
        <Link href="/portafolio"
          className="mt-4 inline-block text-sm font-bold text-violet-700 transition-colors hover:text-violet-900">
          ← Volver al portafolio
        </Link>
      </div>

      {/* Proyectos por curso */}
      <div className="max-w-7xl mx-auto px-8 pb-16 space-y-16">
        {cursos?.map(curso => {
          const proyectosCurso = proyectos?.filter(p => p.course_id === curso.id) ?? []
          if (proyectosCurso.length === 0) return null

          // Agrupar visualmente: primero los que tienen group_id (agrupa sus copias), luego los individuales
          const groupMap = new Map<string, typeof proyectosCurso>()
          const individuales: typeof proyectosCurso = []

          for (const p of proyectosCurso) {
            if (p.group_id) {
              const list = groupMap.get(p.group_id) ?? []
              list.push(p)
              groupMap.set(p.group_id, list)
            } else {
              individuales.push(p)
            }
          }

          // Para grupos mostrar solo el primero como representante (con badge de "N integrantes")
          const representantes = [
            ...Array.from(groupMap.entries()).map(([gid, lista]) => ({
              proyecto: lista[0],
              grupoCopias: lista,
              groupId: gid,
              esGrupo: true,
            })),
            ...individuales.map(p => ({
              proyecto: p,
              grupoCopias: [p],
              groupId: null,
              esGrupo: false,
            })),
          ]

          return (
            <div key={curso.id}>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px flex-1 bg-violet-200" />
                <h2 className="px-4 text-xl font-black text-slate-800">{curso.name}</h2>
                <div className="h-px flex-1 bg-violet-200" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {representantes.map(({ proyecto: p, grupoCopias, groupId, esGrupo }) => {
                  // Evidencias: si es grupo sumar todas las copias, si no solo las del proyecto
                  const evProyecto = esGrupo
                    ? (evidencias?.filter(ev => grupoCopias.some(c => c.id === ev.project_id)) ?? [])
                    : (evidencias?.filter(ev => ev.project_id === p.id) ?? [])

                  return (
                    <div key={p.id} className="relative rounded-3xl border border-violet-100 bg-white/90 p-6 shadow-lg shadow-violet-100/50 backdrop-blur">

                      {/* Badge de grupo */}
                      {esGrupo && (
                        <div className="absolute top-3 right-3">
                          <Link
                            href={`/proyectos/grupo/${groupId}`}
                            className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-200"
                          >
                            🔗 {grupoCopias.length} proyectos
                          </Link>
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-3 pr-20">
                        <h3 className="text-lg font-bold leading-tight text-slate-900">{p.title}</h3>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ml-2 ${statusColor[p.status]}`}>
                          {p.status}
                        </span>
                      </div>

                      {/* Nombre del grupo si existe */}
                      {esGrupo && p.project_groups?.group_name && (
                        <p className="mb-2 text-xs font-semibold text-violet-600">
                          Grupo: {p.project_groups.group_name}
                        </p>
                      )}

                      {p.description && (
                        <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-slate-600">{p.description}</p>
                      )}

                      {evProyecto.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
                            Evidencias ({evProyecto.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {evProyecto.slice(0, 6).map(ev => (
                              <span key={ev.id}
                                className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-700 ring-1 ring-sky-100">
                                {typeIcon[ev.type] ?? '📎'} {ev.title.length > 12 ? ev.title.slice(0, 12) + '…' : ev.title}
                              </span>
                            ))}
                            {evProyecto.length > 6 && (
                              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-600">
                                +{evProyecto.length - 6} más
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {p.end_date && (
                        <p className="mt-4 text-xs text-slate-500">📅 Hasta: {p.end_date}</p>
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
      <div className="border-t border-violet-100 py-6 text-center">
        <p className="text-sm text-slate-500">Innova Space Education {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
