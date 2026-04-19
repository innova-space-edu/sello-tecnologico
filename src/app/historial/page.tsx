'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@supabase/supabase-js'

type AuditLog = {
  id: string
  action: string
  entity: string
  entity_name: string | null
  user_email: string | null
  created_at: string
}

const actionColor: Record<string, string> = {
  crear: 'bg-green-100 text-green-700',
  eliminar: 'bg-red-100 text-red-700',
  actualizar: 'bg-blue-100 text-blue-700',
  importar: 'bg-purple-100 text-purple-700',
}

const entityIcon: Record<string, string> = {
  curso: '📚',
  proyecto: '🗂️',
  evidencia: '📎',
  usuario: '👥',
  comentario: '💬',
}

export default function HistorialPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('todos')
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anon) {
      throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }

    return createClient(url, anon)
  }, [])

  const cargarHistorial = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true)
        else setRefreshing(true)

        const { data, error } = await supabase
          .from('audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)

        if (error) {
          console.error('Error cargando historial:', error)
          return
        }

        setLogs((data as AuditLog[]) ?? [])
        setLastUpdate(new Date().toLocaleString('es-CL'))
      } catch (err) {
        console.error('Error inesperado cargando historial:', err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [supabase]
  )

  useEffect(() => {
    cargarHistorial()

    const channel = supabase
      .channel('audit-log-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_log',
        },
        () => {
          cargarHistorial(true)
        }
      )
      .subscribe()

    const interval = setInterval(() => {
      cargarHistorial(true)
    }, 15000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [cargarHistorial, supabase])

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      search.trim() === '' ||
      log.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase())

    const matchesAction = actionFilter === 'todos' || log.action === actionFilter

    return matchesSearch && matchesAction
  })

  const totalCrear = logs.filter((l) => l.action === 'crear').length
  const totalActualizar = logs.filter((l) => l.action === 'actualizar').length
  const totalEliminar = logs.filter((l) => l.action === 'eliminar').length
  const totalImportar = logs.filter((l) => l.action === 'importar').length

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="lg:ml-64 flex-1 min-w-0 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-blue-900">Historial de movimientos</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Registro de acciones realizadas en el sistema
            </p>
            {lastUpdate && (
              <p className="text-xs text-gray-400 mt-1">
                Última actualización: {lastUpdate}
              </p>
            )}
          </div>

          <button
            onClick={() => cargarHistorial(true)}
            disabled={refreshing}
            className="self-start lg:self-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {refreshing ? 'Actualizando...' : 'Actualizar ahora'}
          </button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500">Total registros</p>
            <p className="text-xl font-bold text-gray-800">{logs.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-green-100">
            <p className="text-xs text-gray-500">Crear</p>
            <p className="text-xl font-bold text-green-700">{totalCrear}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-blue-100">
            <p className="text-xs text-gray-500">Actualizar</p>
            <p className="text-xl font-bold text-blue-700">{totalActualizar}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-red-100">
            <p className="text-xs text-gray-500">Eliminar</p>
            <p className="text-xl font-bold text-red-700">{totalEliminar}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-purple-100">
            <p className="text-xs text-gray-500">Importar</p>
            <p className="text-xl font-bold text-purple-700">{totalImportar}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Buscar
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por elemento, usuario o acción..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Filtrar por acción
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="todos">Todas</option>
                <option value="crear">Crear</option>
                <option value="actualizar">Actualizar</option>
                <option value="eliminar">Eliminar</option>
                <option value="importar">Importar</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-gray-100">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">⏳</div>
              <p>Cargando historial...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Acción</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Elemento</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Nombre</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Usuario</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Fecha y hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          actionColor[log.action] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {entityIcon[log.entity] ?? '📋'} {log.entity}
                    </td>
                    <td className="px-6 py-3 text-gray-800 font-medium">
                      {log.entity_name ?? '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {log.user_email ?? '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-400 text-xs">
                      {new Date(log.created_at).toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p>No hay movimientos registrados con ese filtro</p>
              <p className="text-xs mt-2">Prueba cambiando la búsqueda o el tipo de acción</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
