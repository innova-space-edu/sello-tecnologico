import Sidebar from '@/components/Sidebar'
import ProjectPublicPageEditor from '@/components/vitrinas/ProjectPublicPageEditor'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function ProyectoPaginaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: proyecto } = await supabase
    .from('projects')
    .select('id, title, courses(name)')
    .eq('id', id)
    .single()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href={`/proyectos/${id}`} className="text-blue-600 text-sm hover:underline">← Volver al proyecto</Link>
          <div className="mt-2">
            <p className="text-xs uppercase tracking-widest text-sky-500 font-semibold">Página pública del proyecto</p>
            <h1 className="text-2xl font-bold text-blue-900 mt-1">Vitrina de proyecto</h1>
            <p className="text-gray-500 mt-1">
              {proyecto?.title ?? 'Proyecto'} · Crea y publica una página con podcast, audios, videos, imágenes y materiales.
            </p>
          </div>
        </div>
        <div className="max-w-6xl">
          <ProjectPublicPageEditor projectId={id} />
        </div>
      </main>
    </div>
  )
}
