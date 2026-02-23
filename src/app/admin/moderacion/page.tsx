import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import ModerationActions from './ModerationActions'

const categoryColor: Record<string, string> = {
  sexual: 'bg-red-100 text-red-700 border-red-300',
  bullying: 'bg-orange-100 text-orange-700 border-orange-300',
  discriminacion: 'bg-purple-100 text-purple-700 border-purple-300',
}

const categoryIcon: Record<string, string> = {
  sexual: '🔞',
  bullying: '😡',
  discriminacion: '⚠️',
}

export default async function ModeracionPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()

  if (perfil?.role !== 'admin') {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">🚫</div>
            <h2 className="text-lg font-semibold text-red-700">Acceso restringido</h2>
          </div>
        </main>
      </div>
    )
  }

  const { data: flagged } = await supabase
    .from('flagged_messages')
    .select(`
      *,
      sender:profiles!flagged_messages_sender_id_fkey(full_name, email, curso, role),
      receiver:profiles!flagged_messages_receiver_id_fkey(full_name, email, role)
    `)
    .order('created_at', { ascending: false })

  const pendientes = flagged?.filter(f => !f.reviewed) ?? []
  const revisados = flagged?.filter(f => f.reviewed) ?? []

  const sexual = flagged?.filter(f => f.category === 'sexual').length ?? 0
  const bullying = flagged?.filter(f => f.category === 'bullying').length ?? 0
  const discriminacion = flagged?.filter(f => f.category === 'discriminacion').length ?? 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin" className="text-blue-600 text-sm hover:underline">← Panel Admin</Link>
          </div>
          <h1 className="text-2xl font-bold text-blue-900">Moderación de Mensajes</h1>
          <p className="text-gray-500 mt-1 text-sm">Detección automática de contenido inapropiado</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Pendientes', value: pendientes.length, icon: '🚨', color: 'bg-red-100 text-red-700' },
            { label: 'Contenido sexual', value: sexual, icon: '🔞', color: 'bg-red-100 text-red-700' },
            { label: 'Bullying', value: bullying, icon: '😡', color: 'bg-orange-100 text-orange-700' },
            { label: 'Discriminación', value: discriminacion, icon: '⚠️', color: 'bg-purple-100 text-purple-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <div className={`text-xl p-2.5 rounded-lg ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-xl font-bold text-gray-800">{s.value}</div>
                <div className="text-gray-500 text-xs">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Alertas pendientes */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="text-xl">🚨</span>
            <h2 className="font-semibold text-red-700">
              Mensajes pendientes de revisión ({pendientes.length})
            </h2>
          </div>

          {pendientes.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {pendientes.map(f => (
                <div key={f.id} className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">

                      {/* Categoría y palabras */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${categoryColor[f.category] ?? 'bg-gray-100'}`}>
                          {categoryIcon[f.category]} {f.category}
                        </span>
                        {f.matched_words?.map((w: string) => (
                          <span key={w} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                            {w}
                          </span>
                        ))}
                      </div>

                      {/* Mensaje */}
                      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-3">
                        <p className="text-sm text-gray-800">{f.content}</p>
                      </div>

                      {/* Usuarios */}
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <div>
                          <span className="font-medium text-gray-700">De: </span>
                          {f.sender?.full_name ?? f.sender?.email ?? '—'}
                          {f.sender?.curso && <span className="ml-1 text-gray-400">({f.sender.curso})</span>}
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Para: </span>
                          {f.receiver?.full_name ?? f.receiver?.email ?? '—'}
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Fecha: </span>
                          {new Date(f.created_at).toLocaleString('es-CL')}
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <ModerationActions flagId={f.id} senderId={f.sender_id} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-gray-400">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-medium">Sin alertas pendientes</p>
              <p className="text-sm mt-1">No se ha detectado contenido inapropiado</p>
            </div>
          )}
        </div>

        {/* Revisados */}
        {revisados.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-600">Revisados ({revisados.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Categoría</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Mensaje</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">De</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {revisados.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50 opacity-60">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor[f.category] ?? 'bg-gray-100'}`}>
                          {categoryIcon[f.category]} {f.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                        <p className="truncate">{f.content}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{f.sender?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(f.created_at).toLocaleDateString('es-CL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
