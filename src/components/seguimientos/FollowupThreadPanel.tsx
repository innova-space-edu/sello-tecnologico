import Link from 'next/link'
import CreateNextFollowupButton from '@/components/seguimientos/CreateNextFollowupButton'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type Props = {
  sessionId: string
  seriesId: string
  subject: string
  canEdit: boolean
}

type HistoryEntry = {
  id: string
  followup_date: string
  overall_status: string
  score?: number | null
  ticket: string
  iteration_number?: number | null
}

const statusColor: Record<string, string> = {
  Pendiente: 'bg-gray-100 text-gray-700',
  'En proceso': 'bg-blue-100 text-blue-700',
  Logrado: 'bg-green-100 text-green-700',
  'Requiere apoyo': 'bg-orange-100 text-orange-700',
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function FollowupThreadPanel({ sessionId, seriesId, subject, canEdit }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('project_followups')
    .select('id, followup_date, overall_status, score, ticket, iteration_number')
    .eq('series_id', seriesId)
    .order('iteration_number', { ascending: true })

  const history = (data ?? []) as HistoryEntry[]
  const latest = history[history.length - 1]
  const isLatest = latest?.id === sessionId

  return (
    <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
        <div>
          <h2 className="font-bold text-blue-900">🔗 Historial de seguimiento</h2>
          <p className="text-sm text-gray-500 mt-1">
            Cada evaluación permanece guardada para que los usuarios asignados revisen la evolución y la retroalimentación.
          </p>
        </div>
        {canEdit && isLatest && (
          <CreateNextFollowupButton previousFollowupId={sessionId} subject={subject} />
        )}
      </div>

      {history.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {history.map((entry) => {
            const active = entry.id === sessionId
            return (
              <Link key={entry.id} href={`/seguimientos/${entry.id}`}
                className={`border rounded-xl p-4 transition-colors ${active ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <p className={`text-sm font-bold ${active ? 'text-blue-800' : 'text-gray-700'}`}>
                      Seguimiento {entry.iteration_number ?? 1}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(entry.followup_date)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor[entry.overall_status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {entry.overall_status}
                  </span>
                </div>
                <div className="mt-3 flex justify-between gap-3 text-xs">
                  <span className="text-gray-400 truncate">🎫 {entry.ticket}</span>
                  <span className="font-bold text-blue-700 shrink-0">
                    {entry.score === null || entry.score === undefined ? 'Sin puntaje' : `${entry.score}/100`}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : <p className="text-sm text-gray-400">No fue posible cargar el historial.</p>}

      {!isLatest && latest && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <p className="text-sm text-yellow-800">Este seguimiento tiene una evaluación posterior. Para continuar el hilo debes abrir el seguimiento más reciente.</p>
          <Link href={`/seguimientos/${latest.id}`} className="inline-block text-sm font-semibold text-yellow-900 hover:underline mt-2">
            Abrir seguimiento {latest.iteration_number ?? 'más reciente'} →
          </Link>
        </div>
      )}
    </section>
  )
}
