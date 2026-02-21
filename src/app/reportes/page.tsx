import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function ReportesPage() {
  const supabase = await createServerSupabaseClient()

  const { count: cursosCount } = await supabase.from('courses').select('*', { count: 'exact', head: true })
  const { count: proyectosCount } = await supabase.from('projects').select('*', { count: 'exact', head: true })
  const { count: evidenciasCount } = await supabase.from('evidences').select('*', { count: 'exact', head: true })
  const { data: porEstado } = await supabase.from('projects').select('status')

  const estados: Record<string, number> = {}
  porEstado?.forEach(p => { estados[p.status] = (estados[p.status] ?? 0) + 1 })

  const estadoColores: Record<string, string> = {
    'Borrador': 'bg-gray-100 text-gray-600',
    'En progreso': 'bg-blue-100 text-blue-700',
    'En revisión': 'bg-yellow-100 text-yellow-700',
    'Aprobado': 'bg-green-100 text-green-700',
    'Cerrado': 'bg-red-100 text-red-600',
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Reportes</h1>
          <p className="text-gray-500 mt-1">Resumen general del Sello Tecnológico</p>
        </div>

        {/* Totales */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Cursos activos', value: cursosCount ?? 0, icon: '📚', color: 'bg-blue-100 text-blue-700' },
            { label: 'Proyectos totales', value: proyectosCount ?? 0, icon: '🗂️', color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Evidencias registradas', value: evidenciasCount ?? 0, icon: '📎', color: 'bg-sky-100 text-sky-700' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
              <div className={`text-3xl p-3 rounded-lg ${stat.color}`}>{stat.icon}</div>
              <div>
                <div className="text-3xl font-bold text-gray-800">{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Proyectos por estado */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">Proyectos por estado</h2>
          {Object.keys(estados).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(estados).map(([estado, cantidad]) => (
                <div key={estado} className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColores[estado] ?? 'bg-gray-100'}`}>
                    {estado}
                  </span>
                  <div className="flex items-center gap-3 flex-1 mx-4">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(cantidad / (proyectosCount || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-right">{cantidad}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No hay proyectos aún para reportar.</p>
          )}
        </div>
      </main>
    </div>
  )
}
