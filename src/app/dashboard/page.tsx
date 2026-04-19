import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single()

  const role = perfil?.role ?? ''
  const isAdmin = role === 'admin'
  const isDocente = role === 'docente'
  const isAdminOrDocente = isAdmin || isDocente

  const { count: cursosCount } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })

  const { count: proyectosCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })

  const { count: evidenciasCount } = await supabase
    .from('evidences')
    .select('*', { count: 'exact', head: true })

  const { count: usuariosCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const hoy = new Date().toISOString().split('T')[0]

  const { data: invitacionesPendientes } = await supabase
    .from('project_invitations')
    .select(
      'id, projects(title), courses(name), profiles!project_invitations_enviado_por_fkey(full_name), created_at'
    )
    .eq('estudiante_id', user?.id ?? '')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })

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
    {
      label: 'Cursos',
      value: cursosCount ?? 0,
      icon: '📚',
      color: 'bg-blue-100 text-blue-700',
      href: '/cursos',
      visible: true,
    },
    {
      label: 'Proyectos',
      value: proyectosCount ?? 0,
      icon: '🗂️',
      color: 'bg-indigo-100 text-indigo-700',
      href: '/proyectos',
      visible: true,
    },
    {
      label: 'Evidencias',
      value: evidenciasCount ?? 0,
      icon: '📎',
      color: 'bg-sky-100 text-sky-700',
      href: '/evidencias',
      visible: true,
    },
    {
      label: 'Usuarios',
      value: usuariosCount ?? 0,
      icon: '👥',
      color: 'bg-purple-100 text-purple-700',
      href: '/usuarios',
      visible: isAdminOrDocente,
    },
  ].filter((s) => s.visible)

  const accesosRapidos = [
    { href: '/cursos/nuevo', label: 'Nuevo curso', icon: '📚', visible: isAdminOrDocente },
    { href: '/proyectos/nuevo', label: 'Nuevo proyecto', icon: '🗂️', visible: true },
    { href: '/evidencias/nueva', label: 'Nueva evidencia', icon: '📎', visible: true },
    { href: '/portafolio', label: 'Ver portafolio', icon: '📝', visible: true },
    { href: '/reportes', label: 'Ver reportes', icon: '📈', visible: isAdminOrDocente },
    { href: '/usuarios', label: 'Gestionar usuarios', icon: '👥', visible: isAdmin },
  ].filter((item) => item.visible)

  const typeIcon: Record<string, string> = {
    documento: '📄',
    foto: '🖼️',
    video: '🎥',
    enlace: '🔗',
    presentación: '📊',
    código: '💻',
  }

  const totalAtrasados = atrasados?.length ?? 0
  const totalRevision = enRevision?.length ?? 0
  const totalInvitaciones = invitacionesPendientes?.length ?? 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="lg:ml-64 flex-1 min-w-0 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-blue-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Bienvenido, <span className="font-medium">{perfil?.full_name ?? user?.email}</span>
            {perfil?.role && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {perfil.role}
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {isAdminOrDocente && (
            <div className="bg-white rounded-xl border border-yellow-200 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="text-xl bg-yellow-100 text-yellow-700 rounded-lg px-3 py-2">⚠️</div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">Proyectos atrasados</p>
                  <p className="text-xl font-bold text-yellow-700">{totalAtrasados}</p>
                </div>
              </div>
              <div className="mt-3">
                <Link
                  href="/proyectos?filtro=atrasados"
                  className="inline-flex items-center text-xs font-semibold text-yellow-700 hover:text-yellow-800"
                >
                  Ver detalles →
                </Link>
              </div>
            </div>
          )}

          {isAdminOrDocente && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="text-xl bg-amber-100 text-amber-700 rounded-lg px-3 py-2">⏳</div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">Pendientes de revisión</p>
                  <p className="text-xl font-bold text-amber-700">{totalRevision}</p>
                </div>
              </div>
              <div className="mt-3">
                <Link
                  href="/proyectos?filtro=en-revision"
                  className="inline-flex items-center text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  Revisar ahora →
                </Link>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="text-xl bg-blue-100 text-blue-700 rounded-lg px-3 py-2">📨</div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Invitaciones pendientes</p>
                <p className="text-xl font-bold text-blue-700">{totalInvitaciones}</p>
              </div>
            </div>
            <div className="mt-3">
              <Link
                href="/proyectos/aceptar"
                className="inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Ver invitaciones →
              </Link>
            </div>
          </div>
        </div>

        {invitacionesPendientes && invitacionesPendientes.length > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📨</span>
              <h2 className="font-semibold text-blue-700 text-sm">
                Invitaciones de proyecto ({invitacionesPendientes.length})
              </h2>
            </div>

            <div className="space-y-2">
              {invitacionesPendientes.slice(0, 3).map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg px-3 py-2.5 border border-blue-100 gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-blue-800 text-sm truncate">
                      {inv.projects?.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {inv.profiles?.full_name ?? 'Tu docente'} · {inv.courses?.name}
                    </p>
                  </div>
                  <Link
                    href={`/proyectos/aceptar?inv=${inv.id}`}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Ver invitación →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdminOrDocente && atrasados && atrasados.length > 0 && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-yellow-600 text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-yellow-800 text-sm">
                  Tienes {atrasados.length} proyectos atrasados
                </p>
                <p className="text-xs text-yellow-700">
                  Revisa y gestiona los proyectos pendientes sin mostrar toda la lista aquí.
                </p>
              </div>
            </div>

            <Link
              href="/proyectos?filtro=atrasados"
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-xs font-semibold text-center"
            >
              Ver detalles
            </Link>
          </div>
        )}

        {isAdminOrDocente && enRevision && enRevision.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-amber-600 text-xl">⏳</span>
              <div>
                <p className="font-semibold text-amber-800 text-sm">
                  Tienes {enRevision.length} proyectos pendientes de revisión
                </p>
                <p className="text-xs text-amber-700">
                  Accede al listado completo para revisarlos con más comodidad.
                </p>
              </div>
            </div>

            <Link
              href="/proyectos?filtro=en-revision"
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-semibold text-center"
            >
              Ir a revisión
            </Link>
          </div>
        )}

        <div className={`grid ${stats.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'} gap-3 lg:gap-5 mb-6`}>
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="bg-white rounded-xl shadow-sm p-3 lg:p-4 flex items-center gap-2 lg:gap-3 hover:shadow-md transition-shadow min-w-0"
            >
              <div className={`text-base lg:text-xl p-2 lg:p-2.5 rounded-lg shrink-0 ${s.color}`}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className="text-lg lg:text-xl font-bold text-gray-800 leading-tight">
                  {s.value}
                </div>
                <div className="text-gray-500 text-xs truncate">{s.label}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 lg:p-5">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-base font-semibold text-blue-900">Accesos rápidos</h2>
              <span className="text-xs text-gray-400">
                {isAdminOrDocente ? 'Administración y gestión' : 'Acciones disponibles'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {accesosRapidos.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-lg shrink-0">{item.icon}</span>
                  <span className="text-xs font-medium text-gray-700 leading-tight">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 lg:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-blue-900 text-base">Últimas evidencias</h2>
              <Link
                href="/evidencias"
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Ver todas →
              </Link>
            </div>

            {ultimasEvidencias && ultimasEvidencias.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {ultimasEvidencias.map((ev: any) => (
                  <div key={ev.id} className="px-4 lg:px-5 py-3 flex items-center gap-3">
                    <span className="text-xl shrink-0">{typeIcon[ev.type] ?? '📎'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {ev.profiles?.full_name ?? '—'}
                      </p>
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

        <div className="bg-white rounded-xl shadow-sm p-4 lg:p-5">
          <h2 className="text-base font-semibold text-blue-900 mb-4">Resumen del panel</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Estado general</p>
              <p className="text-sm font-semibold text-gray-800">
                {isAdminOrDocente
                  ? 'Panel listo para gestión de cursos, proyectos y revisión.'
                  : 'Panel listo para seguir tus proyectos, invitaciones y evidencias.'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Recomendación</p>
              <p className="text-sm font-semibold text-gray-800">
                {isAdminOrDocente
                  ? 'Usa “Ver detalles” para administrar atrasos sin saturar el dashboard.'
                  : 'Revisa tus invitaciones pendientes y completa evidencias recientes.'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Siguiente paso</p>
              <p className="text-sm font-semibold text-gray-800">
                {isAdminOrDocente
                  ? 'Organiza proyectos compartidos y revisa portafolios.'
                  : 'Continúa tu trabajo en proyectos y mantén tu portafolio actualizado.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
