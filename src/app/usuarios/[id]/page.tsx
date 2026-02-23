import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CambiarRolForm from './CambiarRolForm'
import Link from 'next/link'

export default async function UsuarioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: usuario } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  const { data: proyectos } = await supabase
    .from('projects')
    .select('title, status, created_at')
    .eq('owner_id', id)
    .order('created_at', { ascending: false })

  const { data: evidencias } = await supabase
    .from('evidences')
    .select('title, type, created_at')
    .eq('created_by', id)
    .order('created_at', { ascending: false })

  if (!usuario) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <p className="text-gray-500">Usuario no encontrado.</p>
      </main>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-6">
          <Link href="/usuarios" className="text-blue-600 text-sm hover:underline">← Volver a Usuarios</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">
                  {usuario.role === 'docente' ? '👨‍🏫' : usuario.role === 'admin' ? '👑' : '🎓'}
                </div>
                <h2 className="text-lg font-bold text-blue-900">{usuario.full_name ?? '—'}</h2>
                <p className="text-gray-500 text-sm">{usuario.email}</p>
              </div>
              <div className="space-y-2 text-sm border-t border-gray-100 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">RUT</span>
                  <span className="text-gray-700">{usuario.rut ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Curso</span>
                  <span className="text-gray-700">{usuario.curso ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Registro</span>
                  <span className="text-gray-700">{new Date(usuario.created_at).toLocaleDateString('es-CL')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Proyectos</span>
                  <span className="text-gray-700">{proyectos?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Evidencias</span>
                  <span className="text-gray-700">{evidencias?.length ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-blue-900 mb-4">Cambiar rol</h3>
              <CambiarRolForm userId={usuario.id} currentRole={usuario.role} />
            </div>
          </div>

          <div className="col-span-2 space-y-5">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-blue-900">Proyectos creados ({proyectos?.length ?? 0})</h3>
              </div>
              {proyectos && proyectos.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Título</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Estado</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {proyectos.map((p: any, i: number) => (
                      <tr key={i} className="hover:bg-blue-50">
                        <td className="px-6 py-3 text-gray-800">{p.title}</td>
                        <td className="px-6 py-3">
                          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{p.status}</span>
                        </td>
                        <td className="px-6 py-3 text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString('es-CL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">Sin proyectos aún</div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-blue-900">Evidencias subidas ({evidencias?.length ?? 0})</h3>
              </div>
              {evidencias && evidencias.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Título</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Tipo</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {evidencias.map((e: any, i: number) => (
                      <tr key={i} className="hover:bg-blue-50">
                        <td className="px-6 py-3 text-gray-800">{e.title}</td>
                        <td className="px-6 py-3 text-gray-500">{e.type}</td>
                        <td className="px-6 py-3 text-gray-400 text-xs">{new Date(e.created_at).toLocaleDateString('es-CL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">Sin evidencias aún</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
