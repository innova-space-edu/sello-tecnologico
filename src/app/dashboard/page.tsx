import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

const STATUS_ORDER = ['Borrador', 'En progreso', 'En revisión', 'Revisado', 'Aprobado', 'Cerrado']

const statusColor: Record<string, string> = {
  'Borrador': 'bg-slate-100 text-slate-600 ring-slate-200',
  'En progreso': 'bg-blue-100 text-blue-700 ring-blue-200',
  'En revisión': 'bg-amber-100 text-amber-700 ring-amber-200',
  'Revisado': 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'Aprobado': 'bg-green-100 text-green-700 ring-green-200',
  'Cerrado': 'bg-rose-100 text-rose-700 ring-rose-200',
}

const typeIcon: Record<string, string> = {
  documento: '📄', foto: '🖼️', video: '🎥', enlace: '🔗', presentación: '📊', código: '💻',
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatDateTime(date?: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function lastActivity(project: any) {
  return project.last_autosave_at ?? project.updated_at ?? project.created_at ?? ''
}

function percent(value: number, total: number) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function uniqueById(items: any[]) {
  return Array.from(new Map(items.filter(Boolean).map((item: any) => [item.id, item])).values())
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-sm">
            <div className="mb-3 text-5xl">🔐</div>
            <h1 className="text-xl font-bold text-slate-900">Sesión no disponible</h1>
            <p className="mt-2 text-sm text-slate-500">Inicia sesión nuevamente para ver tu panel.</p>
            <Link href="/login" className="mt-5 inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Ir al login</Link>
          </div>
        </main>
      </div>
    )
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, curso')
    .eq('id', user.id)
    .single()

  const role = perfil?.role ?? ''
  const isStudent = role === 'estudiante'
  const isAdmin = role === 'admin'
  const isStaff = ['admin', 'docente', 'coordinador', 'utp'].includes(role)
  const today = new Date().toISOString().split('T')[0]

  let proyectos: any[] = []
  let evidencias: any[] = []
  let paginasPublicas: any[] = []
  let cursosCount = 0
  let usuariosCount = 0
  let invitacionesPendientes: any[] = []

  const { count: unreadMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', user.id)
    .eq('read', false)

  if (isStudent) {
    const [{ data: propios }, { data: colaboraciones }, { data: invitaciones }] = await Promise.all([
      supabase.from('projects').select('id, title, status, owner_id, course_id, created_at, updated_at, last_autosave_at, start_date, end_date, is_draft, courses(name), profiles!projects_owner_id_fkey(full_name)').eq('owner_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('project_collaborators').select('project_id').eq('user_id', user.id).eq('status', 'accepted'),
      supabase.from('project_invitations').select('id, created_at, projects(title), courses(name), profiles!project_invitations_enviado_por_fkey(full_name)').eq('estudiante_id', user.id).eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(5),
    ])

    const sharedIds = Array.from(new Set((colaboraciones ?? []).map((item: any) => item.project_id).filter(Boolean)))
    let compartidos: any[] = []
    if (sharedIds.length > 0) {
      const { data } = await supabase.from('projects').select('id, title, status, owner_id, course_id, created_at, updated_at, last_autosave_at, start_date, end_date, is_draft, courses(name), profiles!projects_owner_id_fkey(full_name)').in('id', sharedIds).order('updated_at', { ascending: false })
      compartidos = data ?? []
    }

    proyectos = uniqueById([...(propios ?? []), ...compartidos]).sort((a: any, b: any) => new Date(lastActivity(b)).getTime() - new Date(lastActivity(a)).getTime())
    invitacionesPendientes = invitaciones ?? []
    const projectIds = proyectos.map((p: any) => p.id).filter(Boolean)
    cursosCount = new Set(proyectos.map((p: any) => p.course_id).filter(Boolean)).size

    if (projectIds.length > 0) {
      const [{ data: ev }, { data: pages }] = await Promise.all([
        supabase.from('evidences').select('id, title, type, evidencia_tipo, created_at, project_id, profiles(full_name), projects(title)').in('project_id', projectIds).order('created_at', { ascending: false }).limit(8),
        supabase.from('project_public_pages').select('id, title, slug, status, is_public, updated_at, project_id').in('project_id', projectIds).order('updated_at', { ascending: false }).limit(8),
      ])
      evidencias = ev ?? []
      paginasPublicas = pages ?? []
    }
  } else {
    const [coursesRes, usersRes, projectsRes, evidencesRes, pagesRes] = await Promise.all([
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      isStaff ? supabase.from('profiles').select('*', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
      supabase.from('projects').select('id, title, status, owner_id, course_id, created_at, updated_at, last_autosave_at, start_date, end_date, is_draft, courses(name), profiles!projects_owner_id_fkey(full_name)').order('updated_at', { ascending: false }).limit(500),
      supabase.from('evidences').select('id, title, type, evidencia_tipo, created_at, project_id, profiles(full_name), projects(title)').order('created_at', { ascending: false }).limit(10),
      supabase.from('project_public_pages').select('id, title, slug, status, is_public, updated_at, project_id').order('updated_at', { ascending: false }).limit(10),
    ])

    cursosCount = coursesRes.count ?? 0
    usuariosCount = usersRes.count ?? 0
    proyectos = projectsRes.data ?? []
    evidencias = evidencesRes.data ?? []
    paginasPublicas = pagesRes.data ?? []
  }

  const totalProyectos = proyectos.length
  const estados = STATUS_ORDER.map(status => ({ status, count: proyectos.filter((p: any) => p.status === status).length }))
  const proyectosActivos = proyectos.filter((p: any) => ['En progreso', 'En revisión'].includes(p.status)).length
  const enRevision = proyectos.filter((p: any) => p.status === 'En revisión')
  const revisados = proyectos.filter((p: any) => p.status === 'Revisado')
  const borradores = proyectos.filter((p: any) => p.status === 'Borrador' || p.is_draft)
  const cerradosOAprobados = proyectos.filter((p: any) => ['Revisado', 'Aprobado', 'Cerrado'].includes(p.status)).length
  const atrasados = proyectos.filter((p: any) => p.end_date && p.end_date < today && !['Revisado', 'Aprobado', 'Cerrado'].includes(p.status))
  const publicadas = paginasPublicas.filter((p: any) => p.is_public && p.status === 'published').length
  const proyectosConEvidencia = new Set(evidencias.map((ev: any) => ev.project_id).filter(Boolean))
  const proyectosSinEvidencia = proyectos.filter((p: any) => !proyectosConEvidencia.has(p.id))
  const avanceGeneral = percent(cerradosOAprobados, totalProyectos)

  const courseMap = new Map<string, any>()
  proyectos.forEach((p: any) => {
    const key = p.course_id ?? '__sin_curso__'
    const nombre = p.courses?.name ?? 'Sin curso asignado'
    const item = courseMap.get(key) ?? { key, nombre, total: 0, activos: 0, revision: 0, revisados: 0, atrasados: 0 }
    item.total += 1
    if (['En progreso', 'En revisión'].includes(p.status)) item.activos += 1
    if (p.status === 'En revisión') item.revision += 1
    if (p.status === 'Revisado') item.revisados += 1
    if (p.end_date && p.end_date < today && !['Revisado', 'Aprobado', 'Cerrado'].includes(p.status)) item.atrasados += 1
    courseMap.set(key, item)
  })
  const cursosMovimiento = Array.from(courseMap.values()).sort((a, b) => b.total - a.total).slice(0, 6)

  const recentProjects = proyectos.slice(0, 6)
  const recentEvidence = evidencias.slice(0, 6)
  const recentPages = paginasPublicas.slice(0, 5)

  const statCards = [
    { label: isStudent ? 'Mis proyectos' : 'Proyectos', value: totalProyectos, icon: '🗂️', color: 'bg-blue-50 text-blue-700 ring-blue-100', href: '/proyectos' },
    { label: 'Activos', value: proyectosActivos, icon: '🚀', color: 'bg-indigo-50 text-indigo-700 ring-indigo-100', href: '/proyectos?estado=En%20progreso' },
    { label: 'En revisión', value: enRevision.length, icon: '⏳', color: 'bg-amber-50 text-amber-700 ring-amber-100', href: '/proyectos?estado=En%20revisión' },
    { label: 'Revisados', value: revisados.length, icon: '✅', color: 'bg-emerald-50 text-emerald-700 ring-emerald-100', href: '/proyectos?estado=Revisado' },
    { label: 'Evidencias', value: evidencias.length, icon: '📎', color: 'bg-sky-50 text-sky-700 ring-sky-100', href: '/evidencias' },
    { label: 'Calendario', value: 'Abrir', icon: '📅', color: 'bg-cyan-50 text-cyan-700 ring-cyan-100', href: '/calendario' },
    { label: 'Páginas públicas', value: publicadas, icon: '🌐', color: 'bg-teal-50 text-teal-700 ring-teal-100', href: '/vitrinas' },
    { label: isStudent ? 'Cursos vinculados' : 'Cursos', value: cursosCount, icon: '📚', color: 'bg-violet-50 text-violet-700 ring-violet-100', href: '/cursos' },
    { label: 'Usuarios', value: usuariosCount, icon: '👥', color: 'bg-purple-50 text-purple-700 ring-purple-100', href: '/usuarios', visible: isStaff },
  ].filter(card => card.visible !== false)

  const priorities = isStudent
    ? [
        { title: 'Invitaciones pendientes', value: invitacionesPendientes.length, detail: 'Acepta o revisa invitaciones de proyectos compartidos.', icon: '📨', href: '/proyectos/aceptar', show: invitacionesPendientes.length > 0 },
        { title: 'Proyectos activos', value: proyectosActivos, detail: 'Continúa los proyectos que están en progreso o revisión.', icon: '🚀', href: '/proyectos', show: proyectosActivos > 0 },
        { title: 'Sin evidencia registrada', value: proyectosSinEvidencia.length, detail: 'Agrega fotografías, archivos o enlaces para respaldar avances.', icon: '📎', href: '/evidencias/nueva', show: proyectosSinEvidencia.length > 0 },
      ].filter(item => item.show)
    : [
        { title: 'Pendientes de revisión', value: enRevision.length, detail: 'Usa el botón “Revisado” en la tabla de Proyectos para cerrar la revisión.', icon: '⏳', href: '/proyectos?estado=En%20revisión', show: enRevision.length > 0 },
        { title: 'Proyectos revisados', value: revisados.length, detail: 'Ya fueron revisados y ahora se reflejan en Dashboard y Reportes.', icon: '✅', href: '/proyectos?estado=Revisado', show: revisados.length > 0 },
        { title: 'Proyectos atrasados', value: atrasados.length, detail: 'Tienen fecha de término vencida y siguen abiertos.', icon: '⚠️', href: '/proyectos', show: atrasados.length > 0 },
        { title: 'Borradores abiertos', value: borradores.length, detail: 'Proyectos creados que aún no avanzan a ejecución.', icon: '📋', href: '/proyectos?estado=Borrador', show: borradores.length > 0 },
      ].filter(item => item.show)

  const quickActions = [
    { href: '/calendario', label: 'Abrir calendario', icon: '📅', visible: true },
    { href: '/mensajes/broadcast', label: 'Mensaje grupal', icon: '📢', visible: isAdmin },
    { href: '/proyectos/nuevo', label: 'Crear proyecto', icon: '🗂️', visible: true },
    { href: '/proyectos?estado=En%20revisión', label: 'Revisar pendientes', icon: '⏳', visible: isStaff },
    { href: '/proyectos?estado=Revisado', label: 'Ver revisados', icon: '✅', visible: isStaff },
    { href: '/evidencias/nueva', label: 'Subir evidencia', icon: '📎', visible: true },
    { href: '/vitrinas', label: 'Páginas públicas', icon: '🌐', visible: true },
    { href: '/reportes', label: 'Reportes', icon: '📈', visible: isStaff },
  ].filter(action => action.visible)

  return (
    <div className="flex min-h-screen bg-[#f7f9fc] text-slate-900">
      <Sidebar />

      <main className="lg:ml-64 flex-1 min-w-0 p-4 lg:p-8 pt-16 lg:pt-8">
        <section className="mb-6 overflow-hidden rounded-[2.4rem] bg-gradient-to-br from-blue-900 via-blue-700 to-sky-500 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/20">Panel de seguimiento · Sello Tecnológico</div>
              <h1 className="text-2xl lg:text-4xl font-black leading-tight">Hola, {perfil?.full_name ?? user.email}</h1>
              <p className="mt-2 max-w-3xl text-sm text-blue-50">
                {isStudent ? 'Revisa tus proyectos, invitaciones, evidencias, calendario y páginas públicas.' : 'Revisa avances, pendientes, calendario, proyectos revisados y datos sincronizados con reportes.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold ring-1 ring-white/20">Rol: {role || 'sin rol'}</span>
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold ring-1 ring-white/20">Avance: {avanceGeneral}%</span>
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold ring-1 ring-white/20">Revisados: {revisados.length}</span>
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold ring-1 ring-white/20">Mensajes sin leer: {unreadMessages ?? 0}</span>
              </div>
            </div>

            <div className="rounded-[1.8rem] bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur min-w-[240px]">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Progreso general</p>
              <div className="mt-3 h-3 rounded-full bg-white/20 overflow-hidden"><div className="h-full rounded-full bg-white" style={{ width: `${avanceGeneral}%` }} /></div>
              <p className="mt-2 text-xs text-blue-50">{cerradosOAprobados} de {totalProyectos} proyectos revisados, aprobados o cerrados.</p>
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
          {statCards.map(card => (
            <Link key={card.label} href={card.href} className="group flex min-w-[170px] flex-1 items-center gap-3 rounded-full bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ring-1 ${card.color}`}>{card.icon}</div>
              <div className="min-w-0">
                <div className="text-xl font-black text-slate-950 leading-none">{card.value}</div>
                <div className="mt-1 truncate text-xs font-semibold text-slate-500">{card.label}</div>
              </div>
            </Link>
          ))}
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-black text-blue-950">Prioridades</h2><p className="text-xs text-slate-500">Acciones importantes para ordenar el seguimiento.</p></div><Link href="/proyectos" className="text-xs font-bold text-blue-700 hover:underline">Ver proyectos →</Link></div>
            {priorities.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {priorities.map(item => (
                  <Link key={item.title} href={item.href} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4 transition hover:bg-blue-50 hover:border-blue-200">
                    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="text-2xl">{item.icon}</span><div><p className="text-sm font-black text-slate-900">{item.title}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{item.detail}</p></div></div><span className="rounded-full bg-white px-3 py-1 text-lg font-black text-blue-800 ring-1 ring-slate-200">{item.value}</span></div>
                  </Link>
                ))}
              </div>
            ) : <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-700">✅ Todo se ve ordenado por ahora. No hay revisiones urgentes pendientes.</div>}
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <h2 className="font-black text-blue-950">Accesos rápidos</h2><p className="mb-4 text-xs text-slate-500">Herramientas más usadas.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickActions.map(action => <Link key={action.href} href={action.href} className="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"><span className="mr-2">{action.icon}</span>{action.label}</Link>)}
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <h2 className="mb-4 font-black text-blue-950">Estado de proyectos</h2>
            <div className="space-y-3">
              {estados.map(item => <div key={item.status}><div className="mb-1 flex items-center justify-between text-xs"><span className="font-bold text-slate-600">{item.status}</span><span className="text-slate-400">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percent(item.count, totalProyectos)}%` }} /></div></div>)}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 xl:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-black text-blue-950">Cursos con movimiento</h2><p className="text-xs text-slate-500">Cursos agrupados por cantidad de proyectos.</p></div><Link href="/proyectos" className="text-xs font-bold text-blue-700 hover:underline">Abrir listado →</Link></div>
            {cursosMovimiento.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {cursosMovimiento.map(curso => (
                  <div key={curso.key} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3"><div><p className="font-black text-slate-800">{curso.nombre}</p><p className="text-xs text-slate-500">{curso.total} proyecto{curso.total !== 1 ? 's' : ''}</p></div><Link href={`/proyectos?curso=${encodeURIComponent(curso.nombre)}`} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-blue-100">Ver</Link></div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{curso.activos} activos</span><span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{curso.revision} revisión</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{curso.revisados} revisados</span>{curso.atrasados > 0 && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">{curso.atrasados} atrasados</span>}</div>
                  </div>
                ))}
              </div>
            ) : <div className="rounded-[1.5rem] border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">No hay proyectos agrupados por curso todavía.</div>}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between"><h2 className="font-black text-blue-950">Proyectos recientes</h2><Link href="/proyectos" className="text-xs font-bold text-blue-700 hover:underline">Todos →</Link></div>
            {recentProjects.length > 0 ? <div className="divide-y divide-slate-100">{recentProjects.map((project: any) => <Link key={project.id} href={`/proyectos/${project.id}`} className="block px-5 py-4 transition hover:bg-blue-50/60"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{project.title}</p><p className="mt-1 truncate text-xs text-slate-400">{project.courses?.name ?? 'Sin curso'} · {project.profiles?.full_name ?? '—'}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${statusColor[project.status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{project.status}</span></div><p className="mt-2 text-[11px] text-slate-400">Última actividad: {formatDateTime(lastActivity(project))}</p></Link>)}</div> : <div className="p-8 text-center text-sm text-slate-400">Sin proyectos todavía.</div>}
          </div>

          <div className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between"><h2 className="font-black text-blue-950">Últimas evidencias</h2><Link href="/evidencias" className="text-xs font-bold text-blue-700 hover:underline">Todas →</Link></div>
            {recentEvidence.length > 0 ? <div className="divide-y divide-slate-100">{recentEvidence.map((ev: any) => <div key={ev.id} className="px-5 py-4"><div className="flex items-center gap-3"><span className="text-xl">{typeIcon[ev.type] ?? '📎'}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-800">{ev.title}</p><p className="truncate text-xs text-slate-400">{ev.projects?.title ?? ev.profiles?.full_name ?? '—'}</p></div><span className="shrink-0 text-[11px] text-slate-400">{formatDate(ev.created_at)}</span></div></div>)}</div> : <div className="p-8 text-center text-sm text-slate-400">Sin evidencias recientes.</div>}
          </div>

          <div className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between"><h2 className="font-black text-blue-950">Páginas públicas</h2><Link href="/vitrinas" className="text-xs font-bold text-blue-700 hover:underline">Gestionar →</Link></div>
            {recentPages.length > 0 ? <div className="divide-y divide-slate-100">{recentPages.map((page: any) => <div key={page.id} className="px-5 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{String(page.title ?? '').replace(/^Vitrina:\s*/i, '')}</p><p className="text-xs text-slate-400">Actualizada: {formatDate(page.updated_at)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${page.is_public && page.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{page.is_public && page.status === 'published' ? 'Publicada' : 'Borrador'}</span></div>{page.is_public && page.status === 'published' && <Link href={`/p/${page.slug}`} className="mt-2 inline-flex text-xs font-bold text-blue-700 hover:underline">Abrir página pública →</Link>}</div>)}</div> : <div className="p-8 text-center text-sm text-slate-400">Aún no hay páginas públicas.</div>}
          </div>
        </section>
      </main>
    </div>
  )
}
