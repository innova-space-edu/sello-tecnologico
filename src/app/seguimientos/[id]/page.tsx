import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

type Participant = {
  id: string
  profiles?: {
    full_name?: string | null
    email?: string | null
    curso?: string | null
  } | null
}

const statusColor: Record<string, string> = {
  'Pendiente': 'bg-gray-100 text-gray-700',
  'En proceso': 'bg-blue-100 text-blue-700',
  'Logrado': 'bg-green-100 text-green-700',
  'Requiere apoyo': 'bg-orange-100 text-orange-700',
}

export default async function SeguimientoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  const { data: session } = await supabase
    .from('project_followups')
    .select(`
      *,
      courses(name),
      projects(title),
      teacher:profiles!project_followups_teacher_id_fkey(full_name, email)
    `)
    .eq('id', id)
    .single()

  if (!session) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
          <Link href="/seguimientos" className="text-blue-600 text-sm hover:underline">← Volver</Link>
          <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
            No se encontró este seguimiento o no tienes autorización para verlo.
          </div>
        </main>
      </div>
    )
  }

  const [{ data: participants }, { data: items }, { data: photos }] = await Promise.all([
    supabase.from('followup_participants').select('id, user_id, profiles(full_name, email, curso)').eq('followup_id', id),
    supabase.from('followup_items').select('*').eq('followup_id', id).order('sort_order'),
    supabase.from('followup_photos').select('*').eq('followup_id', id).order('created_at'),
  ])

  const canEdit = session.teacher_id === user?.id || ['admin', 'coordinador', 'utp'].includes(profile?.role ?? '')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-5">
          <Link href="/seguimientos" className="text-blue-600 text-sm hover:underline">← Volver a Seguimiento</Link>
        </div>

        <div className="max-w-6xl space-y-5">
          <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div>
                <div className="flex flex-wrap gap-2 items-center mb-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor[session.overall_status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {session.overall_status}
                  </span>
                  <span className="text-xs text-gray-400">🎫 {session.ticket}</span>
                </div>
                <h1 className="text-2xl font-bold text-blue-900">{session.projects?.title ?? 'Seguimiento de proyecto'}</h1>
                <p className="text-gray-500 mt-1">{session.courses?.name ?? 'Sin curso'} · {session.subject}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <Link href={`/seguimientos/${session.id}/editar`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                    ✏️ Editar ficha
                  </Link>
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
                <h2 className="font-bold text-blue-900 mb-4">📝 Registro de la sesión</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Fecha</p>
                    <p className="text-gray-700 mt-1">{new Date(`${session.followup_date}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Docente responsable</p>
                    <p className="text-gray-700 mt-1">{session.teacher?.full_name ?? session.teacher?.email ?? '—'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Observaciones</p>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {session.observations || 'Sin observaciones registradas.'}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Retroalimentación</p>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900 whitespace-pre-wrap">
                      {session.feedback || 'Todavía no se ha registrado retroalimentación.'}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 lg:px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between gap-3">
                  <h2 className="font-bold text-blue-900">📊 Tabla de evaluación</h2>
                  {session.score !== null && session.score !== undefined && (
                    <span className="text-sm font-bold text-blue-700">Puntaje global: {session.score}/100</span>
                  )}
                </div>
                {items && items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-5 py-3 text-gray-500 font-medium">Criterio</th>
                          <th className="text-left px-5 py-3 text-gray-500 font-medium">Resultado</th>
                          <th className="text-left px-5 py-3 text-gray-500 font-medium">Puntaje</th>
                          <th className="text-left px-5 py-3 text-gray-500 font-medium">Comentario</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map(item => (
                          <tr key={item.id}>
                            <td className="px-5 py-3.5 text-gray-700">{item.criterion}</td>
                            <td className="px-5 py-3.5">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor[item.result] ?? 'bg-gray-100 text-gray-700'}`}>
                                {item.result}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-gray-600">{item.score ?? '—'}</td>
                            <td className="px-5 py-3.5 text-gray-500">{item.comment ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400">Sin criterios registrados.</div>
                )}
              </section>

              <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
                <h2 className="font-bold text-blue-900 mb-4">📷 Evidencias fotográficas ({photos?.length ?? 0})</h2>
                {photos && photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {photos.map(photo => (
                      <a key={photo.id} href={`/api/seguimientos/fotos/${photo.id}`} target="_blank" rel="noreferrer"
                        className="group border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                        {/* URL firmada temporal: no se usa next/image para evitar cachear archivos privados. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/seguimientos/fotos/${photo.id}`} alt={photo.file_name}
                          className="w-full h-40 object-cover group-hover:scale-105 transition-transform" />
                        <p className="text-xs text-gray-500 truncate px-2 py-2">{photo.file_name}</p>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No se agregaron fotografías a esta sesión.</p>
                )}
              </section>
            </div>

            <aside className="space-y-5">
              <section className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-bold text-blue-900 mb-3">👥 Usuarios evaluados</h2>
                <div className="space-y-3">
                  {participants && participants.length > 0 ? (participants as unknown as Participant[]).map(participant => (
                    <div key={participant.id} className="flex gap-3 items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {(participant.profiles?.full_name ?? participant.profiles?.email ?? '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{participant.profiles?.full_name ?? participant.profiles?.email ?? '—'}</p>
                        <p className="text-xs text-gray-400 truncate">{participant.profiles?.curso ?? session.courses?.name ?? '—'}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-400">Sin participantes registrados.</p>
                  )}
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-bold text-blue-900 mb-3">📌 Resumen</h2>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Ticket</dt><dd className="font-medium text-gray-700 text-right">{session.ticket}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Estado</dt><dd className="font-medium text-gray-700 text-right">{session.overall_status}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Criterios</dt><dd className="font-medium text-gray-700">{items?.length ?? 0}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Fotografías</dt><dd className="font-medium text-gray-700">{photos?.length ?? 0}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">Actualizado</dt><dd className="font-medium text-gray-700 text-right">{new Date(session.updated_at).toLocaleDateString('es-CL')}</dd></div>
                </dl>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
