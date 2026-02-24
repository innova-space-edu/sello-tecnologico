'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const roleColor: Record<string, string> = {
  'admin': 'bg-purple-100 text-purple-700',
  'coordinador': 'bg-blue-100 text-blue-700',
  'docente': 'bg-green-100 text-green-700',
  'estudiante': 'bg-sky-100 text-sky-700',
}

const roleIcon: Record<string, string> = {
  'admin': '👑', 'coordinador': '🎯', 'docente': '👨‍🏫', 'estudiante': '🎓',
}

export default function UsuariosPage() {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [rolActual, setRolActual] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const fetchUsuarios = async () => {
    const { data } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: false })
    setUsuarios(data ?? [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      setRolActual(perfil?.role ?? '')
      fetchUsuarios()
    }
    init()
  }, [])

  const toggleBloqueo = async (u: any) => {
    const accion = u.blocked ? 'desbloquear' : 'bloquear'
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${u.full_name ?? u.email}?`)) return

    setLoadingId(u.id)

    if (u.blocked) {
      await supabase.from('profiles')
        .update({ blocked: false, blocked_reason: null, blocked_at: null })
        .eq('id', u.id)
    } else {
      await supabase.from('profiles')
        .update({
          blocked: true,
          blocked_reason: 'Bloqueado manualmente por el administrador.',
          blocked_at: new Date().toISOString()
        })
        .eq('id', u.id)
    }

    await fetchUsuarios()
    setLoadingId(null)
  }

  const esAdmin = rolActual === 'admin'
  const docentes = usuarios.filter(u => u.role === 'docente')
  const estudiantes = usuarios.filter(u => u.role === 'estudiante')
  const admins = usuarios.filter(u => u.role === 'admin' || u.role === 'coordinador')
  const bloqueados = usuarios.filter(u => u.blocked && u.role !== 'admin')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Usuarios</h1>
          <p className="text-gray-500 mt-1">Docentes y estudiantes registrados en el sistema</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6 lg:mb-8">
          {[
            { label: 'Docentes', count: docentes.length, icon: '👨‍🏫', color: 'bg-green-100 text-green-700' },
            { label: 'Estudiantes', count: estudiantes.length, icon: '🎓', color: 'bg-sky-100 text-sky-700' },
            { label: 'Administradores', count: admins.length, icon: '👑', color: 'bg-purple-100 text-purple-700' },
            { label: 'Bloqueados', count: bloqueados.length, icon: '🔒', color: 'bg-red-100 text-red-700' },
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

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-blue-900">
              Todos los usuarios ({usuarios.length})
            </h2>
            {esAdmin && (
              <p className="text-xs text-gray-400 mt-0.5">
                Como administrador puedes bloquear o desbloquear usuarios manualmente
              </p>
            )}
          </div>

          {usuarios.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Nombre</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">RUT</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Correo</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Curso</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Rol</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Registro</th>
                  {esAdmin && (
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Acción</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map(u => (
                  <tr key={u.id} className={`hover:bg-blue-50 transition-colors ${u.blocked ? 'bg-red-50' : ''}`}>

                    <td className="px-6 py-4 font-medium text-gray-800">
                      <Link href={`/usuarios/${u.id}`} className="text-blue-700 hover:underline">
                        {roleIcon[u.role]} {u.full_name ?? '—'}
                      </Link>
                    </td>

                    <td className="px-6 py-4 text-gray-500">{u.rut ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-500">{u.email}</td>
                    <td className="px-6 py-4 text-gray-500">{u.curso ?? '—'}</td>

                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColor[u.role] ?? 'bg-gray-100'}`}>
                        {u.role}
                      </span>
                    </td>

                    {/* Estado bloqueado/activo */}
                    <td className="px-6 py-4">
                      {u.blocked ? (
                        <div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            🔒 Bloqueado
                          </span>
                          {u.blocked_reason && esAdmin && (
                            <p className="text-xs text-red-400 mt-1 max-w-xs truncate" title={u.blocked_reason}>
                              {u.blocked_reason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          ✅ Activo
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString('es-CL')}
                    </td>

                    {/* Botón solo para admin y no sobre sí mismo */}
                    {esAdmin && (
                      <td className="px-6 py-4">
                        {u.role !== 'admin' ? (
                          <button
                            onClick={() => toggleBloqueo(u)}
                            disabled={loadingId === u.id}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap ${
                              u.blocked
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}>
                            {loadingId === u.id
                              ? '...'
                              : u.blocked ? '🔓 Desbloquear' : '🔒 Bloquear'
                            }
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    )}
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
