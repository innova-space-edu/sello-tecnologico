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

export default async function ProyectosPage() {
  const supabase = await createServerSupabaseClient()
  const { data: proyectos } = await supabase
    .from('projects')
    .select('*, courses(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Proyectos</h1>
            <p className="text-gray-500 mt-1">Todos los proyectos del Sello Tecnológico</p>
          </div>
          <Link
            href="/proyectos/nuevo"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            + Nuevo proyecto
          </Link>
        </div>

        {proyectos && proyectos.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Proyecto</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Curso</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Tipo</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Fecha inicio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proyectos.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/proyectos/${p.id}`} className="font-medium text-blue-700 hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{p.courses?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-500">{p.type}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[p.status] ?? 'bg-gray-100'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{p.start_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🗂️</div>
            <h3 className="text-lg font-semibold text-gray-700">No hay proyectos aún</h3>
            <p className="text-gray-400 mt-2">Crea el primer proyecto para comenzar</p>
            <Link
              href="/proyectos/nuevo"
              className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              + Crear proyecto
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
