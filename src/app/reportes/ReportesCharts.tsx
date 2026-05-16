'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, AreaChart, Area,
} from 'recharts'

const COLORS = ['#2563eb', '#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']
const LABELS: Record<string, string> = {
  admin: 'Administradores', docente: 'Docentes', estudiante: 'Estudiantes', coordinador: 'Coordinación', utp: 'UTP',
  documento: 'Documentos', foto: 'Fotos', video: 'Videos', presentacion: 'Presentaciones', presentación: 'Presentaciones', codigo: 'Código',
  sexual: 'Contenido sexual', bullying: 'Bullying', discriminacion: 'Discriminación',
  'En progreso': 'En progreso', Borrador: 'Borrador', 'En revisión': 'En revisión', Aprobado: 'Aprobado',
  page_view: 'Vista de página', login: 'Ingreso', logout: 'Salida', register: 'Registro', eduai_open: 'EduAI', report_view: 'Reportes',
}

function labelFor(value: string) {
  return LABELS[value] ?? value
}

function countBy(items: any[], field: string) {
  const result: Record<string, number> = {}
  items.forEach(item => {
    const raw = item?.[field]
    const key = typeof raw === 'string' && raw.trim() ? raw : 'Sin definir'
    result[key] = (result[key] ?? 0) + 1
  })
  return Object.entries(result).map(([name, value]) => ({ name, label: labelFor(name), value }))
}

function sortDesc(data: { name: string, label: string, value: number }[]) {
  return [...data].sort((a, b) => b.value - a.value)
}

function monthKey(date: string) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return 'Sin fecha'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function trendByMonth(groups: Record<string, any[]>) {
  const months = new Set<string>()
  Object.values(groups).forEach(items => items.forEach(item => months.add(monthKey(item.created_at))))
  return Array.from(months).sort().map(mes => {
    const row: Record<string, number | string> = { mes }
    Object.entries(groups).forEach(([key, items]) => {
      row[key] = items.filter(item => monthKey(item.created_at) === mes).length
    })
    return row
  })
}

function last30Days(items: any[]) {
  const limit = Date.now() - 30 * 24 * 60 * 60 * 1000
  return items.filter(item => new Date(item.created_at).getTime() >= limit).length
}

