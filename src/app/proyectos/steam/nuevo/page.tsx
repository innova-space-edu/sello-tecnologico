'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { getSteamTemplate, ROUTE_LABELS, STEAM_PHASES, type SteamRoute } from '@/lib/steam-templates'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

function NewSteamProjectForm() {
  const params = useSearchParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const requestedSlug = params.get('template')
  const isFreeIdea = requestedSlug === 'idea-libre'
  const template = getSteamTemplate(requestedSlug)
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: template?.title ?? '',
    description: template?.summary ?? '',
    courseId: '',
    route: (template?.route ?? 'engineering') as SteamRoute,
    mode: template?.mode ?? 'Híbrido',
    level: template?.levels[0] ?? '1° medio',
    guidingQuestion: template?.guidingQuestion ?? '',
    organization: 'Grupal',
  })

  useEffect(() => {
    supabase.from('courses').select('id, name').order('name').then(({ data }) => setCourses((data ?? []) as Array<{ id: string; name: string }>))
  }, [supabase])

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!form.title.trim() || !form.guidingQuestion.trim()) {
      setError('Escribe el nombre y la pregunta guía para comenzar.')
      return
    }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const templateSlug = template?.slug ?? 'idea-libre'
    const { data: project, error: projectError } = await supabase.from('projects').insert({
      owner_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      status: 'En progreso',
      type: 'Proyecto STEAM guiado',
      course_id: form.courseId || null,
      organizacion_trabajo: form.organization,
      pregunta_guia: form.guidingQuestion.trim(),
      metodologia: ROUTE_LABELS[form.route],
      tipo_proyecto: ['STEAM', ROUTE_LABELS[form.route]],
      asignaturas: template?.areas ?? [],
      steam_template_slug: templateSlug,
      steam_route: form.route,
      steam_mode: form.mode,
      steam_level: form.level,
    }).select('id').single()

    if (projectError || !project) {
      setError(projectError?.message ?? 'No fue posible crear el proyecto.')
      setLoading(false)
      return
    }

    const { data: workspace, error: workspaceError } = await supabase.from('steam_project_workspaces').insert({
      project_id: project.id,
      template_slug: templateSlug,
      route_type: form.route,
      current_phase: 1,
      progress_percent: 0,
      safety_status: 'pending',
      created_by: user.id,
    }).select('id').single()

    if (workspaceError || !workspace) {
      await supabase.from('projects').delete().eq('id', project.id)
      setError(workspaceError?.message ?? 'No fue posible iniciar la ruta guiada.')
      setLoading(false)
      return
    }

    const phaseRows = STEAM_PHASES.map(phase => ({
      workspace_id: workspace.id,
      phase_number: phase.number,
      phase_key: phase.key,
      status: phase.number === 1 ? 'in_progress' : 'not_started',
      content: phase.number === 1 ? { pregunta_guia: form.guidingQuestion.trim(), descripcion_inicial: form.description.trim() } : {},
    }))
    const { error: phaseError } = await supabase.from('steam_phase_entries').insert(phaseRows)
    if (phaseError) {
      await supabase.from('projects').delete().eq('id', project.id)
      setError(phaseError.message)
      setLoading(false)
      return
    }

    router.push(`/proyectos/${project.id}/steam`)
    router.refresh()
  }

  if (!template && !isFreeIdea) return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="flex-1 p-8 pt-20 lg:ml-64"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm"><div className="text-5xl">🧭</div><h1 className="mt-3 text-xl font-black">Plantilla no encontrada</h1><Link href="/proyectos/steam" className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Volver al catálogo</Link></div></main></div>

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 pt-16 lg:ml-64 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/proyectos/steam" className="text-sm font-semibold text-blue-600 hover:underline">← Cambiar plantilla</Link>
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-blue-700 to-violet-700 p-6 text-white sm:p-8">
              <div className="flex items-start gap-4"><span className="text-5xl">{template?.icon ?? '✨'}</span><div><p className="text-xs font-black uppercase tracking-widest text-blue-200">{isFreeIdea ? 'Idea propia' : 'Plantilla seleccionada'}</p><h1 className="mt-1 text-2xl font-black">{template?.title ?? 'Crear mi propio proyecto STEAM'}</h1><p className="mt-2 text-sm leading-relaxed text-blue-100">La plataforma te guiará por ocho fases. Solo verás lo necesario en cada momento.</p></div></div>
            </div>
            <form onSubmit={createProject} className="space-y-5 p-6 sm:p-8">
              {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">⚠️ {error}</div>}
              <label className="block text-sm font-bold text-slate-700">Nombre del proyecto *<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Un nombre claro y atractivo" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-300" /></label>
              <label className="block text-sm font-bold text-slate-700">¿Qué quieres investigar, crear o solucionar?<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={3} placeholder="Explícalo con tus propias palabras." className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-300" /></label>
              <label className="block text-sm font-bold text-slate-700">Pregunta guía *<textarea required value={form.guidingQuestion} onChange={event => setForm({ ...form, guidingQuestion: event.target.value })} rows={2} placeholder="¿Cómo podríamos…? / ¿Cómo afecta…?" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-300" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">Curso<select value={form.courseId} onChange={event => setForm({ ...form, courseId: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"><option value="">Sin curso por ahora</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
                <label className="text-sm font-bold text-slate-700">Organización<select value={form.organization} onChange={event => setForm({ ...form, organization: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"><option>Grupal</option><option>Individual</option><option>Curso completo</option></select></label>
                <label className="text-sm font-bold text-slate-700">Nivel<select value={form.level} onChange={event => setForm({ ...form, level: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"><option>1° medio</option><option>2° medio</option><option>3° medio</option><option>4° medio</option></select></label>
                <label className="text-sm font-bold text-slate-700">Ruta<select disabled={!isFreeIdea} value={form.route} onChange={event => setForm({ ...form, route: event.target.value as SteamRoute })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal disabled:bg-slate-50">{Object.entries(ROUTE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              </div>
              {template && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Resultado esperado:</strong> {template.product}<div className="mt-2 text-xs text-emerald-700">Podrás adaptar los materiales, la pregunta y las pruebas durante el proyecto.</div></div>}
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-black text-white hover:bg-blue-700 disabled:opacity-50">{loading ? 'Preparando tu ruta…' : '🚀 Crear proyecto y comenzar'}</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function NewSteamProjectPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-50 p-10 text-center text-slate-500">Cargando plantilla…</div>}><NewSteamProjectForm /></Suspense>
}
