import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ReportesCharts from './ReportesCharts'
import ExportPDF from '@/components/ExportPDF'

function countBy<T extends Record<string, unknown>>(items: T[] = [], field: keyof T) {
  const result: Record<string, number> = {}
  items.forEach((item) => {
    const raw = item[field]
    const key = typeof raw === 'string' && raw.trim() ? raw : 'Sin definir'
    result[key] = (result[key] ?? 0) + 1
  })
  return result
}

export default async function ReportesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (perfil?.role === 'estudiante') {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <div className="mb-3 text-4xl">🚫</div>
            <h2 className="text-lg font-semibold text-red-700">Acceso restringido</h2>
            <p className="mt-2 text-sm text-red-500">Los reportes están disponibles para docentes, coordinación y administración.</p>
          </div>
        </main>
      </div>
    )
  }

  const isAdmin = perfil?.role === 'admin'

  const [
    cursosRes,
    proyectosRes,
    evidenciasRes,
    usuariosRes,
    mensajesCountRes,
    mensajesRes,
    flaggedRes,
    portfoliosRes,
    invitationsRes,
    auditRes,
    accessLogsRes,
    reportDownloadsRes,
  ] = await Promise.all([
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('id, title, status, type, created_at, updated_at, owner_id, course_id, courses(name), profiles!projects_owner_id_fkey(full_name, email, curso)'),
    supabase.from('evidences').select('id, title, type, evidencia_tipo, created_at, project_id, created_by, projects(title), profiles(full_name, email, curso)'),
    supabase.from('profiles').select('id, role, full_name, email, curso, created_at, last_seen, blocked'),
    isAdmin ? supabase.from('messages').select('*', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
    isAdmin
      ? supabase
          .from('messages')
          .select('id, content, read, created_at, sender_id, receiver_id, sender:profiles!messages_sender_id_fkey(full_name, email, curso, role), receiver:profiles!messages_receiver_id_fkey(full_name, email, curso, role)')
          .order('created_at', { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase
          .from('flagged_messages')
          .select('id, content, category, matched_words, reviewed, created_at, sender_id, receiver_id, sender:profiles!flagged_messages_sender_id_fkey(full_name, email, curso, role), receiver:profiles!flagged_messages_receiver_id_fkey(full_name, email, curso, role)')
          .order('created_at', { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('portfolios').select('id, user_id, year, created_at, updated_at, profiles(full_name, email, curso)').order('updated_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('project_invitations').select('id, status, created_at, accepted_at, project_id, curso_id').order('created_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase
          .from('user_access_logs')
          .select('id, user_id, event_type, pathname, user_agent, created_at, metadata, profiles(full_name, email, curso, role)')
          .order('created_at', { ascending: false })
          .limit(600)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase
          .from('report_downloads')
          .select('id, user_id, report_type, filters, summary, created_at, profiles(full_name, email, curso, role)')
          .order('created_at', { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
  ])

  const usuarios = usuariosRes.data ?? []
  const proyectos = proyectosRes.data ?? []
  const evidencias = evidenciasRes.data ?? []
  const mensajes = mensajesRes.data ?? []
  const flagged = flaggedRes.data ?? []
  const portfolios = portfoliosRes.data ?? []
  const invitations = invitationsRes.data ?? []
  const audit = auditRes.data ?? []
  const accessLogs = accessLogsRes.data ?? []
  const reportDownloads = reportDownloadsRes.data ?? []

  const estados = countBy(proyectos, 'status')
  const rolCount = countBy(usuarios, 'role')
  const evidenciasTipo = countBy(evidencias, 'type')
  const evidenciasEtapa = countBy(evidencias, 'evidencia_tipo')
  const flaggedCategory = countBy(flagged, 'category')
  const invitationsStatus = countBy(invitations, 'status')
  const accessEvents = countBy(accessLogs, 'event_type')
  const accessPages = countBy(accessLogs, 'pathname')

  const usuariosBloqueados = usuarios.filter((u: any) => u.blocked).length
  const incidenciasPendientes = flagged.filter((f: any) => !f.reviewed).length
  const mensajesNoLeidos = mensajes.filter((m: any) => !m.read).length
  const proyectosActivos = (estados['En progreso'] ?? 0) + (estados['En revisión'] ?? 0)
  const proyectosRevisados = estados['Revisado'] ?? 0
  const ingresosRegistrados = accessLogs.filter((log: any) => log.event_type === 'login').length
  const visitasEduAI = accessLogs.filter((log: any) => log.event_type === 'eduai_open' || log.pathname === '/eduai').length

  const stats = [
    { label: 'Usuarios', value: usuarios.length, icon: '👥', color: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
    { label: 'Proyectos', value: proyectos.length, icon: '🗂️', color: 'bg-blue-50 text-blue-700 ring-blue-100' },
    { label: 'Revisados', value: proyectosRevisados, icon: '✅', color: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
    { label: 'Evidencias', value: evidencias.length, icon: '📎', color: 'bg-sky-50 text-sky-700 ring-sky-100' },
    { label: 'Cursos', value: cursosRes.count ?? 0, icon: '📚', color: 'bg-violet-50 text-violet-700 ring-violet-100' },
    { label: 'Mensajes', value: mensajesCountRes.count ?? 0, icon: '💬', color: 'bg-violet-50 text-violet-700 ring-violet-100', admin: true },
    { label: 'Incidencias', value: flagged.length, icon: '🚨', color: 'bg-red-50 text-red-700 ring-red-100', admin: true },
    { label: 'Portafolios', value: portfolios.length, icon: '📋', color: 'bg-amber-50 text-amber-700 ring-amber-100', admin: true },
    { label: 'Bloqueados', value: usuariosBloqueados, icon: '🔒', color: 'bg-rose-50 text-rose-700 ring-rose-100', admin: true },
    { label: 'PDF', value: reportDownloads.length, icon: '📄', color: 'bg-lime-50 text-lime-700 ring-lime-100', admin: true },
  ].filter(s => isAdmin || !s.admin)

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
              {isAdmin ? 'Reporte administrativo completo' : 'Reporte general'}
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-950">Reportes y análisis de datos</h1>
            <p className="mt-1 text-sm text-slate-500">
              Estadísticas sincronizadas con proyectos, evidencias, estados, revisados, incidencias y exportación PDF.
            </p>
          </div>
          <ExportPDF data={{
            isAdmin,
            cursos: cursosRes.count ?? 0,
            proyectos: proyectos.length,
            proyectosRevisados,
            evidencias: evidencias.length,
            usuarios: usuarios.length,
            mensajes: mensajesCountRes.count ?? 0,
            incidencias: flagged.length,
            incidenciasPendientes,
            usuariosBloqueados,
            portafolios: portfolios.length,
            proyectosActivos,
            mensajesNoLeidos,
            ingresosRegistrados,
            visitasEduAI,
            descargasPDF: reportDownloads.length,
            porEstado: estados,
            porRol: rolCount,
            evidenciasTipo,
            evidenciasEtapa,
            flaggedCategory,
            invitationsStatus,
            accessEvents,
            accessPages,
            recientes: {
              usuarios: usuarios.slice(0, 20),
              proyectos: proyectos.slice(0, 20),
              evidencias: evidencias.slice(0, 20),
              mensajes: mensajes.slice(0, 30),
              flagged: flagged.slice(0, 30),
              portfolios: portfolios.slice(0, 20),
              audit: audit.slice(0, 30),
              accessLogs: accessLogs.slice(0, 40),
              reportDownloads: reportDownloads.slice(0, 30),
            },
          }} />
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {stats.map(s => (
            <div key={s.label} className="flex min-w-[160px] flex-1 items-center gap-3 rounded-full bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
              <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ring-1 ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-xl font-black text-slate-900 leading-none">{s.value}</div>
                <div className="mt-1 text-xs font-medium text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-red-600">Riesgo actual</p><p className="mt-2 text-2xl font-bold text-red-700">{incidenciasPendientes}</p><p className="text-xs text-red-600">incidencias pendientes de revisión</p></div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Actividad</p><p className="mt-2 text-2xl font-bold text-blue-700">{mensajesNoLeidos}</p><p className="text-xs text-blue-600">mensajes no leídos detectados</p></div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-600">En proceso</p><p className="mt-2 text-2xl font-bold text-amber-700">{proyectosActivos}</p><p className="text-xs text-amber-600">activos o en revisión</p></div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Revisados</p><p className="mt-2 text-2xl font-bold text-emerald-700">{proyectosRevisados}</p><p className="text-xs text-emerald-600">cerrados como revisados</p></div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">Accesos</p><p className="mt-2 text-2xl font-bold text-cyan-700">{accessLogs.length}</p><p className="text-xs text-cyan-600">eventos registrados</p></div>
            <div className="rounded-2xl border border-lime-100 bg-lime-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-lime-600">Exportaciones</p><p className="mt-2 text-2xl font-bold text-lime-700">{reportDownloads.length}</p><p className="text-xs text-lime-600">descargas PDF registradas</p></div>
          </div>
        )}

        <ReportesCharts
          isAdmin={isAdmin}
          usuarios={usuarios}
          proyectos={proyectos}
          evidencias={evidencias}
          mensajes={mensajes}
          flagged={flagged}
          portfolios={portfolios}
          audit={audit}
          accessLogs={accessLogs}
          reportDownloads={reportDownloads}
        />
      </main>
    </div>
  )
}
