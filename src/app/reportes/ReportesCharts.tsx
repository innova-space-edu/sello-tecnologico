'use client'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar
} from 'recharts'

const COLORS = ['#2563eb','#0ea5e9','#6366f1','#10b981','#f59e0b','#ef4444']

function calcStats(nums: number[]) {
  if (!nums.length) return { promedio: 0, minimo: 0, maximo: 0 }
  const promedio = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
  return { promedio, minimo: Math.min(...nums), maximo: Math.max(...nums) }
}

function groupByMonth(items: any[], dateField = 'created_at') {
  const months: Record<string, number> = {}
  items.forEach(item => {
    const d = new Date(item[dateField])
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months[key] = (months[key] ?? 0) + 1
  })
  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, cantidad]) => ({ mes, cantidad }))
}

export default function ReportesCharts({ usuarios, proyectos, evidencias }: {
  usuarios: any[], proyectos: any[], evidencias: any[]
}) {
  // Usuarios por rol
  const rolCount: Record<string, number> = {}
  usuarios.forEach(u => { rolCount[u.role] = (rolCount[u.role] ?? 0) + 1 })
  const usuariosPieData = Object.entries(rolCount).map(([name, value]) => ({ name, value }))

  // Proyectos por estado
  const estadoCount: Record<string, number> = {}
  proyectos.forEach(p => { estadoCount[p.status] = (estadoCount[p.status] ?? 0) + 1 })
  const proyectosPieData = Object.entries(estadoCount).map(([name, value]) => ({ name, value }))

  // Evidencias por tipo
  const tipoCount: Record<string, number> = {}
  evidencias.forEach(e => { tipoCount[e.type] = (tipoCount[e.type] ?? 0) + 1 })
  const evidenciasPieData = Object.entries(tipoCount).map(([name, value]) => ({ name, value }))

  // Tendencias mensuales
  const usuariosMes = groupByMonth(usuarios)
  const proyectosMes = groupByMonth(proyectos)
  const evidenciasMes = groupByMonth(evidencias)

  // Stats
  const statsProyectos = calcStats(Object.values(estadoCount))
  const statsEvidencias = calcStats(Object.values(tipoCount))

  const totalUsuarios = usuarios.length
  const pctDocentes = totalUsuarios ? Math.round(((rolCount['docente'] ?? 0) / totalUsuarios) * 100) : 0
  const pctEstudiantes = totalUsuarios ? Math.round(((rolCount['estudiante'] ?? 0) / totalUsuarios) * 100) : 0

  return (
    <div className="space-y-6">

      {/* Fila 1: Gráficas circulares */}
      <div className="grid grid-cols-3 gap-5">

        {/* Usuarios por rol */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-blue-900 mb-1">Usuarios por rol</h3>
          <div className="flex gap-4 text-xs text-gray-500 mb-3">
            <span>👨‍🏫 Docentes: <b className="text-green-600">{pctDocentes}%</b></span>
            <span>🎓 Estudiantes: <b className="text-blue-600">{pctEstudiantes}%</b></span>
          </div>
          {usuariosPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={usuariosPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({name, percent}) => `${name} ${((percent ?? 0)*100).toFixed(0)}%`}>
                  {usuariosPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>}
        </div>

        {/* Proyectos por estado */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-blue-900 mb-1">Proyectos por estado</h3>
          <div className="flex gap-3 text-xs text-gray-500 mb-3">
            <span>Prom: <b>{statsProyectos.promedio}</b></span>
            <span>Mín: <b>{statsProyectos.minimo}</b></span>
            <span>Máx: <b>{statsProyectos.maximo}</b></span>
          </div>
          {proyectosPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={proyectosPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({name, percent}) => `${((percent ?? 0)*100).toFixed(0)}%`}>
                  {proyectosPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>}
        </div>

        {/* Evidencias por tipo */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-blue-900 mb-1">Evidencias por tipo</h3>
          <div className="flex gap-3 text-xs text-gray-500 mb-3">
            <span>Prom: <b>{statsEvidencias.promedio}</b></span>
            <span>Mín: <b>{statsEvidencias.minimo}</b></span>
            <span>Máx: <b>{statsEvidencias.maximo}</b></span>
          </div>
          {evidenciasPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={evidenciasPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({name, percent}) => `${((percent ?? 0)*100).toFixed(0)}%`}>
                  {evidenciasPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>}
        </div>
      </div>

      {/* Fila 2: Tendencias mensuales */}
      <div className="grid grid-cols-2 gap-5">

        {/* Línea: usuarios y proyectos por mes */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-blue-900 mb-4">Tendencia mensual — Usuarios y Proyectos</h3>
          {usuariosMes.length > 0 || proyectosMes.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" allowDuplicatedCategory={false} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line data={usuariosMes} type="monotone" dataKey="cantidad" stroke="#2563eb" name="Usuarios" strokeWidth={2} dot={{ r: 4 }} />
                <Line data={proyectosMes} type="monotone" dataKey="cantidad" stroke="#10b981" name="Proyectos" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>}
        </div>

        {/* Barras: evidencias por mes */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-blue-900 mb-4">Evidencias registradas por mes</h3>
          {evidenciasMes.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={evidenciasMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cantidad" fill="#6366f1" name="Evidencias" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>}
        </div>
      </div>

      {/* Fila 3: Resumen ponderaciones */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-blue-900 mb-4">Resumen de ponderaciones</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total usuarios', value: totalUsuarios, icon: '👥', color: 'text-blue-600' },
            { label: '% Docentes', value: `${pctDocentes}%`, icon: '👨‍🏫', color: 'text-green-600' },
            { label: '% Estudiantes', value: `${pctEstudiantes}%`, icon: '🎓', color: 'text-sky-600' },
            { label: 'Proyectos activos', value: estadoCount['En progreso'] ?? 0, icon: '🔄', color: 'text-indigo-600' },
          ].map(item => (
            <div key={item.label} className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-gray-500 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
