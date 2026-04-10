import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  'Borrador': 'bg-gray-100 text-gray-600',
  'En progreso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-yellow-100 text-yellow-700',
  'Aprobado': 'bg-green-100 text-green-700',
  'Cerrado': 'bg-gray-100 text-gray-500',
}

const etapaIcon: Record<string, string> = {
  inicial: '🟡', intermedia: '🔵', final: '🟢',
}

const tipoIcon: Record<string, string> = {
  documento: '📄', foto: '🖼️', video: '🎥',
  enlace: '🔗', presentación: '📊', código: '💻',
}

export default async function GrupoProyectoPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const supabase = await createServerSupabaseClient()

  // Datos del grupo
  const { data: group } = await supabase
    .from('project_groups')
    .select('*, courses(name)')
    .eq('id', groupId)
    .single()

  if (!group) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="lg:ml-64 flex-1 p-8 pt-16 lg:pt-8">
          <p className="text-gray-500">Grupo no encontrado.</p>
          <Link href="/proyectos" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
            ← Volver a proyectos
          </Link>
        </main>
      </div>
    )
  }

  // Integrantes
  const { data: members } = await supabase
    .from('project_group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('full_name')

  // Proyectos del grupo
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, status, owner_id, updated_at, course_id, description, tipo_proyecto, evidencia_problema')
    .eq('group_id', groupId)
    .order('updated_at', { ascending: false })

  const projectIds = (projects ?? []).map(p => p.id)

  // Evidencias de todos esos proyectos
  const { data: evidences } = projectIds.length > 0
    ? await supabase
        .from('evidences')
        .select('*, projects(title)')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Cálculos de resumen
  const totalProyectos = projects?.length ?? 0
  const totalEvidencias = evidences?.length ?? 0
  const borradores = projects?.filter(p => p.status === 'Borrador').length ?? 0
  const activos = projects?.filter(p => ['En progreso', 'En revisión'].includes(p.status)).length ?? 0
  const aprobados = projects?.filter(p => p.status === 'Aprobado').length ?? 0
  const evInicial = evidences?.filter(e => e.evidencia_tipo === 'inicial').length ?? 0
  const evIntermedia = evidences?.filter(e => e.evidencia_tipo === 'intermedia').length ?? 0
  const evFinal = evidences?.filter(e => e.evidencia_tipo === 'final').length ?? 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/proyectos" className="text-blue-600 text-sm hover:underline">← Volver a proyectos</Link>
          <div className="flex items-start justify-between mt-2 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">
                🔗 {group.group_name ?? 'Proyecto en Común'}
              </h1>
              {group.courses?.name && (
                <p className="text-gray-500 mt-1 text-sm">📚 Curso: {group.courses.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Resumen estadístico */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Proyectos', value: totalProyectos, icon: '📂', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { label: 'Evidencias', value: totalEvidencias, icon: '📎', color: 'bg-purple-50 border-purple-200 text-purple-800' },
            { label: 'En progreso', value: activos, icon: '🔵', color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'Aprobados', value: aprobados, icon: '✅', color: 'bg-green-50 border-green-200 text-green-700' },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl border p-4 ${stat.color}`}>
              <p className="text-2xl font-bold">{stat.icon} {stat.value}</p>
              <p className="text-xs font-semibold mt-1 opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Columna izquierda: info del grupo + integrantes */}
          <div className="space-y-4">

            {/* Integrantes */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-bold text-blue-900 mb-3 text-sm uppercase tracking-wide">
                👥 Integrantes ({members?.length ?? 0})
              </h2>
              {members && members.length > 0 ? (
                <ul className="space-y-2">
                  {members.map(m => (
                    <li key={m.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {m.full_name.charAt(0).toUpperCase()}
                      </span>
                      <span>{m.full_name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-sm">Sin integrantes registrados</p>
              )}
            </div>

            {/* Firma del grupo */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-bold text-blue-900 mb-2 text-sm uppercase tracking-wide">🔑 Firma del grupo</h2>
              <p className="text-xs text-gray-400 font-mono break-all">{group.normalized_signature}</p>
            </div>

            {/* Resumen de evidencias por etapa */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-bold text-blue-900 mb-3 text-sm uppercase tracking-wide">📊 Evidencias por etapa</h2>
              <div className="space-y-2">
                {[
                  { etapa: 'inicial', label: 'Iniciales', count: evInicial },
                  { etapa: 'intermedia', label: 'Intermedias', count: evIntermedia },
                  { etapa: 'final', label: 'Finales', count: evFinal },
                ].map(row => (
                  <div key={row.etapa} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{etapaIcon[row.etapa]} {row.label}</span>
                    <span className="font-semibold text-gray-800">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Columna derecha: proyectos + evidencias */}
          <div className="lg:col-span-2 space-y-5">

            {/* Proyectos del grupo */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-bold text-blue-900 mb-4">📂 Proyectos del grupo ({totalProyectos})</h2>
              {projects && projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map(p => {
                    const evCount = evidences?.filter(e => e.project_id === p.id).length ?? 0
                    return (
                      <Link
                        key={p.id}
                        href={`/proyectos/${p.id}`}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm group-hover:text-blue-700 truncate">
                            {p.title}
                          </p>
                          {p.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {evCount} evidencia{evCount !== 1 ? 's' : ''} ·
                            Actualizado: {new Date(p.updated_at).toLocaleDateString('es-CL')}
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {p.status}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No hay proyectos en este grupo aún.</p>
              )}
            </div>

            {/* Evidencias unificadas */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-bold text-blue-900 mb-4">📎 Evidencias del grupo ({totalEvidencias})</h2>
              {evidences && evidences.length > 0 ? (
                <div className="space-y-2">
                  {evidences.map(ev => (
                    <Link
                      key={ev.id}
                      href={`/evidencias/${ev.id}`}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                    >
                      <span className="text-xl shrink-0">{tipoIcon[ev.type] ?? '📎'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 truncate">{ev.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo} ·
                          {(ev as any).projects?.title && ` ${(ev as any).projects.title} ·`}
                          {' '}{new Date(ev.created_at).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No hay evidencias registradas aún para este grupo.</p>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
