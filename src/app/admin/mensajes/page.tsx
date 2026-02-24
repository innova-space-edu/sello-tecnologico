'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const roleColor: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  coordinador: 'bg-blue-100 text-blue-700',
  docente: 'bg-green-100 text-green-700',
  estudiante: 'bg-sky-100 text-sky-700',
}

export default function AdminMensajesPage() {
  const supabase = createClient()
  const [mensajes, setMensajes] = useState<any[]>([])
  const [rol, setRol] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedConv, setSelectedConv] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchMensajes = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, email, role), receiver:profiles!messages_receiver_id_fkey(full_name, email, role)')
      .order('created_at', { ascending: false })
      .limit(300)
    setMensajes(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRol(perfil?.role ?? '')
      fetchMensajes()
    }
    init()
  }, [])

  // Agrupar conversaciones
  const conversaciones: Record<string, any> = {}
  mensajes.forEach(m => {
    const key = [m.sender_id, m.receiver_id].sort().join('-')
    if (!conversaciones[key]) {
      conversaciones[key] = {
        key,
        sender_id: m.sender_id,
        receiver_id: m.receiver_id,
        sender: m.sender,
        receiver: m.receiver,
        ultimo_mensaje: m.content,
        ultima_fecha: m.created_at,
        total: 0,
      }
    }
    conversaciones[key].total++
  })

  const listaConversaciones = Object.values(conversaciones).sort(
    (a, b) => new Date(b.ultima_fecha).getTime() - new Date(a.ultima_fecha).getTime()
  )

  const mensajesFiltrados = selectedConv
    ? mensajes.filter(m => [m.sender_id, m.receiver_id].sort().join('-') === selectedConv)
    : mensajes

  const handleDeleteMensaje = async (id: string) => {
    if (!confirm('¿Eliminar este mensaje?')) return
    setDeletingId(id)
    await supabase.from('messages').delete().eq('id', id)
    await fetchMensajes()
    setDeletingId(null)
  }

  const handleDeleteConversacion = async (conv: any) => {
    if (!confirm(`¿Eliminar TODOS los mensajes entre ${conv.sender?.full_name ?? '?'} y ${conv.receiver?.full_name ?? '?'}? Esta acción no se puede deshacer.`)) return
    await supabase.from('messages')
      .delete()
      .or(`and(sender_id.eq.${conv.sender_id},receiver_id.eq.${conv.receiver_id}),and(sender_id.eq.${conv.receiver_id},receiver_id.eq.${conv.sender_id})`)
    setSelectedConv(null)
    await fetchMensajes()
  }

  if (rol && rol !== 'admin') {
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

  const convSeleccionada = selectedConv ? conversaciones[selectedConv] : null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/admin" className="text-blue-600 text-sm hover:underline">← Panel Admin</Link>
          <div className="flex justify-between items-start mt-2">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">Monitoreo de Mensajes</h1>
              <p className="text-gray-500 mt-1 text-sm">
                {mensajes.length} mensajes totales · {listaConversaciones.length} conversaciones
              </p>
            </div>
            {selectedConv && (
              <button onClick={() => setSelectedConv(null)}
                className="text-sm text-blue-600 hover:underline">
                ← Ver todas
              </button>
            )}
          </div>
          <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 inline-flex items-center gap-2">
            <span>⚠️</span>
            <span className="text-yellow-700 text-xs font-medium">Los usuarios no son notificados de este monitoreo</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Lista de conversaciones */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-blue-900">Conversaciones ({listaConversaciones.length})</h2>
            </div>
            <div className="divide-y divide-gray-100 overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {listaConversaciones.length > 0 ? listaConversaciones.map(conv => (
                <div key={conv.key}
                  className={`px-5 py-4 hover:bg-blue-50 transition-colors cursor-pointer ${
                    selectedConv === conv.key ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                  onClick={() => setSelectedConv(conv.key)}>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl shrink-0">💬</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="text-xs font-semibold text-gray-800 truncate">
                          {conv.sender?.full_name ?? conv.sender?.email ?? '—'}
                        </span>
                        <span className="text-xs text-gray-400">→</span>
                        <span className="text-xs font-semibold text-gray-800 truncate">
                          {conv.receiver?.full_name ?? conv.receiver?.email ?? '—'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{conv.ultimo_mensaje}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-400">
                          {new Date(conv.ultima_fecha).toLocaleDateString('es-CL')}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {conv.total} msgs
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-gray-400 text-sm">No hay conversaciones aún</div>
              )}
            </div>
          </div>

          {/* Mensajes */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">

            {/* Header tabla mensajes */}
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-blue-900">
                {convSeleccionada
                  ? `Conversación: ${convSeleccionada.sender?.full_name ?? '?'} → ${convSeleccionada.receiver?.full_name ?? '?'}`
                  : 'Todos los mensajes recientes'
                }
              </h2>
              <div className="flex gap-2">
                {convSeleccionada && (
                  <button onClick={() => handleDeleteConversacion(convSeleccionada)}
                    className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
                    🗑️ Eliminar toda la conversación
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Cargando mensajes...</div>
              ) : mensajesFiltrados.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">De</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Para</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Mensaje</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Fecha</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mensajesFiltrados.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50 group">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 text-xs">{m.sender?.full_name ?? '—'}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${roleColor[m.sender?.role] ?? 'bg-gray-100 text-gray-500'}`}>
                            {m.sender?.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 text-xs">{m.receiver?.full_name ?? '—'}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${roleColor[m.receiver?.role] ?? 'bg-gray-100 text-gray-500'}`}>
                            {m.receiver?.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-xs max-w-xs">
                          <p className="line-clamp-2">{m.content}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(m.created_at).toLocaleDateString('es-CL')}
                          <br />
                          {new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteMensaje(m.id)}
                            disabled={deletingId === m.id}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg disabled:opacity-50"
                            title="Eliminar mensaje">
                            {deletingId === m.id ? '...' : '🗑️'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">No hay mensajes aún</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
