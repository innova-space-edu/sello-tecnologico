import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

type PublicPage = {
  id: string
  title: string
  slug: string
  description?: string | null
  status: string
  is_public: boolean
  published_at?: string | null
  created_at: string
  theme_color?: string | null
  projects?: { id?: string | null; title?: string | null } | null
  courses?: { name?: string | null } | null
  profiles?: { full_name?: string | null; email?: string | null } | null
}

const statusClass: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  hidden: 'bg-orange-100 text-orange-700',
  archived: 'bg-slate-100 text-slate-700',
}

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  pending_review: 'En revisión',
  published: 'Publicado',
  hidden: 'Oculto',
  archived: 'Archivado',
}

function cleanTitle(title: string) {
  return title.replace(/^Vitrina:\s*/i, '').trim()
}

export default async function VitrinasPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  const role = profile?.role ?? ''
  const isStaff = ['admin', 'docente', 'coordinador', 'utp'].includes(role)

  let query = supabase
    .from('project_public_pages')
    .select('*, projects(id, title), courses(name), profiles!project_public_pages_created_by_fkey(full_name, email)')
    .order('updated_at', { ascending: false })

  if (!isStaff) query = query.eq('created_by', user?.id ?? '')

  const { data } = await query
  const pages = (data ?? []) as unknown as PublicPage[]

  const published = pages.filter(page => page.status === 'published').length
  const drafts = pages.filter(page => page.status !== 'published').length

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-sky-500 font-semibold">Vitrina de Proyectos</p>
            <h1 className="text-2xl font-bold text-blue-900 mt-1">Páginas públicas</h1>
            <p className="text-gray-500 mt-1">Crea páginas con podcast, videos, imágenes y materiales para compartir con un link público.</p>
          </div>
          <Link href="/vitrinas/nueva" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
            + Crear página
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total páginas', value: pages.length, icon: '🌐', color: 'bg-blue-100 text-blue-700' },
            { label: 'Publicadas', value: published, icon: '✅', color: 'bg-green-100 text-green-700' },
            { label: 'Borradores', value: drafts, icon: '📝', color: 'bg-yellow-100 text-yellow-700' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl shadow-sm p-5 flex gap-4 items-center">
              <div className={`text-2xl p-3 rounded-lg ${card.color}`}>{card.icon}</div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 lg:px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-blue-900">Historial de páginas publicables</h2>
          </div>
          {pages.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {pages.map(page => (
                <div key={page.id} className="px-5 lg:px-6 py-4 hover:bg-blue-50 transition-colors">
                  <div className="flex flex-wrap justify-between gap-3 items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusClass[page.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel[page.status] ?? page.status}
                        </span>
                        <span className="text-xs text-gray-400">/p/{page.slug}</span>
                      </div>
                      <h3 className="font-semibold text-gray-800 truncate">{cleanTitle(page.title)}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {page.projects?.title ?? 'Proyecto sin título'} · {page.courses?.name ?? 'Sin curso'}
                      </p>
                      {isStaff && (
                        <p className="text-xs text-gray-400 mt-1">Creado por: {page.profiles?.full_name ?? page.profiles?.email ?? '—'}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Link href={`/proyectos/${page.projects?.id}/pagina`} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold">
                        Editar
                      </Link>
                      {page.is_public && (
                        <Link href={`/p/${page.slug}`} target="_blank" className="text-sm bg-white hover:bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2 rounded-lg font-semibold">
                          Ver pública
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">🌐</div>
              <p>Todavía no hay páginas creadas.</p>
              <Link href="/vitrinas/nueva" className="inline-block mt-3 text-blue-600 hover:underline text-sm">
                Elegir un proyecto para crear página →
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