function ChartCard({ title, subtitle, children }: { title: string, subtitle?: string, children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyState() {
  return <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Sin datos suficientes</div>
}

function Donut({ data }: { data: { name: string, label: string, value: number }[] }) {
  if (!data.length) return <EmptyState />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="48%" innerRadius={52} outerRadius={82} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(value, name) => [value ?? 0, String(name)]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#334155' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function DataTable({ title, rows, columns }: { title: string, rows: any[], columns: { key: string, label: string, render?: (row: any) => React.ReactNode }[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map(col => <th key={col.key} className="px-4 py-3">{col.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? rows.map((row, index) => (
              <tr key={row.id ?? index} className="hover:bg-blue-50/40">
                {columns.map(col => <td key={col.key} className="px-4 py-3 text-slate-600">{col.render ? col.render(row) : row[col.key] ?? '—'}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">Sin registros</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReportesCharts({ usuarios, proyectos, evidencias, mensajes, flagged, portfolios, audit, accessLogs, reportDownloads, isAdmin }: {
  usuarios: any[]
  proyectos: any[]
  evidencias: any[]
  mensajes: any[]
  flagged: any[]
  portfolios: any[]
  audit: any[]
  accessLogs: any[]
  reportDownloads: any[]
  isAdmin: boolean
}) {
  const usuariosPieData = countBy(usuarios, 'role')
  const proyectosPieData = countBy(proyectos, 'status')
  const evidenciasPieData = countBy(evidencias, 'type')
  const incidenciasData = countBy(flagged, 'category')
  const evidenciasEtapaData = countBy(evidencias, 'evidencia_tipo')
  const accessEventsData = sortDesc(countBy(accessLogs, 'event_type'))
  const accessPagesData = sortDesc(countBy(accessLogs, 'pathname')).slice(0, 10)
  const reportDownloadsData = countBy(reportDownloads, 'report_type')

  const tendencia = trendByMonth({ Usuarios: usuarios, Proyectos: proyectos, Evidencias: evidencias, Mensajes: mensajes, Incidencias: flagged, Accesos: accessLogs, PDF: reportDownloads })
  const proyectosCurso = countBy(proyectos.map(p => ({ curso: p?.courses?.name ?? 'Sin curso' })), 'curso')
  const usuariosCurso = countBy(usuarios.map(u => ({ curso: u?.curso ?? 'Sin curso' })), 'curso')

  const resumen = [
    { label: 'Usuarios nuevos últimos 30 días', value: last30Days(usuarios), icon: '🆕' },
    { label: 'Proyectos nuevos últimos 30 días', value: last30Days(proyectos), icon: '🗂️' },
    { label: 'Evidencias nuevas últimos 30 días', value: last30Days(evidencias), icon: '📎' },
    { label: 'Incidencias nuevas últimos 30 días', value: last30Days(flagged), icon: '🚨', adminOnly: true },
    { label: 'Accesos últimos 30 días', value: last30Days(accessLogs), icon: '🛂', adminOnly: true },
    { label: 'PDF descargados últimos 30 días', value: last30Days(reportDownloads), icon: '📄', adminOnly: true },
  ].filter(item => isAdmin || !item.adminOnly)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <ChartCard title="Usuarios por rol" subtitle="Distribución general de cuentas activas en la plataforma.">
          <Donut data={usuariosPieData} />
        </ChartCard>
        <ChartCard title="Proyectos por estado" subtitle="Permite detectar avance, revisión y borradores pendientes.">
          <Donut data={proyectosPieData} />
        </ChartCard>
        <ChartCard title={isAdmin ? 'Incidencias por categoría' : 'Evidencias por tipo'} subtitle={isAdmin ? 'Resumen de mensajes peligrosos o alertas de moderación.' : 'Tipos de evidencias registradas.'}>
          <Donut data={isAdmin ? incidenciasData : evidenciasPieData} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title="Tendencia mensual" subtitle="Evolución comparativa de usuarios, proyectos, evidencias, seguridad y accesos.">
          {tendencia.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={tendencia} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Usuarios" stroke="#2563eb" strokeWidth={2.4} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Proyectos" stroke="#10b981" strokeWidth={2.4} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Evidencias" stroke="#6366f1" strokeWidth={2.4} dot={{ r: 3 }} />
                {isAdmin && <Line type="monotone" dataKey="Incidencias" stroke="#ef4444" strokeWidth={2.4} dot={{ r: 3 }} />}
                {isAdmin && <Line type="monotone" dataKey="Accesos" stroke="#0891b2" strokeWidth={2.4} dot={{ r: 3 }} />}
                {isAdmin && <Line type="monotone" dataKey="PDF" stroke="#65a30d" strokeWidth={2.4} dot={{ r: 3 }} />}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Evidencias por etapa" subtitle="Comparación entre evidencias iniciales, intermedias y finales.">
          {evidenciasEtapaData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={evidenciasEtapaData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="value" name="Evidencias" fill="#2563eb" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title="Proyectos por curso" subtitle="Ayuda a revisar qué cursos tienen más actividad de proyectos.">
          {proyectosCurso.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={proyectosCurso.slice(0, 12)} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-18} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="value" name="Proyectos" fill="#0ea5e9" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Usuarios por curso" subtitle="Distribución de estudiantes y usuarios asociados a curso.">
          {usuariosCurso.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={usuariosCurso.slice(0, 12)} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-18} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" name="Usuarios" stroke="#6366f1" fill="#c7d2fe" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <ChartCard title="Eventos de acceso" subtitle="Login, navegación, apertura de EduAI y vistas de reportes.">
            {accessEventsData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={accessEventsData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" height={52} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Eventos" fill="#0891b2" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </ChartCard>

          <ChartCard title="Páginas más visitadas" subtitle="Ayuda a detectar secciones clave y rutas con baja utilización.">
            {accessPagesData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={accessPagesData} layout="vertical" margin={{ top: 10, right: 22, left: 32, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Visitas" fill="#2563eb" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </ChartCard>

          <ChartCard title="Descargas de reportes PDF" subtitle="Control de exportaciones realizadas por administración.">
            <Donut data={reportDownloadsData} />
          </ChartCard>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {resumen.map(item => (
          <div key={item.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-2 text-2xl">{item.icon}</div>
            <div className="text-3xl font-bold text-slate-900">{item.value}</div>
            <div className="mt-1 text-sm text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="space-y-6">
          <DataTable
            title="Detalle de incidencias y mensajes peligrosos"
            rows={flagged.slice(0, 80)}
            columns={[
              { key: 'category', label: 'Categoría', render: row => <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{labelFor(row.category ?? 'Sin categoría')}</span> },
              { key: 'content', label: 'Mensaje', render: row => <span className="line-clamp-2 max-w-md">{row.content}</span> },
              { key: 'sender', label: 'Emisor', render: row => row.sender?.full_name ?? row.sender?.email ?? '—' },
              { key: 'receiver', label: 'Receptor', render: row => row.receiver?.full_name ?? row.receiver?.email ?? '—' },
              { key: 'reviewed', label: 'Estado', render: row => row.reviewed ? 'Revisado' : 'Pendiente' },
              { key: 'created_at', label: 'Fecha', render: row => new Date(row.created_at).toLocaleString('es-CL') },
            ]}
          />

          <DataTable
            title="Mensajes recientes monitoreados"
            rows={mensajes.slice(0, 80)}
            columns={[
              { key: 'content', label: 'Contenido', render: row => <span className="line-clamp-2 max-w-md">{row.content}</span> },
              { key: 'sender', label: 'De', render: row => row.sender?.full_name ?? row.sender?.email ?? '—' },
              { key: 'receiver', label: 'Para', render: row => row.receiver?.full_name ?? row.receiver?.email ?? '—' },
              { key: 'read', label: 'Lectura', render: row => row.read ? 'Leído' : 'No leído' },
              { key: 'created_at', label: 'Fecha', render: row => new Date(row.created_at).toLocaleString('es-CL') },
            ]}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DataTable
              title="Portafolios actualizados recientemente"
              rows={portfolios.slice(0, 50)}
              columns={[
                { key: 'profiles', label: 'Usuario', render: row => row.profiles?.full_name ?? row.profiles?.email ?? '—' },
                { key: 'curso', label: 'Curso', render: row => row.profiles?.curso ?? '—' },
                { key: 'year', label: 'Año' },
                { key: 'updated_at', label: 'Actualizado', render: row => row.updated_at ? new Date(row.updated_at).toLocaleString('es-CL') : '—' },
              ]}
            />
            <DataTable
              title="Actividad del sistema"
              rows={audit.slice(0, 50)}
              columns={[
                { key: 'action', label: 'Acción', render: row => <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{row.action ?? '—'}</span> },
                { key: 'entity', label: 'Entidad' },
                { key: 'entity_name', label: 'Detalle' },
                { key: 'user_email', label: 'Usuario' },
                { key: 'created_at', label: 'Fecha', render: row => new Date(row.created_at).toLocaleString('es-CL') },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DataTable
              title="Ingreso y navegación de usuarios"
              rows={accessLogs.slice(0, 80)}
              columns={[
                { key: 'event_type', label: 'Evento', render: row => <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">{labelFor(row.event_type ?? 'page_view')}</span> },
                { key: 'profiles', label: 'Usuario', render: row => row.profiles?.full_name ?? row.profiles?.email ?? '—' },
                { key: 'role', label: 'Rol', render: row => row.profiles?.role ?? '—' },
                { key: 'pathname', label: 'Página' },
                { key: 'created_at', label: 'Fecha', render: row => new Date(row.created_at).toLocaleString('es-CL') },
              ]}
            />
            <DataTable
              title="Descargas de reportes PDF"
              rows={reportDownloads.slice(0, 60)}
              columns={[
                { key: 'report_type', label: 'Reporte', render: row => <span className="rounded-full bg-lime-50 px-2.5 py-1 text-xs font-semibold text-lime-700">{row.report_type ?? '—'}</span> },
                { key: 'profiles', label: 'Usuario', render: row => row.profiles?.full_name ?? row.profiles?.email ?? '—' },
                { key: 'role', label: 'Rol', render: row => row.profiles?.role ?? '—' },
                { key: 'summary', label: 'Resumen', render: row => row.summary?.incidencias !== undefined ? `${row.summary.incidencias} incidencias` : '—' },
                { key: 'created_at', label: 'Fecha', render: row => new Date(row.created_at).toLocaleString('es-CL') },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  )
}
