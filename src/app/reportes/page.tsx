import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ReportesCharts from './ReportesCharts'

export default async function ReportesPage() {
  const supabase = await createServerSupabaseClient()

  const { count: cursosCount } = await supabase.from('courses').select('*', { count: 'exact', head: true })
  const { count: proyectosCount } = await supabase.from('projects').select('*', { count: 'exact', head: true })
  const { count: evidenciasCount } = await supabase.from('evidences').select('*', { count: 'exact', head: true })
  const { data: usuarios } = await supabase.from('profiles').select('role, created_at')
  const { data: proyectos } = await supabase.from('projects').select('status, created_at, type')
  const { data: evidencias } = await supabase.from('evidences').select('type, created_at')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Reportes</h1>
          <p className="text-gray-500 mt-1">Estadísticas generales del Sello Tecnológico</p>
        </div>

        {/* Totales */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          {[
            { label: 'Cursos', value: cursosCount ?? 0, icon: '📚', color: 'bg-blue-100 text-blue-700' },
            { label: 'Proyectos', value: proyectosCount ?? 0, icon: '🗂️', color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Evidencias', value: evidenciasCount ?? 0, icon: '📎', color: 'bg-sky-100 text-sky-700' },
            { label: 'Usuarios', value: usuarios?.length ?? 0, icon: '👥', color: 'bg-purple-100 text-purple-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
              <div className={`text-2xl p-3 rounded-lg ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <ReportesCharts
          usuarios={usuarios ?? []}
          proyectos={proyectos ?? []}
          evidencias={evidencias ?? []}
        />
      </main>
    </div>
  )
}
