import Sidebar from '@/components/Sidebar'
import FollowupRealtimeRefresh from '@/components/seguimientos/FollowupRealtimeRefresh'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

type SessionSummary = {
  id: string
  followup_date: string
  created_at: string
  overall_status: string
  ticket: string
  subject: string
  score?: number | null
  iteration_number?: number | null
  courses?: { name?: string | null } | null
  projects?: { title?: string | null } | null
  teacher?: { full_name?: string | null } | null
  followup_participants?: { id: string }[] | null
  followup_items?: { id: string }[] | null
  followup_photos?: { id: string }[] | null
}

type ParticipantWithFollowup = { followup?: SessionSummary | null }

const statusColor: Record<string, string> = {
  'Pendiente': 'bg-gray-100 text-gray-700',
  'En proceso': 'bg-blue-100 text-blue-700',
  'Logrado': 'bg-green-100 text-green-700',
  'Requiere apoyo': 'bg-orange-100 text-orange-700',
}

export default async function SeguimientosPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user?.id ?? '')
    .single()

  const role = profile?.role ?? ''
  const canCreate = ['docente', 'admin', 'coordinador', 'utp'].includes(role)

  let sessions: SessionSummary[] = []
  if (canCreate) {
    const { data } = await supabase
      .from('project_followups')
      .select(`
        *,
        courses(name),
        projects(title),
        followup_participants(id, user_id, profiles(full_name, email, curso)),
        followup_items(id),
        followup_photos(id)
      `)
      .order('followup_date', { ascending: false })
      .order('created_at', { ascending: false })
    sessions = (data ?? []) as unknown as SessionSummary[]
  } else {
    const { data } = await supabase
      .from('followup_participants')
      .select(`
        id,
        followup:project_followups(
          *,
          courses(name),
          projects(title),
          teacher:profiles!project_followups_teacher_id_fkey(full_name),
          followup_participants(id, user_id, profiles(full_name, email, curso)),
          followup_items(id),
          followup_photos(id)
        )
      `)
      .eq('user_id', user?.id ?? '')
    const assignedRows = (data ?? []) as unknown as ParticipantWithFollowup[]
    sessions = assignedRows
      .map(row => row.followup)
      .filter((session): session is SessionSummary => Boolean(session))
      .sort((a, b) => `${b.followup_date}${b.created_at}`.localeCompare(`${a.followup_date}${a.created_at}`))
  }

  const totalSessions = sessions.length
  const pending = sessions.filter(session => session.overall_status === 'Pendiente' || session.overall_status === 'En proceso').length
  const withPhotos = sessions.filter(session => (session.followup_photos?.length ?? 0) > 0).length

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <FollowupRealtimeRefresh mode="list" />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Seguimiento de proyectos</h1>
            <p className="text-gray-500 mt-1">
              {canCreate
                ? 'Registra sesiones, evalúa avances y entrega retroalimentación a tus estudiantes.'
                : 'Revisa las evaluaciones y retroalimentaciones asociadas a tus proyectos.'}
            </p>
          </div>
          {canCreate && (
            <Link href="/seguimientos/nuevo"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm">
              + Nueva sesión
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Sesiones registradas', value: totalSessions, icon: '🧭', color: 'bg-blue-100 text-blue-700' },
            { label: 'Pendientes o en proceso', value: pending, icon: '🕐', color: 'bg-yellow-100 text-yellow-700' },
            { label: 'Con fotografías', value: withPhotos, icon: '📷', color: 'bg-green-100 text-green-700' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl shadow-sm p-5 flex gap-4 items-center">
              <div className={`text-2xl p-3 rounded-lg ${card.color}`}>{card.icon}</div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 lg:px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-blue-900">{canCreate ? 'Historial docente' : 'Mis evaluaciones recibidas'}</h2>
          </div>
          {sessions.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {sessions.map(session => (
                <Link key={session.id} href={`/seguimientos/${session.id}`}
                  className="block px-5 lg:px-6 py-4 hover:bg-blue-50 transition-colors">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor[session.overall_status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {session.overall_status}
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-purple-100 text-purple-700">Seguimiento {session.iteration_number ?? 1}</span>
                        <span className="text-xs text-gray-400">🎫 {session.ticket}</span>
                      </div>
                      <h3 className="font-semibold text-gray-800 truncate">{session.projects?.title ?? 'Proyecto sin título'}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {session.courses?.name ?? 'Sin curso'} · {session.subject}
                      </p>
                      {!canCreate && session.teacher?.full_name && (
                        <p className="text-xs text-gray-400 mt-1">Docente: {session.teacher.full_name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-gray-700">
                        {new Date(`${session.followup_date}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        👥 {session.followup_participants?.length ?? 0} · 📊 {session.followup_items?.length ?? 0} · 📷 {session.followup_photos?.length ?? 0}
                      </p>
                      {session.score !== null && session.score !== undefined && (
                        <p className="text-sm font-bold text-blue-700 mt-1">{session.score}/100</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">🧭</div>
              <p>{canCreate ? 'Todavía no has registrado sesiones de seguimiento.' : 'Todavía no tienes evaluaciones de seguimiento asignadas.'}</p>
              {canCreate && (
                <Link href="/seguimientos/nuevo" className="inline-block mt-3 text-blue-600 hover:underline text-sm">
                  Crear la primera sesión →
                </Link>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
