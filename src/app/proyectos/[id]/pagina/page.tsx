import Sidebar from '@/components/Sidebar'
import ProjectPublicPageEditor from '@/components/vitrinas/ProjectPublicPageEditor'
import PublicShareButtons from '@/components/vitrinas/PublicShareButtons'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function ProyectoPaginaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const [{ data: proyecto }, { data: paginaPublica }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, courses(name)')
      .eq('id', id)
      .single(),
    supabase
      .from('project_public_pages')
      .select('id, title, slug, description, is_public, status, theme_color, accent_color')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const publicUrl = paginaPublica?.slug ? `/p/${paginaPublica.slug}` : ''
  const isPublished = Boolean(paginaPublica?.is_public && paginaPublica?.status === 'published')

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

        {publicUrl && (
          <div className="max-w-6xl mb-5">
            <PublicShareButtons
              url={publicUrl}
              title={String(paginaPublica?.title ?? proyecto?.title ?? 'Página pública Sello Tecnológico').replace(/^Vitrina:\s*/i, '')}
              description={isPublished ? paginaPublica?.description : 'Guarda y publica la página para compartir el enlace con la comunidad.'}
              theme={paginaPublica?.theme_color ?? '#2563eb'}
              accent={paginaPublica?.accent_color ?? '#0ea5e9'}
            />
            {!isPublished && (
              <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                La página existe, pero aún está como borrador u oculta. Publícala para que el enlace se pueda abrir públicamente.
              </p>
            )}
          </div>
        )}

        <div className="max-w-6xl">
          <ProjectPublicPageEditor projectId={id} />
        </div>
      </main>
    </div>
  )
}
