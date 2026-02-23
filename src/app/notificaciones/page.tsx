'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

const tipos = ['info', 'warning', 'success', 'error']

const typeStyles: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  success: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

export default function NotificacionesPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', message: '', type: 'info', expires_at: ''
  })

  const fetch = async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
    setNotifications(data ?? [])
  }

  useEffect(() => { fetch() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('notifications').insert({
      ...form,
      expires_at: form.expires_at || null,
      created_by: user?.id
    })
    setForm({ title: '', message: '', type: 'info', expires_at: '' })
    setLoading(false)
    fetch()
  }

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('notifications').update({ active: !active }).eq('id', id)
    fetch()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta notificación?')) return
    await supabase.from('notifications').delete().eq('id', id)
    fetch()
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Notificaciones y Banners</h1>
          <p className="text-gray-500 mt-1">Gestiona los mensajes que aparecen en la plataforma</p>
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* Formulario */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-blue-900 mb-4">Nueva notificación</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Ej: Reunión de apoderados"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje</label>
                <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                  rows={2} placeholder="Detalle del mensaje..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expira el</label>
                  <input type="date" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
                {loading ? 'Guardando...' : '📢 Publicar notificación'}
              </button>
            </form>
          </div>

          {/* Lista */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-blue-900">Notificaciones activas ({notifications.length})</h3>
            </div>
            {notifications.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {notifications.map(n => (
                  <div key={n.id} className="px-5 py-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeStyles[n.type]}`}>{n.type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${n.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {n.active ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                        <p className="font-semibold text-gray-800 text-sm">{n.title}</p>
                        {n.message && <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>}
                        {n.expires_at && <p className="text-xs text-gray-400 mt-1">Expira: {n.expires_at}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleToggle(n.id, n.active)}
                          className="text-xs border border-gray-300 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                          {n.active ? '⏸️' : '▶️'}
                        </button>
                        <button onClick={() => handleDelete(n.id)}
                          className="text-xs border border-red-200 text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">Sin notificaciones aún</div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
