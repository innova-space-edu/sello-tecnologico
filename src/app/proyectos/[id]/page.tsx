import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import ComentariosSection from './ComentariosSection'

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

export default async function ProyectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: proyecto } = await supabase
    .from('projects')
    .select('*, courses(name)')
    .eq('id', id)
    .single()

  const { data: evidencias } = await supabase
    .from('evidences')
    .select('*, profiles(full_name)')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const { data: comentarios } = await supabase
    .from('comments')
    .select('*, profiles(full_name, role)')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  const { data: { user } } = await supabase.auth.getUser()

  if (!proyecto) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <p className="text-gray-500">Proyecto no encontrado.</p>
      </main>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/proyectos" className="text-blue-600 text-sm hover:underline">← Volver a Proyectos</Link>
          <div className="flex justify-between items-start mt-3">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-blue-900">{proyecto.title}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[proyecto.status]}`}>
                  {proyecto.status}
                </span>
              </div>
              <p className="text-gray-500 text-sm">
                {proyecto.courses?.name ?? 'Sin curso'} · {proyecto.type}
                {proyecto.start_date && ` · ${proyecto.start_date}`}
                {proyecto.end_date && ` → ${proyecto.end_date}`}
              </p>
            </div>
            <Link href={`/evidencias/nueva?proyecto=${proyecto.id}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
              + Nueva evidencia
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="col-span-2 space-y-6">

            {/* Descripción y objetivos */}
            {(proyecto.description || proyecto.objectives) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                {proyecto.description && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Descripción</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{proyecto.description}</p>
                  </div>
                )}
                {proyecto.objectives && (
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">Objetivos</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{proyecto.objectives}</p>
                  </div>
                )}
              </div>
            )}

            {/* Evidencias */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-blue-900">Evidencias ({evidencias?.length ?? 0})</h2>
              </div>
              {evidencias && evidencias.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {evidencias.map(ev => (
                    <div key={ev.id} className="px-6 py-4 flex items-start gap-4">
                      <div className="text-2xl">{typeIcon[ev.type] ?? '📎'}</div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{ev.title}</p>
                        {ev.description && <p className="text-xs text-gray-400 mt-0.5">{ev.description}</p>}
                        <div className="flex items-center gap-3 mt-1">
                          {ev.tags?.map((t: string) => (
                            <span key={t} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                          {ev.drive_url && (
                            <a href={ev.drive_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline">🔗 Ver en Drive</a>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 text-right">
                        <p>{ev.profiles?.full_name ?? '—'}</p>
                        <p>{new Date(ev.created_at).toLocaleDateString('es-CL')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-gray-400">
                  <div className="text-3xl mb-2">📎</div>
                  No hay evidencias aún
                </div>
              )}
            </div>

            {/* Comentarios */}
            <ComentariosSection
              proyectoId={proyecto.id}
              comentarios={comentarios ?? []}
              userId={user?.id ?? ''}
            />
          </div>

          {/* Panel lateral */}
          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-blue-900 mb-3">Detalles</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Estado</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[proyecto.status]}`}>{proyecto.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tipo</span>
                  <span className="text-gray-700">{proyecto.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Curso</span>
                  <span className="text-gray-700">{proyecto.courses?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Inicio</span>
                  <span className="text-gray-700">{proyecto.start_date ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Término</span>
                  <span className="text-gray-700">{proyecto.end_date ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Evidencias</span>
                  <span className="text-gray-700">{evidencias?.length ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
