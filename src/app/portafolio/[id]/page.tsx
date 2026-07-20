/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import PortfolioSections from '@/components/PortfolioSections'
import ExportPortafolioPDF from '@/components/ExportPortafolioPDF'
import { PortfolioAction, PortfolioEmpty, PortfolioField } from '@/components/portafolio/PortfolioValue'

const etapaColor: Record<string, string> = {
  inicial: 'bg-yellow-100 text-yellow-700',
  intermedia: 'bg-blue-100 text-blue-700',
  final: 'bg-green-100 text-green-700',
}

const etapaIcon: Record<string, string> = {
  inicial: '🟡', intermedia: '🔵', final: '🟢',
}

export default async function PortafolioEstudiantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: portafolio } = await supabase
    .from('portfolios').select('*, profiles(full_name, email, curso, rut)')
    .eq('id', id).single()

  if (!portafolio) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 pt-16 lg:pt-8">
        <p className="text-gray-500">Portafolio no encontrado.</p>
      </main>
    </div>
  )

  const { data: evidencias } = await supabase
    .from('evidences').select('*, projects(title)')
    .eq('created_by', portafolio.user_id)
    .order('created_at', { ascending: true })

  const { data: secciones } = await supabase
    .from('portfolio_sections')
    .select('*')
    .eq('portfolio_id', portafolio.id)
    .order('order_index', { ascending: true })

  const [{ data: proyectosPropios }, { data: colaboraciones }] = await Promise.all([
    supabase.from('projects').select('*').eq('owner_id', portafolio.user_id).order('updated_at', { ascending: false }),
    supabase.from('project_collaborators').select('project_id').eq('user_id', portafolio.user_id).eq('status', 'accepted'),
  ])
  const sharedIds = [...new Set((colaboraciones ?? []).map(row => row.project_id).filter(Boolean))]
  const { data: proyectosCompartidos } = sharedIds.length
    ? await supabase.from('projects').select('*').in('id', sharedIds).order('updated_at', { ascending: false })
    : { data: [] as any[] }
  const proyectos = Array.from(new Map([...(proyectosPropios ?? []), ...(proyectosCompartidos ?? [])].map(project => [project.id, project])).values())

  const estudiante = portafolio.profiles
  const evInicial = evidencias?.filter(e => e.evidencia_tipo === 'inicial') ?? []
  const evIntermedia = evidencias?.filter(e => e.evidencia_tipo === 'intermedia') ?? []
  const evFinal = evidencias?.filter(e => e.evidencia_tipo === 'final') ?? []

  const evidenceProgress = Math.min(100, Math.round(((evidencias?.length ?? 0) / 9) * 100))

  return (
    <div className="flex min-h-screen bg-[#f5f6fb]">
      <Sidebar />
      <main className="min-w-0 flex-1 px-3 pb-14 pt-16 sm:px-5 lg:px-8 lg:pt-7">
        <div className="mx-auto max-w-7xl">
          <Link href="/portafolio" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-violet-700">← Volver a portafolios</Link>

          <header className="relative mt-4 overflow-hidden rounded-[34px] border border-violet-100 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-sky-100 p-6 text-slate-900 shadow-xl shadow-violet-100/70 sm:p-9">
            <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-fuchsia-300/40 blur-3xl" />
            <div className="absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-cyan-200/50 blur-3xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-7">
              <div className="flex min-w-0 items-center gap-4 sm:gap-6">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] bg-gradient-to-br from-violet-400 to-fuchsia-500 text-3xl font-black shadow-xl ring-4 ring-white/10 sm:h-24 sm:w-24">{estudiante?.full_name?.[0]?.toUpperCase() ?? '?'}</div>
                <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">Portafolio personal · {portafolio.year}</p><h1 className="mt-2 truncate text-2xl font-black text-slate-900 sm:text-4xl">{estudiante?.full_name ?? estudiante?.email}</h1><p className="mt-2 text-sm text-slate-600">{estudiante?.curso ?? 'Curso no indicado'} · Una colección viva de proyectos y aprendizajes</p></div>
              </div>
              <ExportPortafolioPDF portafolio={portafolio} estudiante={estudiante} evidencias={evidencias ?? []} proyectos={proyectos} secciones={secciones ?? []} />
            </div>
            <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white"><p className="text-3xl font-black text-violet-700">{proyectos.length}</p><p className="text-xs text-slate-500">Proyectos</p></div><div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white"><p className="text-3xl font-black text-blue-700">{evidencias?.length ?? 0}</p><p className="text-xs text-slate-500">Evidencias</p></div><div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white"><p className="text-3xl font-black text-emerald-700">{evFinal.length}</p><p className="text-xs text-slate-500">Resultados finales</p></div><div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white"><p className="text-3xl font-black text-fuchsia-700">{secciones?.length ?? 0}</p><p className="text-xs text-slate-500">Secciones propias</p></div></div>
          </header>

          <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-6">
              {(portafolio.quien_soy || portafolio.que_interesa_aprender || portafolio.que_espero_mejorar) && <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"><div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 py-5 text-white"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-100">Mi identidad</p><h2 className="mt-1 text-2xl font-black">Así comienza mi historia</h2></div><div className="grid gap-4 p-5 md:grid-cols-2 sm:p-7"><PortfolioField label="¿Quién soy?" value={portafolio.quien_soy} accent="violet" /><PortfolioField label="¿Qué me interesa aprender?" value={portafolio.que_interesa_aprender} accent="blue" /><PortfolioField label="¿Qué espero mejorar este año?" value={portafolio.que_espero_mejorar} accent="emerald" /></div></section>}

              <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-500">Colección de proyectos</p><h2 className="mt-1 text-2xl font-black text-slate-900">Expedientes completos</h2><p className="mt-1 text-sm text-slate-500">Cada portada abre el recorrido completo, desde la plantilla hasta el informe final.</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{proyectos.length}</span></div>{proyectos.length ? <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-7">{proyectos.map((project: any, index: number) => <Link key={project.id} href={`/portafolio/proyecto/${project.id}?estudiante=${portafolio.user_id}&portafolio=${portafolio.id}`} className={`group relative min-h-64 overflow-hidden rounded-[26px] p-6 text-slate-900 shadow-lg transition hover:-translate-y-1 hover:shadow-xl ${index % 3 === 0 ? 'bg-gradient-to-br from-violet-200 via-fuchsia-100 to-rose-200' : index % 3 === 1 ? 'bg-gradient-to-br from-blue-200 via-cyan-100 to-emerald-200' : 'bg-gradient-to-br from-amber-100 via-orange-100 to-rose-200'}`}><div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/40 blur-xl" /><div className="relative flex h-full flex-col"><div className="flex items-center justify-between"><span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ring-white">{project.tipo_proyecto ?? 'Proyecto'}</span><span className="text-2xl">✦</span></div><h3 className="mt-8 text-2xl font-black leading-tight">{project.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{project.description ?? project.pregunta_guia ?? 'Explora todo el proceso y los resultados de este proyecto.'}</p><div className="mt-auto flex items-end justify-between pt-7"><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Actualizado</p><p className="text-xs font-bold">{project.updated_at ? new Date(project.updated_at).toLocaleDateString('es-CL') : 'Sin fecha'}</p></div><span className="rounded-full bg-white px-4 py-2 text-xs font-black text-violet-700 shadow-sm transition group-hover:scale-105">Explorar →</span></div></div></Link>)}</div> : <div className="p-5 sm:p-7"><PortfolioEmpty icon="🗂️" title="Aún no hay proyectos vinculados" description="Cuando el estudiante cree o se incorpore a un proyecto, su expediente aparecerá aquí como una nueva portada." /></div>}</section>

              <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Galería del proceso</p><h2 className="mt-1 text-2xl font-black text-slate-900">Evidencias destacadas</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{evidencias?.length ?? 0}</span></div>{evidencias?.length ? <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">{evidencias.map(ev => <Link key={ev.id} href={`/evidencias/${ev.id}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">{ev.file_url && ev.file_type?.startsWith('image/') ? <div className="h-44 overflow-hidden bg-slate-100"><img src={ev.file_url} alt={ev.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div> : <div className="flex h-32 items-center justify-center bg-gradient-to-br from-emerald-50 to-cyan-50 text-5xl">{ev.file_type?.startsWith('video/') ? '🎥' : '📎'}</div>}<div className="p-4"><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black capitalize ${etapaColor[ev.evidencia_tipo] ?? 'bg-slate-100 text-slate-600'}`}>{etapaIcon[ev.evidencia_tipo] ?? '✦'} {ev.evidencia_tipo ?? 'evidencia'}</span><span className="text-[10px] text-slate-400">{new Date(ev.created_at).toLocaleDateString('es-CL')}</span></div><h3 className="mt-3 font-black text-slate-900">{ev.title}</h3><p className="mt-1 text-xs text-slate-500">{ev.projects?.title ?? 'Proyecto'}</p>{ev.reflexion_aprendizaje && <p className="mt-3 line-clamp-2 text-sm italic leading-6 text-slate-600">“{ev.reflexion_aprendizaje}”</p>}</div></Link>)}</div> : <div className="p-5 sm:p-7"><PortfolioEmpty icon="📎" title="Sin evidencias todavía" description="Las imágenes, videos y documentos importantes formarán una galería visual en esta sección." /></div>}</section>

              {(portafolio.lo_que_aprendi || portafolio.lo_que_mejore || portafolio.quiero_aprender || portafolio.tecnologia_ayudo) && <section className="rounded-[28px] border border-fuchsia-100 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-rose-100 p-6 text-slate-900 shadow-lg shadow-fuchsia-100/60 sm:p-8"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-600">Cierre del año</p><h2 className="mt-2 text-3xl font-black">Lo que me llevo de este recorrido</h2><div className="mt-6 grid gap-4 md:grid-cols-2"><PortfolioField label="Lo que más aprendí" value={portafolio.lo_que_aprendi} accent="violet" /><PortfolioField label="Lo que mejoré" value={portafolio.lo_que_mejore} accent="emerald" /><PortfolioField label="Lo próximo que quiero aprender" value={portafolio.quiero_aprender} accent="blue" /><PortfolioField label="Cómo me ayudó la tecnología" value={portafolio.tecnologia_ayudo} accent="rose" /></div></section>}

              {secciones && secciones.length > 0 && <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-500">Contenido personal</p><h2 className="mb-5 mt-1 text-2xl font-black text-slate-900">Secciones creadas por el estudiante</h2><PortfolioSections portfolioId={portafolio.id} initialSections={secciones} editable={false} /></section>}
            </div>

            <aside className="space-y-5 xl:sticky xl:top-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-xl">👤</span><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ficha personal</p><h3 className="font-black text-slate-900">Información</h3></div></div><dl className="mt-5 space-y-3 text-sm">{[['Nombre', estudiante?.full_name], ['Curso', estudiante?.curso], ['RUT', estudiante?.rut], ['Año', portafolio.year]].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt className="text-slate-400">{label}</dt><dd className="text-right font-bold text-slate-800">{value ?? '—'}</dd></div>)}</dl><div className="mt-4 space-y-3"><PortfolioField label="Asignaturas" value={portafolio.asignaturas} accent="blue" /><PortfolioField label="Docentes" value={portafolio.docentes} accent="violet" /></div></div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Progreso visual</p><h3 className="mt-1 text-xl font-black text-slate-900">Evidencias</h3></div><span className="text-3xl font-black text-slate-900">{evidenceProgress}%</span></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-blue-500 to-emerald-500" style={{ width: `${evidenceProgress}%` }} /></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-amber-50 p-3"><p className="text-xl font-black text-amber-600">{evInicial.length}</p><p className="text-[10px] text-amber-700">Iniciales</p></div><div className="rounded-2xl bg-blue-50 p-3"><p className="text-xl font-black text-blue-600">{evIntermedia.length}</p><p className="text-[10px] text-blue-700">Proceso</p></div><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xl font-black text-emerald-600">{evFinal.length}</p><p className="text-[10px] text-emerald-700">Finales</p></div></div></div>
              {proyectos[0] && <div className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-100 to-fuchsia-100 p-6 text-slate-900 shadow-lg shadow-violet-100/60"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">Continuar explorando</p><h3 className="mt-2 text-xl font-black">Abre el expediente más reciente</h3><p className="mt-2 text-sm leading-6 text-slate-600">Revisa la historia completa del proyecto y todo lo que se ha guardado.</p><div className="mt-5"><PortfolioAction href={`/portafolio/proyecto/${proyectos[0].id}?estudiante=${portafolio.user_id}&portafolio=${portafolio.id}`}>Ver expediente →</PortfolioAction></div></div>}
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
