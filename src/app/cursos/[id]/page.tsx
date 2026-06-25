import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import AgregarMiembroForm from './AgregarMiembroForm'
import EditarCursoForm from './EditarCursoForm'

const statusColor: Record<string, string> = {
  'Borrador': 'bg-gray-100 text-gray-600',
  'En progreso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-yellow-100 text-yellow-700',
  'Aprobado': 'bg-green-100 text-green-700',
  'Cerrado': 'bg-red-100 text-red-600',
}

export default async function CursoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfilActual } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  const puedeAgregarMiembros = perfilActual?.role === 'docente' ||
    perfilActual?.role === 'admin' ||
    perfilActual?.role === 'coordinador'
  const puedeEditarCurso = perfilActual?.role === 'admin' || perfilActual?.role === 'coordinador'

  const { data: curso } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single()

  const { data: proyectos } = await supabase
    .from('projects')
    .select('*')
    .eq('course_id', id)
    .order('created_at', { ascending: false })

  const { data: miembros } = await supabase
    .from('course_members')
    .select('*, profiles(full_name, email, role, rut)')
    .eq('course_id', id)

  let estudiantesDisponibles: any[] = []
  if (puedeAgregarMiembros) {
    const miembroIds = miembros?.map((m: any) => m.user_id) ?? []
    const { data: todos } = await supabase
      .from('profiles')
      .select('id, full_name, email, rut')
      .eq('role', 'estudiante')
      .order('full_name')
    estudiantesDisponibles = (todos ?? []).filter(e => !miembroIds.includes(e.id))
  }

  if (!curso) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <p className="text-gray-500">Curso no encontrado.</p>
      </main>
    </div>
  )

  const proyectosCursoHref = `/proyectos?curso=${encodeURIComponent(curso.id)}`
  const aprobadosCursoHref = `/proyectos?curso=${encodeURIComponent(curso.id)}&estado=${encodeURIComponent('Aprobado')}`
  const usuariosCursoHref = `/usuarios?curso=${encodeURIComponent(curso.name ?? '')}`

  const stats = [
    { label: 'Proyectos', value: proyectos?.length ?? 0, icon: '🗂️', color: 'bg-blue-100 text-blue-700', href: proyectosCursoHref, hint: 'Ver proyectos de este curso' },
    { label: 'Miembros', value: miembros?.length ?? 0, icon: '👥', color: 'bg-indigo-100 text-indigo-700', href: usuariosCursoHref, hint: 'Ver usuarios de este curso' },
    { label: 'Aprobados', value: proyectos?.filter(p => p.status === 'Aprobado').length ?? 0, icon: '✅', color: 'bg-green-100 text-green-700', href: aprobadosCursoHref, hint: 'Ver aprobados de este curso' },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        <div className="mb-6">
          <Link href="/cursos" className="text-blue-600 text-sm hover:underline">← Volver a Cursos</Link>
          <div className="flex justify-between items-start mt-3">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">{curso.name}</h1>
              <p className="text-gray-500 mt-1">{curso.level} — {curso.area} — Año {curso.year}</p>
            </div>
            <div className="flex items-center gap-2">
              {puedeEditarCurso && (
                <EditarCursoForm
                  cursoId={curso.id}
                  name={curso.name}
                  level={curso.level ?? ''}
                  area={curso.area ?? ''}
                  year={curso.year ?? new Date().getFullYear()}
                />
              )}
              <Link href={`/proyectos/nuevo?curso=${curso.id}`}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
                + Nuevo proyecto
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
          {stats.map(s => (
            <Link
              key={s.label}
              href={s.href}
              title={s.hint}
              className="group bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 border border-transparent hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className={`text-2xl p-3 rounded-lg ${s.color}`}>{s.icon}</div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
              <span className="opacity-0 group-hover:opacity-100 text-blue-500 text-sm transition-opacity">Ir →</span>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <Link href={proyectosCursoHref} className="block px-6 py-4 border-b border-gray-100 hover:bg-blue-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-blue-900">Proyectos del curso</h2>
                  <span className="text-xs text-blue-500 opacity-70">Ver todos →</span>
                </div>
              </Link>
              {proyectos && proyectos.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Proyecto</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Estado</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Fecha</th>
                      {puedeEditarCurso && <th className="text-left px-4 py-3 text-gray-500 font-medium">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {proyectos.map(p => (
                      <tr key={p.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/proyectos/${p.id}`} className="font-medium text-blue-700 hover:underline">
                            {p.title}
                          </Link>
                          {p.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[p.status] ?? 'bg-gray-100'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-xs">{p.start_date ?? '—'}</td>
                        {puedeEditarCurso && (
                          <td className="px-4 py-4">
                            <Link href={`/proyectos/${p.id}/editar`}
                              className="text-blue-400 hover:text-blue-600 text-xs hover:underline">
                              ✏️ Editar
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-10 text-center text-gray-400">
                  <div className="text-3xl mb-2">🗂️</div>
                  No hay proyectos en este curso aún
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {puedeAgregarMiembros && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-blue-900">Agregar estudiante</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Solo visible para docentes y coordinadores</p>
                </div>
                <div className="p-5">
                  {estudiantesDisponibles.length > 0 ? (
                    <AgregarMiembroForm cursoId={id} estudiantes={estudiantesDisponibles} />
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-2">
                      Todos los estudiantes ya están en este curso
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <Link href={usuariosCursoHref} className="block px-5 py-4 border-b border-gray-100 hover:bg-indigo-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-blue-900">Miembros ({miembros?.length ?? 0})</h2>
                  <span className="text-xs text-indigo-500 opacity-70">Ver usuarios →</span>
                </div>
              </Link>
              {miembros && miembros.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {miembros.map((m: any) => (
                    <Link key={m.user_id} href={`/usuarios/${m.user_id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-indigo-50 transition-colors">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                        {(m.profiles?.full_name ?? m.profiles?.email)?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">
                          {m.profiles?.full_name ?? m.profiles?.email}
                        </p>
                        <p className="text-xs text-gray-400">
                          {m.profiles?.role}
                          {m.profiles?.rut ? ` · ${m.profiles.rut}` : ''}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-400 text-sm">Sin miembros asignados</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
