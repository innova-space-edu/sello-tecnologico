'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

const roleColor: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  coordinador: 'bg-blue-100 text-blue-700',
  docente: 'bg-green-100 text-green-700',
  estudiante: 'bg-sky-100 text-sky-700',
}

const roleIcon: Record<string, string> = {
  admin: '👑', coordinador: '🎯', docente: '👨‍🏫', estudiante: '🎓',
}

type UserProfile = {
  id: string
  full_name: string | null
  email: string
  rut: string | null
  curso: string | null
  role: string
  blocked?: boolean
  blocked_reason?: string | null
  created_at: string
}

export default function UsuariosPage() {
  const supabase = useMemo(() => createClient(), [])
  const [usuarios, setUsuarios] = useState<UserProfile[]>([])
  const [rolActual, setRolActual] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [cursoFiltro, setCursoFiltro] = useState('')

  const fetchUsuarios = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsuarios(data ?? [])
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search)
      const curso = params.get('curso') ?? ''
      if (curso) setCursoFiltro(decodeURIComponent(curso))

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setRolActual(perfil?.role ?? '')
      fetchUsuarios()
    }
    init()
  }, [fetchUsuarios, supabase])

  const toggleBloqueo = async (u: UserProfile) => {
    const accion = u.blocked ? 'desbloquear' : 'bloquear'
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${u.full_name ?? u.email}?`)) return

    setLoadingId(u.id)
    if (u.blocked) {
      await supabase.from('profiles').update({ blocked: false, blocked_reason: null, blocked_at: null }).eq('id', u.id)
    } else {
      await supabase.from('profiles').update({
        blocked: true,
        blocked_reason: 'Bloqueado manualmente por el administrador.',
        blocked_at: new Date().toISOString(),
      }).eq('id', u.id)
    }
    await fetchUsuarios()
    setLoadingId(null)
  }

  const esAdmin = rolActual === 'admin'
  const docentes = usuarios.filter(u => u.role === 'docente')
  const estudiantes = usuarios.filter(u => u.role === 'estudiante')
  const admins = usuarios.filter(u => u.role === 'admin' || u.role === 'coordinador')
  const bloqueados = usuarios.filter(u => u.blocked && u.role !== 'admin')

  const usuariosFiltrados = usuarios.filter(u => {
    const matchRol = filtroRol === 'todos' || u.role === filtroRol || (filtroRol === 'bloqueados' && u.blocked)
    const q = busqueda.toLowerCase()
    const curso = cursoFiltro.toLowerCase()
    const matchBusqueda = !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.rut?.toLowerCase().includes(q) ||
      u.curso?.toLowerCase().includes(q)
    const matchCurso = !curso || u.curso?.toLowerCase().includes(curso) || curso.includes(u.curso?.toLowerCase() ?? '')
    return matchRol && matchBusqueda && matchCurso
  })

  const usuariosPorCurso = useMemo(() => {
    const grupos = new Map<string, UserProfile[]>()

    usuariosFiltrados.forEach(usuario => {
      const curso = usuario.curso?.trim() || 'Sin curso'
      const usuariosDelCurso = grupos.get(curso) ?? []
      grupos.set(curso, [...usuariosDelCurso, usuario])
    })

    return Array.from(grupos.entries())
      .sort(([cursoA], [cursoB]) => {
        if (cursoA === 'Sin curso') return 1
        if (cursoB === 'Sin curso') return -1
        return cursoA.localeCompare(cursoB, 'es', { numeric: true, sensitivity: 'base' })
      })
      .map(([curso, usuariosDelCurso]) => ({
        curso,
        usuarios: [...usuariosDelCurso].sort((a, b) =>
          (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email, 'es', { sensitivity: 'base' })
        ),
      }))
  }, [usuariosFiltrados])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">Usuarios</h1>
          <p className="text-gray-500 mt-1">Docentes y estudiantes registrados en el sistema</p>
        </div>

        {cursoFiltro && (
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-xl px-4 py-3 mb-4 flex flex-wrap justify-between gap-3 items-center text-sm">
            <span>Filtro activo: usuarios del curso {cursoFiltro}.</span>
            <Link href="/usuarios" className="font-semibold hover:underline">Ver todos</Link>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-5">
          {[
            { label: 'Docentes', count: docentes.length, icon: '👨‍🏫', color: 'bg-green-100 text-green-700', filtro: 'docente' },
            { label: 'Estudiantes', count: estudiantes.length, icon: '🎓', color: 'bg-sky-100 text-sky-700', filtro: 'estudiante' },
            { label: 'Administradores', count: admins.length, icon: '👑', color: 'bg-purple-100 text-purple-700', filtro: 'admin' },
            { label: 'Bloqueados', count: bloqueados.length, icon: '🔒', color: 'bg-red-100 text-red-700', filtro: 'bloqueados' },
          ].map(s => (
            <button key={s.label}
              onClick={() => setFiltroRol(filtroRol === s.filtro ? 'todos' : s.filtro)}
              className={`bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 text-left transition-all hover:shadow-md ${filtroRol === s.filtro ? 'ring-2 ring-blue-400' : ''}`}>
              <div className={`text-2xl p-3 rounded-lg ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{s.count}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="🔍 Buscar por nombre, RUT, correo o curso..." className="flex-1 min-w-48 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="todos">Todos los roles</option>
            <option value="admin">👑 Admin</option>
            <option value="coordinador">🎯 Coordinador</option>
            <option value="docente">👨‍🏫 Docente</option>
            <option value="estudiante">🎓 Estudiante</option>
            <option value="bloqueados">🔒 Bloqueados</option>
          </select>
          {(busqueda || filtroRol !== 'todos') && <button onClick={() => { setBusqueda(''); setFiltroRol('todos') }} className="text-sm text-gray-400 hover:text-gray-600 px-2">✕ Limpiar</button>}
          <span className="text-xs text-gray-400 ml-auto">{usuariosFiltrados.length} de {usuarios.length} usuarios</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-blue-900">
              {filtroRol === 'todos' ? `Usuarios por curso (${usuariosFiltrados.length})` :
               filtroRol === 'bloqueados' ? `Usuarios bloqueados por curso (${usuariosFiltrados.length})` :
               `${filtroRol.charAt(0).toUpperCase() + filtroRol.slice(1)}s por curso (${usuariosFiltrados.length})`}
            </h2>
            {esAdmin && <p className="text-xs text-gray-400 mt-0.5">Como administrador puedes bloquear o desbloquear usuarios manualmente</p>}
          </div>

          {usuariosPorCurso.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {usuariosPorCurso.map(({ curso, usuarios: usuariosDelCurso }) => {
                const bloqueadosCurso = usuariosDelCurso.filter(u => u.blocked).length

                return (
                  <details key={curso} className="group bg-white">
                    <summary className="cursor-pointer select-none list-none px-6 py-4 bg-gray-50 hover:bg-blue-50 transition-colors flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold">📘</span>
                        <div>
                          <h3 className="font-semibold text-blue-900">{curso}</h3>
                          <p className="text-xs text-gray-500">Presiona para ver u ocultar usuarios del curso</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-white border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {usuariosDelCurso.length} usuarios
                        </span>
                        {bloqueadosCurso > 0 && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            {bloqueadosCurso} bloqueados
                          </span>
                        )}
                        <span className="text-blue-700 transition-transform group-open:rotate-180">⌄</span>
                      </div>
                    </summary>

                    <div className="overflow-x-auto border-t border-gray-100">
                      <table className="w-full text-sm">
                        <thead className="bg-white border-b border-gray-200">
                          <tr>
                            <th className="text-left px-6 py-3 text-gray-500 font-medium">Nombre</th>
                            <th className="text-left px-6 py-3 text-gray-500 font-medium">RUT</th>
                            <th className="text-left px-6 py-3 text-gray-500 font-medium">Correo</th>
                            <th className="text-left px-6 py-3 text-gray-500 font-medium">Curso</th>
                            <th className="text-left px-6 py-3 text-gray-500 font-medium">Rol</th>
                            <th className="text-left px-6 py-3 text-gray-500 font-medium">Estado</th>
                            <th className="text-left px-6 py-3 text-gray-500 font-medium">Registro</th>
                            {esAdmin && <th className="text-left px-6 py-3 text-gray-500 font-medium">Acción</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {usuariosDelCurso.map(u => (
                            <tr key={u.id} className={`hover:bg-blue-50 transition-colors ${u.blocked ? 'bg-red-50' : ''}`}>
                              <td className="px-6 py-4 font-medium text-gray-800"><Link href={`/usuarios/${u.id}`} className="text-blue-700 hover:underline">{roleIcon[u.role]} {u.full_name ?? '—'}</Link></td>
                              <td className="px-6 py-4 text-gray-500">{u.rut ?? '—'}</td>
                              <td className="px-6 py-4 text-gray-500">{u.email}</td>
                              <td className="px-6 py-4 text-gray-500">{u.curso ?? '—'}</td>
                              <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColor[u.role] ?? 'bg-gray-100'}`}>{u.role}</span></td>
                              <td className="px-6 py-4">
                                {u.blocked ? <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">🔒 Bloqueado</span> : <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">✅ Activo</span>}
                              </td>
                              <td className="px-6 py-4 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString('es-CL')}</td>
                              {esAdmin && (
                                <td className="px-6 py-4">
                                  <div className="flex flex-wrap gap-2">
                                    <Link href={`/usuarios/${u.id}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap bg-blue-100 hover:bg-blue-200 text-blue-700">✏️ Editar</Link>
                                    {u.role !== 'admin' && (
                                      <button onClick={() => toggleBloqueo(u)} disabled={loadingId === u.id} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap ${u.blocked ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
                                        {loadingId === u.id ? '...' : u.blocked ? '🔓 Desbloquear' : '🔒 Bloquear'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400"><div className="text-4xl mb-3">👥</div><p>No hay usuarios para este filtro</p></div>
          )}
        </div>
      </main>
    </div>
  )
}
