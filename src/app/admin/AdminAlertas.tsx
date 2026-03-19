'use client'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AdminAlertas() {
  const supabase = createClient()
  const [alertas, setAlertas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlertas = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'error')
      .order('created_at', { ascending: false })
      .limit(20)
    setAlertas(data ?? [])
    setLoading(false)
  }

  const marcarInactiva = async (id: string) => {
    await supabase.from('notifications').update({ active: false }).eq('id', id)
    fetchAlertas()
  }

  const limpiarTodas = async () => {
    if (!confirm('¿Archivar todas las alertas de bloqueo revisadas?')) return
    await supabase.from('notifications').update({ active: false }).eq('type', 'error')
    fetchAlertas()
  }

  useEffect(() => {
    fetchAlertas()

    // Realtime: nueva alerta llega al instante
    const channel = supabase
      .channel('admin-alertas-bloqueo')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
      }, (payload) => {
        if ((payload.new as any).type === 'error') {
          setAlertas(prev => [payload.new, ...prev].slice(0, 20))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const activas = alertas.filter(a => a.active)
  const archivadas = alertas.filter(a => !a.active)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-blue-900">🚨 Alertas de bloqueo automático</h2>
          {activas.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {activas.length} nueva{activas.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/moderacion"
            className="text-xs text-blue-600 hover:underline font-medium">
            Ver moderación completa →
          </Link>
          {activas.length > 0 && (
            <button onClick={limpiarTodas}
              className="text-xs border border-gray-300 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
              Archivar todas
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm animate-pulse">Cargando alertas...</div>
      ) : activas.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-gray-400 text-sm">Sin bloqueos recientes. Todo tranquilo.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {activas.map(a => (
            <div key={a.id} className="flex items-start gap-4 px-6 py-4 bg-red-50 hover:bg-red-100 transition-colors">
              <div className="text-2xl shrink-0">🚨</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-red-800 text-sm">{a.title}</p>
                {a.message && (
                  <p className="text-xs text-red-600 mt-0.5">{a.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(a.created_at).toLocaleString('es-CL')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href="/admin/moderacion"
                  className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
                  Revisar
                </Link>
                <button onClick={() => marcarInactiva(a.id)}
                  className="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                  Archivar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archivadas recientes */}
      {archivadas.length > 0 && (
        <details className="border-t border-gray-100">
          <summary className="px-6 py-3 text-xs text-gray-400 cursor-pointer hover:bg-gray-50 select-none">
            Ver {archivadas.length} alerta{archivadas.length > 1 ? 's' : ''} archivada{archivadas.length > 1 ? 's' : ''}
          </summary>
          <div className="divide-y divide-gray-100">
            {archivadas.map(a => (
              <div key={a.id} className="flex items-start gap-4 px-6 py-3 opacity-60">
                <div className="text-xl shrink-0">📁</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{a.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(a.created_at).toLocaleString('es-CL')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
