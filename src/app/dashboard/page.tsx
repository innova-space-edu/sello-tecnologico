import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { count: cursosCount } = await supabase.from('courses').select('*', { count: 'exact', head: true })
  const { count: proyectosCount } = await supabase.from('projects').select('*', { count: 'exact', head: true })
  const { count: evidenciasCount } = await supabase.from('evidences').select('*', { count: 'exact', head: true })

  const stats = [
    { label: 'Cursos', value: cursosCount ?? 0, icon: '📚', color: 'bg-blue-100 text-blue-700' },
    { label: 'Proyectos', value: proyectosCount ?? 0, icon: '🗂️', color: 'bg-indigo-100 text-indigo-700' },
    { label: 'Evidencias', value: evidenciasCount ?? 0, icon: '📎', color: 'bg-sky-100 text-sky-700' },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Bienvenido, {user?.email} — Sello Tecnológico Colegio Providencia
          </p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
              <div className={`text-3xl p-3 rounded-lg ${stat.color}`}>{stat.icon}</div>
              <div>
                <div className="text-3xl font-bold text-gray-800">{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Accesos rápidos */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">Accesos rápidos</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { href: '/cursos/nuevo', label: 'Crear nuevo curso', icon: '➕' },
              { href: '/proyectos/nuevo', label: 'Crear proyecto', icon: '🗂️' },
              { href: '/evidencias/nueva', label: 'Subir evidencia', icon: '📎' },
              { href: '/reportes', label: 'Ver reportes', icon: '📈' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
