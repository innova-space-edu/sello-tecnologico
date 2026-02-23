import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('profiles').select('*').eq('id', user?.id ?? '').single()

  const { count: cursosCount } = await supabase.from('courses').select('*', { count: 'exact', head: true })
  const { count: proyectosCount } = await supabase.from('projects').select('*', { count: 'exact', head: true })
  const { count: evidenciasCount } = await supabase.from('evidences').select('*', { count: 'exact', head: true })
  const { count: usuariosCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })

  const hoy = new Date().toISOString().split('T')[0]
  const { data: atrasados } = await supabase
    .from('projects')
    .select('id, title, end_date, status, courses(name)')
    .lt('end_date', hoy)
    .not('status', 'in', '("Aprobado","Cerrado")')
    .order('end_date', { ascending: true })

  const { data: enRevision } = await supabase
    .from('projects')
    .select('id, title, courses(name)')
    .eq('status', 'En revisión')

  const { data: ultimasEvidencias } = await supabase
    .from('evidences')
    .select('id, title, type, created_at, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    { label: 'Cursos', value: cursosCount ?? 0, icon: '📚', color: 'bg-blue-100 text-blue-700', href: '/cursos' },
    { label: 'Proyectos', value: proyectosCount ?? 0, icon: '🗂️', color: 'bg-indigo-100 text-indigo-700', href: '/proyectos' },
    { label: 'Evidencias', value: evidenciasCount ?? 0, icon: '📎', color: 'bg-sky-100 text-sky-700', href: '/evidencias' },
    { label: 'Usuarios', value: usuariosCount ?? 0, icon: '👥', color: 'bg-purple-100 text-purple-700', href: '/usuarios' },
  ]

  const typeIcon: Record<string, string> = {
    'documento': '📄', 'foto': '🖼️', 'video': '🎥',
    'enlace': '🔗', 'presentación': '📊', 'código': '💻',
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      {/* Main — con padding-top en móvil para el botón hamburguesa */}
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-blue-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Bienvenido, <span className="font-medium">{perfil?.full_name ?? user?.email}</span>
            {perfil?.role && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{perfil.role}</span>
            )}
          </p>
        </div>

        {/* Alertas de atrasos */}
        {atrasados && atrasados.length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🚨</span>
              <h2 className="font-semibold text-red-700 text-sm">Proyectos atrasados ({atrasados.length})</h2>
            </div>
            <div className="space-y-2">
              {atrasados.map((p: any) => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg px-3 py-2 border border-red-100 gap-1">
                  <Link href={`/proyectos/${p.id}`} className="font-medium text-red-700 hover:underline text-sm">
                    {p.title}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500">Venció: {p.end_date}</span>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alertas en revisión */}
        {enRevision && enRevision.length > 0 && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⏳</span>
              <h2 className="font-semibold text-yellow-700 text-sm">Pendientes de revisión ({enRevision.length})</h2>
            </div>
            <div className="space-y-2">
              {enRevision.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-yellow-100">
                  <Link href={`/proyectos/${p.id}`} className="font-medium text-yellow-700 hover:underline text-sm">
                    {p.title}
                  </Link>
                  <span className="text-xs text-gray-400">{p.courses?.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats — 2 columnas en móvil, 4 en desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6">
          {stats.map(s => (
            <Link key={s.label} href={s.href}
              className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className={`text-xl p-2.5 rounded-lg ${s.color} shrink-0`}>{s.icon}</div>
              <div className="min-w-0">
                <div className="text-xl font-bold text-gray-800">{s.value}</div>
                <div className="text-gray-500 text-xs truncate">{s.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Accesos rápidos + Evidencias — 1 col móvil, 2 col desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Accesos rápidos */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-base font-semibold text-blue-900 mb-4">Accesos rápidos</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/cursos/nuevo', label: 'Nuevo curso', icon: '📚' },
                { href: '/proyectos/nuevo', label: 'Nuevo proyecto', icon: '🗂️' },
                { href: '/evidencias/nueva', label: 'Nueva evidencia', icon: '📎' },
                { href: '/reportes', label: 'Ver reportes', icon: '📈' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-xs font-medium text-gray-700 leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Últimas evidencias */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-blue-900 text-base">Últimas evidencias</h2>
            </div>
            {ultimasEvidencias && ultimasEvidencias.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {ultimasEvidencias.map((ev: any) => (
                  <div key={ev.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-xl shrink-0">{typeIcon[ev.type] ?? '📎'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
                      <p className="text-xs text-gray-400 truncate">{ev.profiles?.full_name ?? '—'}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(ev.created_at).toLocaleDateString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">Sin evidencias aún</div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
