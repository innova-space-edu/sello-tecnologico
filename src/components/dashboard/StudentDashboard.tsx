import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function formatDate(date: string | null | undefined) {
  if (!date) return 'Sin fecha'
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

const completeStatuses = new Set(['Revisado', 'Aprobado', 'Cerrado'])

export default async function StudentDashboard({ userId, name }: { userId: string; name: string }) {
  const supabase = await createServerSupabaseClient()

  // Ninguna consulta de esta vista se hace sin filtrar por el alumno autenticado.
  // Las colaboraciones cuentan solo si fueron aceptadas explícitamente.
  const [
    ownedProjects, collaborators, evidenceResult, myPages, mySurveys,
    myWorks, myReports, myEvaluations, archiveResult, unreadResult,
  ] = await Promise.all([
    supabase.from('projects').select('id,title,status,updated_at,created_at')
      .eq('owner_id', userId).order('updated_at', { ascending: false }).limit(250),
    supabase.from('project_collaborators').select('project_id')
      .eq('user_id', userId).eq('status', 'accepted').limit(250),
    supabase.from('evidences').select('id,title,created_at,project_id', { count: 'exact' })
      .eq('created_by', userId).order('created_at', { ascending: false }).limit(6),
    supabase.from('project_public_pages').select('id,title,status,updated_at', { count: 'exact' })
      .eq('created_by', userId).order('updated_at', { ascending: false }).limit(5),
    supabase.from('online_surveys').select('id,title,status,created_at', { count: 'exact' })
      .eq('creator_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('creative_space_works').select('id,title,status,created_at', { count: 'exact' })
      .eq('uploader_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('project_reports').select('id,title,status,created_at', { count: 'exact' })
      .eq('created_by', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('self_evaluations').select('id,created_at', { count: 'exact' })
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('portfolio_archive_items').select('id', { count: 'exact', head: true })
      .eq('owner_id', userId),
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('receiver_id', userId).eq('read', false),
  ])

  const collaboratorIds = [...new Set((collaborators.data ?? []).map(item => item.project_id))]
    .filter(id => !(ownedProjects.data ?? []).some(project => project.id === id))
  const sharedProjectsResult = collaboratorIds.length
    ? await supabase.from('projects').select('id,title,status,updated_at,created_at')
        .in('id', collaboratorIds).limit(250)
    : { data: [] as NonNullable<typeof ownedProjects.data> }

  const projects = Array.from(new Map(
    [...(ownedProjects.data ?? []), ...(sharedProjectsResult.data ?? [])]
      .map(project => [project.id, project])
  ).values()).sort((a, b) =>
    (b.updated_at ?? b.created_at ?? '').localeCompare(a.updated_at ?? a.created_at ?? '')
  )
  const total = projects.length
  const completed = projects.filter(project => completeStatuses.has(project.status ?? '')).length
  const progress = total ? Math.round(completed * 100 / total) : 0
  const evidence = evidenceResult.data ?? []
  const pages = myPages.data ?? []
  const surveys = mySurveys.data ?? []
  const works = myWorks.data ?? []
  const reports = myReports.data ?? []
  const archiveCount = archiveResult.count ?? 0
  const unread = unreadResult.count ?? 0

  const stats = [
    { label: 'Mis proyectos', count: total, href: '/proyectos', icon: '🗂️' },
    { label: 'Mis evidencias', count: evidenceResult.count ?? evidence.length, href: '/evidencias', icon: '📎' },
    { label: 'Mis encuestas', count: mySurveys.count ?? surveys.length, href: '/mis-encuestas', icon: '🗳️' },
    { label: 'Mis informes', count: myReports.count ?? reports.length, href: '/informes', icon: '📑' },
    { label: 'Mis páginas', count: myPages.count ?? pages.length, href: '/vitrinas', icon: '🌐' },
    { label: 'Mis obras', count: myWorks.count ?? works.length, href: '/espacio-creativo/mis-obras', icon: '🎨' },
    { label: 'Mis autoevaluaciones', count: myEvaluations.count ?? 0, href: '/autoevaluacion', icon: '🌱' },
    { label: 'Mi archivo histórico', count: archiveCount, href: '/portafolio', icon: '📚' },
  ]

  const recent = [
    ...projects.slice(0, 6).map(project => ({
      id: 'project-' + project.id, title: project.title, kind: 'Proyecto',
      date: project.updated_at ?? project.created_at,
      href: '/proyectos/' + project.id, icon: '🗂️',
    })),
    ...evidence.map(item => ({
      id: 'evidence-' + item.id, title: item.title, kind: 'Evidencia',
      date: item.created_at, href: '/evidencias/' + item.id, icon: '📎',
    })),
    ...surveys.map(item => ({
      id: 'survey-' + item.id, title: item.title, kind: 'Encuesta',
      date: item.created_at, href: '/mis-encuestas/creadas/' + item.id, icon: '🗳️',
    })),
    ...works.map(item => ({
      id: 'work-' + item.id, title: item.title, kind: 'Obra creativa',
      date: item.created_at, href: '/espacio-creativo/mis-obras', icon: '🎨',
    })),
    ...reports.map(item => ({
      id: 'report-' + item.id, title: item.title, kind: 'Informe',
      date: item.created_at, href: '/informes', icon: '📑',
    })),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 8)

  return <div className="flex min-h-screen bg-[#f7f9fc] text-slate-900">
    <main className="min-w-0 flex-1 px-4 pb-12 pt-16 lg:px-8 lg:pt-8 lg:ml-64">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-900 via-blue-800 to-sky-500 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200">CreaLab · Mi espacio personal</p>
            <h1 className="mt-2 text-2xl font-black sm:text-4xl">Hola, {name}</h1>
            <p className="mt-3 max-w-2xl text-sm text-blue-50">Aquí aparecen exclusivamente tus trabajos, tus avances y los proyectos en los que participas. No se muestran estadísticas ni actividades de otros estudiantes.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/20 px-3 py-2">Mis proyectos: {total}</span>
              <span className="rounded-full bg-white/20 px-3 py-2">Completados: {completed}</span>
              <span className="rounded-full bg-white/20 px-3 py-2">Mensajes sin leer: {unread}</span>
            </div>
          </div>
          <div className="w-full max-w-xs rounded-2xl bg-white/15 p-5 ring-1 ring-white/20">
            <p className="text-xs font-black uppercase tracking-wide text-blue-100">Avance de mis proyectos</p>
            <p className="mt-2 text-3xl font-black">{progress}%</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: progress + '%' }} />
            </div>
            <p className="mt-2 text-xs text-blue-100">{total ? completed + ' de ' + total + ' proyectos terminados o revisados' : 'Cuando participes en un proyecto, verás aquí tu avance.'}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de mi trabajo">
        {stats.map(card => <Link key={card.label} href={card.href} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-2xl">{card.icon}</span>
          <span><span className="block text-2xl font-black text-blue-950">{card.count}</span><span className="text-xs font-semibold text-slate-600">{card.label}</span></span>
        </Link>)}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-black text-blue-950">Mi actividad reciente</h2>
            <p className="mt-1 text-xs text-slate-500">Solo trabajos creados por ti o colaboraciones aceptadas.</p>
          </div>
          {recent.length
            ? <div className="divide-y divide-slate-100">{recent.map(item => <Link href={item.href} key={item.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-blue-50">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-lg">{item.icon}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{item.title}</span><span className="text-xs text-slate-500">{item.kind} · {formatDate(item.date)}</span></span>
                <span className="text-blue-700">→</span>
              </Link>)}</div>
            : <div className="px-6 py-12 text-center"><p className="text-3xl">📘</p><p className="mt-3 font-semibold text-slate-700">Todavía no hay actividades personales.</p><p className="mt-1 text-sm text-slate-500">Empieza creando tu primer proyecto o subiendo una evidencia.</p></div>}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-black text-blue-950">Mis accesos</h2>
            <div className="mt-4 grid gap-2">
              {[
                { href: '/portafolio', label: 'Mi portafolio y archivo', icon: '📚' },
                { href: '/mis-encuestas', label: 'Mis encuestas', icon: '🗳️' },
                { href: '/calendario', label: 'Mi calendario', icon: '📅' },
                { href: '/mensajes', label: unread ? 'Mensajes (' + unread + ' sin leer)' : 'Mis mensajes', icon: '💬' },
                { href: '/proyectos/nuevo', label: 'Crear proyecto', icon: '🗂️' },
                { href: '/evidencias/nueva', label: 'Subir evidencia', icon: '📎' },
              ].map(action => <Link key={action.href} href={action.href} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50"><span className="mr-2">{action.icon}</span>{action.label}</Link>)}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="font-black text-blue-950">Tu trabajo se conserva</h2>
            <p className="mt-2 text-sm leading-6 text-blue-900">El archivo automático del portafolio registra tus actividades para que puedas consultar tu historia de aprendizaje.</p>
            <Link href="/portafolio" className="mt-4 inline-block rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">Abrir mi portafolio →</Link>
          </div>
        </div>
      </section>
    </main>
  </div>
}
