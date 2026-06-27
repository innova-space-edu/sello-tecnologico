import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

const statusOrder = ['Borrador', 'En progreso', 'En revisión', 'Revisado', 'Aprobado', 'Cerrado']

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0
}

function fecha(date?: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
          <div className="rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-sm">
            <div className="mb-3 text-5xl">🔐</div>
            <h1 className="text-xl font-bold text-slate-900">Sesión no disponible</h1>
            <p className="mt-2 text-sm text-slate-500">Inicia sesión nuevamente para ver tu panel.</p>
            <Link href="/login" className="mt-5 inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Ir al login</Link>
          </div>
        </main>
      </div>
    )
  }

  const { data: perfil } = await supabase.from('profiles').select('id, role, full_name, email').eq('id', user.id).single()
  const role = perfil?.role ?? ''
  const isAdmin = role === 'admin'
  const isStaff = ['admin', 'docente', 'coordinador', 'utp'].includes(role)
  const isStudent = role === 'estudiante'

  const [projectsRes, evidencesRes, pagesRes, coursesRes, usersRes, unreadRes] = await Promise.all([
    supabase.from('projects').select('id, title, status, course_id, updated_at, created_at, courses(name), profiles!projects_owner_id_fkey(full_name)').order('updated_at', { ascending: false }).limit(500),
    supabase.from('evidences').select('id, title, type, created_at, projects(title), profiles(full_name)').order('created_at', { ascending: false }).limit(8),
    supabase.from('project_public_pages').select('id, title, slug, status, is_public, updated_at').order('updated_at', { ascending: false }).limit(6),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    isStaff ? supabase.from('profiles').select('*', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('read', false),
  ])

  const proyectos = projectsRes.data ?? []
  const evidencias = evidencesRes.data ?? []
  const paginas = pagesRes.data ?? []
  const totalProyectos = proyectos.length
  const activos = proyectos.filter((p: any) => ['En progreso', 'En revisión'].includes(p.status)).length
  const enRevision = proyectos.filter((p: any) => p.status === 'En revisión').length
  const revisados = proyectos.filter((p: any) => p.status === 'Revisado').length
  const avance = pct(proyectos.filter((p: any) => ['Revisado', 'Aprobado', 'Cerrado'].includes(p.status)).length, totalProyectos)
  const publicadas = paginas.filter((p: any) => p.is_public && p.status === 'published').length
  const cursosCount = coursesRes.count ?? 0
  const usuariosCount = usersRes.count ?? 0
  const unreadMessages = unreadRes.count ?? 0

  const stats = [
    { label: isStudent ? 'Mis proyectos' : 'Proyectos', value: totalProyectos, icon: '🗂️', href: '/proyectos' },
    { label: 'Activos', value: activos, icon: '🚀', href: '/proyectos?estado=En%20progreso' },
    { label: 'En revisión', value: enRevision, icon: '⏳', href: '/proyectos?estado=En%20revisión' },
    { label: 'Revisados', value: revisados, icon: '✅', href: '/proyectos?estado=Revisado' },
    { label: 'Evidencias', value: evidencias.length, icon: '📎', href: '/evidencias' },
    { label: 'Páginas', value: publicadas, icon: '🌐', href: '/vitrinas' },
    { label: 'Cursos', value: cursosCount, icon: '📚', href: '/cursos' },
    { label: 'Usuarios', value: usuariosCount, icon: '👥', href: '/usuarios', show: isStaff },
  ].filter(item => item.show !== false)

  const quickActions = [
    { href: '/calendario', label: 'Abrir calendario', icon: '📅', show: true },
    { href: '/mensajes/broadcast', label: 'Mensaje grupal', icon: '📢', show: isAdmin },
    { href: '/proyectos/nuevo', label: 'Crear proyecto', icon: '🗂️', show: true },
    { href: '/evidencias/nueva', label: 'Subir evidencia', icon: '📎', show: true },
    { href: '/reportes', label: 'Reportes', icon: '📈', show: isStaff },
  ].filter(item => item.show)

  return (
    <div className="flex min-h-screen bg-[#f7f9fc] text-slate-900">
      <Sidebar />
      <main className="lg:ml-64 flex-1 min-w-0 p-4 lg:p-8 pt-16 lg:pt-8">
        <section className="mb-6 overflow-hidden rounded-[2.4rem] bg-gradient-to-br from-blue-900 via-blue-700 to-sky-500 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/20">Panel de seguimiento · Sello Tecnológico</div>
              <h1 className="text-2xl lg:text-4xl font-black leading-tight">Hola, {perfil?.full_name ?? user.email}</h1>
              <p className="mt-2 max-w-3xl text-sm text-blue-50">Revisa proyectos, evidencias, calendario, mensajes y seguimiento del colegio.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold ring-1 ring-white/20">Rol: {role || 'sin rol'}</span>
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold ring-1 ring-white/20">Avance: {avance}%</span>
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold ring-1 ring-white/20">Mensajes sin leer: {unreadMessages}</span>
              </div>
            </div>
            <div className="rounded-[1.8rem] bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur min-w-[240px]">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Progreso general</p>
              <div className="mt-3 h-3 rounded-full bg-white/20 overflow-hidden"><div className="h-full rounded-full bg-white" style={{ width: `${avance}%` }} /></div>
              <p className="mt-2 text-xs text-blue-50">{revisados} proyectos revisados.</p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/calendario" className="group rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md">
            <div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-100 text-3xl text-cyan-700">📅</div><div><p className="text-sm font-black text-cyan-950">Calendario</p><p className="mt-1 text-xs text-cyan-700/70">Ver actividades, fechas y eventos.</p></div></div>
          </Link>
          {isAdmin && <Link href="/mensajes/broadcast" className="group rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
            <div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-3xl text-blue-700">📢</div><div><p className="text-sm font-black text-blue-950">Mensaje grupal</p><p className="mt-1 text-xs text-blue-700/70">Enviar comunicado desde administración.</p></div></div>
          </Link>}
        </section>

        <section className="mb-6 flex flex-wrap gap-3">
          {stats.map(card => <Link key={card.label} href={card.href} className="group flex min-w-[170px] flex-1 items-center gap-3 rounded-full bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md"><div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-700 ring-1 ring-blue-100">{card.icon}</div><div className="min-w-0"><div className="text-xl font-black text-slate-950 leading-none">{card.value}</div><div className="mt-1 truncate text-xs font-semibold text-slate-500">{card.label}</div></div></Link>)}
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <h2 className="font-black text-blue-950">Estado de proyectos</h2>
            <div className="mt-4 space-y-3">{statusOrder.map(status => { const count = proyectos.filter((p: any) => p.status === status).length; return <div key={status}><div className="mb-1 flex items-center justify-between text-xs"><span className="font-bold text-slate-600">{status}</span><span className="text-slate-400">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pct(count, totalProyectos)}%` }} /></div></div> })}</div>
          </div>
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <h2 className="font-black text-blue-950">Accesos rápidos</h2>
            <p className="mb-4 text-xs text-slate-500">Herramientas más usadas.</p>
            <div className="grid grid-cols-1 gap-3">{quickActions.map(action => <Link key={action.href} href={action.href} className="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"><span className="mr-2">{action.icon}</span>{action.label}</Link>)}</div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between"><h2 className="font-black text-blue-950">Proyectos recientes</h2><Link href="/proyectos" className="text-xs font-bold text-blue-700 hover:underline">Todos →</Link></div>{proyectos.slice(0, 6).length > 0 ? <div className="divide-y divide-slate-100">{proyectos.slice(0, 6).map((project: any) => <Link key={project.id} href={`/proyectos/${project.id}`} className="block px-5 py-4 transition hover:bg-blue-50/60"><p className="truncate text-sm font-black text-slate-800">{project.title}</p><p className="mt-1 truncate text-xs text-slate-400">{project.courses?.name ?? 'Sin curso'} · {project.profiles?.full_name ?? '—'}</p></Link>)}</div> : <div className="p-8 text-center text-sm text-slate-400">Sin proyectos todavía.</div>}</div>
          <div className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between"><h2 className="font-black text-blue-950">Últimas evidencias</h2><Link href="/evidencias" className="text-xs font-bold text-blue-700 hover:underline">Todas →</Link></div>{evidencias.length > 0 ? <div className="divide-y divide-slate-100">{evidencias.map((ev: any) => <div key={ev.id} className="px-5 py-4"><p className="truncate text-sm font-black text-slate-800">{ev.title}</p><p className="truncate text-xs text-slate-400">{ev.projects?.title ?? ev.profiles?.full_name ?? '—'} · {fecha(ev.created_at)}</p></div>)}</div> : <div className="p-8 text-center text-sm text-slate-400">Sin evidencias recientes.</div>}</div>
          <div className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between"><h2 className="font-black text-blue-950">Páginas públicas</h2><Link href="/vitrinas" className="text-xs font-bold text-blue-700 hover:underline">Gestionar →</Link></div>{paginas.length > 0 ? <div className="divide-y divide-slate-100">{paginas.map((page: any) => <div key={page.id} className="px-5 py-4"><p className="truncate text-sm font-black text-slate-800">{String(page.title ?? '').replace(/^Vitrina:\s*/i, '')}</p><p className="text-xs text-slate-400">Actualizada: {fecha(page.updated_at)}</p></div>)}</div> : <div className="p-8 text-center text-sm text-slate-400">Aún no hay páginas públicas.</div>}</div>
        </section>
      </main>
    </div>
  )
}
