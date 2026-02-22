import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  'Borrador': 'bg-gray-100 text-gray-600',
  'En progreso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-yellow-100 text-yellow-700',
  'Aprobado': 'bg-green-100 text-green-700',
  'Cerrado': 'bg-red-100 text-red-600',
}

export default async function CursoDetallePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()

  const { data: curso } = await supabase
    .from('courses')
    .select('*')
    .eq('id', params.id)
    .single()

  const { data: proyectos } = await supabase
    .from('projects')
    .select('*')
    .eq('course_id', params.id)
    .order('created_at', { ascending: false })

  const { data: miembros } = await supabase
    .from('course_members')
    .select('*, profiles(full_name, email, role, rut)')
    .eq('course_id', params.id)

  if (!curso) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <p className="text-gray-500">Curso no encontrado.</p>
      </main>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/cursos" className="text-blue-600 text-sm hover:underline">← Volver a Cursos</Link>
          <div className="flex justify-between items-start mt-3">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">{curso.name}</h1>
              <p className="text-gray-500 mt-1">{curso.level} — {curso.area} — Año {curso.year}</p>
            </div>
            <Link href={`/proyectos/nuevo?curso=${curso.id}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
              + Nuevo proyecto
            </Link>
          </div>
        </div>

        {/* Stats del curso */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          {[
            { label: 'Proyectos', value: proyectos?.length ?? 0, icon: '🗂️', color: 'bg-blue-100 text-blue-700' },
            { label: 'Miembros', value: miembros?.length ?? 0, icon: '👥', color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Aprobados', value: proyectos?.filter(p => p.status === 'Aprobado').length ?? 0, icon: '✅', color: 'bg-green-100 text-green-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
              <div className={`text-2xl p-3 rounded-lg ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Proyectos */}
          <div className="col-span-2">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-semibold text-blue-900">Proyectos del curso</h2>
              </div>
              {proyectos && proyectos.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Proyecto</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Estado</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Fecha</th>
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

          {/* Miembros */}
          <div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-blue-900">Miembros ({miembros?.length ?? 0})</h2>
              </div>
              {miembros && miembros.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {miembros.map((m: any) => (
                    <div key={m.user_id} className="px-5 py-3">
                      <p className="font-medium text-gray-800 text-sm">{m.profiles?.full_name ?? m.profiles?.email}</p>
                      <p className="text-xs text-gray-400">{m.profiles?.role} {m.profiles?.rut ? `· ${m.profiles.rut}` : ''}</p>
                    </div>
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
