import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const actionColor: Record<string, string> = {
  'crear': 'bg-green-100 text-green-700',
  'eliminar': 'bg-red-100 text-red-700',
  'actualizar': 'bg-blue-100 text-blue-700',
  'importar': 'bg-purple-100 text-purple-700',
}

const entityIcon: Record<string, string> = {
  'curso': '📚',
  'proyecto': '🗂️',
  'evidencia': '📎',
  'usuario': '👥',
  'comentario': '💬',
}

export default async function HistorialPage() {
  const supabase = await createServerSupabaseClient()

  const { data: logs } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Historial de movimientos</h1>
          <p className="text-gray-500 mt-1">Registro de todas las acciones realizadas en el sistema</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          {logs && logs.length > 0 ? (
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
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${actionColor[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {entityIcon[log.entity] ?? '📋'} {log.entity}
                    </td>
                    <td className="px-6 py-3 text-gray-800 font-medium">{log.entity_name ?? '—'}</td>
                    <td className="px-6 py-3 text-gray-500">{log.user_email ?? '—'}</td>
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
              <p>No hay movimientos registrados aún</p>
              <p className="text-xs mt-2">Las acciones aparecerán aquí automáticamente</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
