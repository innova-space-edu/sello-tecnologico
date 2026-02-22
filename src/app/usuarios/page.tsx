import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const roleColor: Record<string, string> = {
  'admin': 'bg-purple-100 text-purple-700',
  'coordinador': 'bg-blue-100 text-blue-700',
  'docente': 'bg-green-100 text-green-700',
  'estudiante': 'bg-sky-100 text-sky-700',
}

const roleIcon: Record<string, string> = {
  'admin': '👑',
  'coordinador': '🎯',
  'docente': '👨‍🏫',
  'estudiante': '🎓',
}

export default async function UsuariosPage() {
  const supabase = await createServerSupabaseClient()
  const { data: usuarios } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const docentes = usuarios?.filter(u => u.role === 'docente') ?? []
  const estudiantes = usuarios?.filter(u => u.role === 'estudiante') ?? []
  const admins = usuarios?.filter(u => u.role === 'admin' || u.role === 'coordinador') ?? []

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Usuarios</h1>
          <p className="text-gray-500 mt-1">Docentes y estudiantes registrados en el sistema</p>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          {[
            { label: 'Docentes', count: docentes.length, icon: '👨‍🏫', color: 'bg-green-100 text-green-700' },
            { label: 'Estudiantes', count: estudiantes.length, icon: '🎓', color: 'bg-sky-100 text-sky-700' },
            { label: 'Administradores', count: admins.length, icon: '👑', color: 'bg-purple-100 text-purple-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
              <div className={`text-2xl p-3 rounded-lg ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{s.count}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabla de usuarios */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-blue-900">Todos los usuarios ({usuarios?.length ?? 0})</h2>
          </div>
          {usuarios && usuarios.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Nombre</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">RUT</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Correo</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Curso</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Rol</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {roleIcon[u.role]} {u.full_name ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{u.rut ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-500">{u.email}</td>
                    <td className="px-6 py-4 text-gray-500">{u.curso ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColor[u.role] ?? 'bg-gray-100'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString('es-CL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">👥</div>
              No hay usuarios registrados aún
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
