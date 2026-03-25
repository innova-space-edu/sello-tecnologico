import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import AdminActions from './AdminActions'
import AdminAlertas from './AdminAlertas'
import { redirect } from 'next/navigation'

// ─── Componente cliente para auto-refresh cada 5s (Server Components no pueden usar timers) ───
import AdminAutoRefresh from './AdminAutoRefresh'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()

  if (perfil?.role !== 'admin') {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">🚫</div>
            <h2 className="text-lg font-semibold text-red-700">Acceso restringido</h2>
            <p className="text-red-500 mt-2">Solo los administradores pueden ver esta página.</p>
          </div>
        </main>
      </div>
    )
  }

  const { data: usuarios } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  const { data: cursos } = await supabase.from('courses').select('*').order('name')
  const { data: proyectos } = await supabase.from('projects').select('*, courses(name), profiles!projects_owner_id_fkey(full_name)').order('created_at', { ascending: false })
  const { data: evidencias } = await supabase.from('evidences').select('*').order('created_at', { ascending: false })
  const { data: logs } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(20)
  const { count: mensajesCount } = await supabase.from('messages').select('*', { count: 'exact', head: true })

  const docentes = usuarios?.filter(u => u.role === 'docente') ?? []
  const estudiantes = usuarios?.filter(u => u.role === 'estudiante') ?? []

  const roleColor: Record<string, string> = {
    'admin': 'bg-purple-100 text-purple-700',
    'coordinador': 'bg-blue-100 text-blue-700',
    'docente': 'bg-green-100 text-green-700',
    'estudiante': 'bg-sky-100 text-sky-700',
  }

  const actionColor: Record<string, string> = {
    'crear': 'bg-green-100 text-green-700',
    'eliminar': 'bg-red-100 text-red-700',
    'actualizar': 'bg-blue-100 text-blue-700',
    'importar': 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* Auto-refresh cada 5 segundos usando router.refresh() del lado cliente */}
      <AdminAutoRefresh intervalo={5000} />

      {/* ✅ lg:ml-64 + pt-16 para móvil */}
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8 min-w-0">

        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-xl lg:text-2xl font-bold text-blue-900">Panel de Administrador</h1>
          <p className="text-gray-500 mt-1 text-sm">Vista omnisciente del sistema — solo administradores</p>
        </div>

        {/* 🚨 Alertas de bloqueo — solo visibles aquí para el admin */}
        <div className="mb-6">
          <AdminAlertas />
        </div>

        {/* ✅ Stats: 2 cols móvil → 3 tablet → 6 desktop, con wrap garantizado */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 lg:mb-8">
          {[
            { label: 'Usuarios',    value: usuarios?.length ?? 0,  icon: '👥', color: 'bg-purple-100 text-purple-700' },
            { label: 'Docentes',    value: docentes.length,         icon: '👨‍🏫', color: 'bg-green-100 text-green-700' },
            { label: 'Estudiantes', value: estudiantes.length,      icon: '🎓', color: 'bg-sky-100 text-sky-700' },
            { label: 'Proyectos',   value: proyectos?.length ?? 0,  icon: '🗂️', color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Evidencias',  value: evidencias?.length ?? 0, icon: '📎', color: 'bg-blue-100 text-blue-700' },
            { label: 'Mensajes',    value: mensajesCount ?? 0,      icon: '💬', color: 'bg-pink-100 text-pink-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm p-3 lg:p-4 flex items-center gap-2 lg:gap-3 min-w-0">
              <div className={`text-lg lg:text-xl p-2 lg:p-2.5 rounded-lg shrink-0 ${s.color}`}>{s.icon}</div>
              <div className="min-w-0">
                <div className="text-lg lg:text-xl font-bold text-gray-800 leading-tight">{s.value}</div>
                <div className="text-gray-500 text-xs truncate">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ✅ Grid de tablas: 1 col móvil, 2 desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">

          {/* Todos los usuarios */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 lg:px-6 py-4 border-b border-gray-100 flex flex-wrap gap-2 justify-between items-center">
              <h2 className="font-semibold text-blue-900 text-sm lg:text-base">
                Todos los usuarios ({usuarios?.length ?? 0})
              </h2>
              <div className="flex gap-3">
                <Link href="/usuarios/importar" className="text-xs text-blue-600 hover:underline">⬆️ Importar</Link>
                <Link href="/admin/mensajes" className="text-xs text-blue-600 hover:underline">💬 Mensajes</Link>
              </div>
            </div>
            {/* ✅ overflow-x-auto para tabla en pantallas pequeñas */}
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm min-w-[420px]">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Nombre</th>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Correo</th>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Rol</th>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuarios?.map(u => (
                    <tr key={u.id} className="hover:bg-blue-50">
                      <td className="px-4 py-2">
                        <Link href={`/usuarios/${u.id}`} className="font-medium text-blue-700 hover:underline text-xs whitespace-nowrap">
                          {u.full_name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs max-w-[120px] truncate">{u.email}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${roleColor[u.role] ?? 'bg-gray-100'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <AdminActions userId={u.id} userEmail={u.email} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial reciente */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 lg:px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-blue-900 text-sm lg:text-base">Actividad reciente</h2>
              <Link href="/historial" className="text-xs text-blue-600 hover:underline">Ver todo →</Link>
            </div>
            <div className="overflow-y-auto max-h-80">
              {logs && logs.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${actionColor[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-800 truncate">{log.entity_name ?? log.entity}</p>
                        <p className="text-xs text-gray-400 truncate">{log.user_email}</p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(log.created_at).toLocaleDateString('es-CL')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">Sin actividad aún</div>
              )}
            </div>
          </div>
        </div>

        {/* Monitoreo de mensajes */}
        <div className="bg-white rounded-xl shadow-sm p-4 lg:p-5 mb-4 lg:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl">💬</div>
            <div>
              <h2 className="font-semibold text-blue-900 text-sm lg:text-base">Monitoreo de Mensajes</h2>
              <p className="text-gray-500 text-sm mt-0.5">
                {mensajesCount ?? 0} mensajes totales — solo lectura
              </p>
            </div>
          </div>
          <Link href="/admin/mensajes"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors w-full sm:w-auto text-center">
            Ver conversaciones →
          </Link>
        </div>

        {/* Moderación */}
        <div className="bg-white rounded-xl shadow-sm p-4 lg:p-5 mb-4 lg:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🚨</div>
            <div>
              <h2 className="font-semibold text-red-700 text-sm lg:text-base">Moderación de Contenido</h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Detección automática de palabras inapropiadas, bullying y contenido sexual
              </p>
            </div>
          </div>
          <Link href="/admin/moderacion"
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors w-full sm:w-auto text-center">
            Ver alertas →
          </Link>
        </div>

        {/* Todos los proyectos */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-4 lg:px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-blue-900 text-sm lg:text-base">
              Todos los proyectos ({proyectos?.length ?? 0})
            </h2>
            <div className="flex items-center gap-3">
              <Link href="/admin/proyectos" className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                🗂️ Gestionar todos
              </Link>
              <Link href="/proyectos/nuevo" className="text-xs text-blue-600 hover:underline">+ Nuevo</Link>
            </div>
          </div>
          {/* ✅ overflow-x-auto para tabla */}
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Proyecto</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Alumno</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Curso</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Estado</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proyectos?.map(p => (
                  <tr key={p.id} className="hover:bg-blue-50">
                    <td className="px-4 py-2">
                      <Link href={`/proyectos/${p.id}`} className="font-medium text-blue-700 hover:underline text-xs whitespace-nowrap">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">{(p as any).profiles?.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">{p.courses?.name ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{p.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/proyectos/${p.id}/editar`}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap">
                        ✏️ Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
