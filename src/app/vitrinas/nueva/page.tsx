import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

type Project = {
  id: string
  title: string
  status?: string | null
  created_at?: string | null
  courses?: { name?: string | null } | null
  profiles?: { full_name?: string | null } | null
}

export default async function NuevaVitrinaPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  const role = profile?.role ?? ''
  const isStudent = role === 'estudiante'
  const isStaff = ['admin', 'docente', 'coordinador', 'utp'].includes(role)

  let projects: Project[] = []

  if (isStudent) {
    const [{ data: propios }, { data: colaboraciones }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, title, status, created_at, courses(name), profiles!projects_owner_id_fkey(full_name)')
        .eq('owner_id', user?.id ?? '')
        .order('created_at', { ascending: false }),
      supabase
        .from('project_collaborators')
        .select('project_id')
        .eq('user_id', user?.id ?? '')
        .eq('status', 'accepted'),
    ])

    const ids = Array.from(new Set((colaboraciones ?? []).map((row: any) => row.project_id).filter(Boolean)))
    let compartidos: Project[] = []
    if (ids.length > 0) {
      const { data } = await supabase
        .from('projects')
        .select('id, title, status, created_at, courses(name), profiles!projects_owner_id_fkey(full_name)')
        .in('id', ids)
        .order('created_at', { ascending: false })
      compartidos = (data ?? []) as unknown as Project[]
    }

    projects = Array.from(new Map([...(propios ?? []), ...compartidos].map((project: any) => [project.id, project])).values()) as Project[]
  } else if (isStaff) {
    const { data } = await supabase
      .from('projects')
      .select('id, title, status, created_at, courses(name), profiles!projects_owner_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(200)
    projects = (data ?? []) as unknown as Project[]
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href="/vitrinas" className="text-blue-600 text-sm hover:underline">← Volver a vitrinas</Link>
          <p className="text-xs uppercase tracking-widest text-sky-500 font-semibold mt-3">Crear vitrina pública</p>
          <h1 className="text-2xl font-bold text-blue-900 mt-1">Elige un proyecto</h1>
          <p className="text-gray-500 mt-1">Selecciona el proyecto que tendrá página pública con podcast, videos, imágenes y materiales.</p>
        </div>

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 lg:px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-blue-900">Proyectos disponibles</h2>
          </div>
          {projects.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {projects.map(project => (
                <div key={project.id} className="px-5 lg:px-6 py-4 hover:bg-blue-50 transition-colors">
                  <div className="flex flex-wrap justify-between gap-3 items-start">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-800 truncate">{project.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {project.courses?.name ?? 'Sin curso'} · {project.status ?? 'Sin estado'}
                      </p>
                      {isStaff && <p className="text-xs text-gray-400 mt-1">Responsable: {project.profiles?.full_name ?? '—'}</p>}
                    </div>
                    <Link href={`/proyectos/${project.id}/pagina`} className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                      Crear / editar vitrina
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">🗂️</div>
              <p>No hay proyectos disponibles para crear vitrinas.</p>
              <Link href="/proyectos/nuevo" className="inline-block mt-3 text-blue-600 hover:underline text-sm">
                Crear proyecto →
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
