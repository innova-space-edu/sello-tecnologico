'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { REPORT_TEMPLATE } from '@/lib/project-report'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

export default function NuevoInformePage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [projectId, setProjectId] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('projects').select('id, title, course_id, courses(name)').order('created_at', { ascending: false })
      setProjects(data ?? [])
    }
    load()
  }, [supabase])

  const selectProject = (id: string) => {
    setProjectId(id)
    const project = projects.find(item => item.id === id)
    if (project && !title) setTitle(`Informe final: ${project.title}`)
  }

  const createReport = async () => {
    setError('')
    if (!projectId || !title.trim()) { setError('Selecciona un proyecto y escribe el título.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Debes iniciar sesión.')
      const project = projects.find(item => item.id === projectId)
      const { data: existing } = await supabase.from('project_reports').select('id').eq('project_id', projectId).maybeSingle()
      if (existing?.id) { router.push(`/informes/${existing.id}`); return }

      const { data: report, error: reportError } = await supabase.from('project_reports').insert({
        project_id: projectId,
        course_id: project?.course_id ?? null,
        created_by: user.id,
        title: title.trim(),
        status: 'draft',
        autosave_seconds: 5,
      }).select('id').single()
      if (reportError || !report) throw reportError ?? new Error('No se pudo crear el informe.')

      await supabase.from('project_report_members').insert({ report_id: report.id, user_id: user.id, member_role: 'leader', added_by: user.id })
      const sections = REPORT_TEMPLATE.map((section, index) => ({ ...section, report_id: report.id, sort_order: index, created_by: user.id, updated_by: user.id }))
      const { error: sectionError } = await supabase.from('project_report_sections').insert(sections)
      if (sectionError) throw sectionError
      router.push(`/informes/${report.id}`)
    } catch (err: any) {
      setError(err?.message ?? 'No fue posible crear el informe.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="flex min-h-screen bg-gray-50">
    <Sidebar />
    <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6"><h1 className="text-2xl font-bold text-blue-900">Crear informe colaborativo</h1><p className="mt-1 text-gray-500">El creador será automáticamente el jefe del informe. Después podrá agregar compañeros del mismo curso, todos con edición habilitada.</p></div>
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">⚠️ {error}</div>}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700">Proyecto relacionado
            <select value={projectId} onChange={event => selectProject(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Selecciona un proyecto</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.title} — {project.courses?.name ?? 'Sin curso'}</option>)}
            </select>
          </label>
          <label className="mt-5 block text-sm font-semibold text-gray-700">Título del informe
            <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Informe final del proyecto" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </label>
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-bold">La plantilla incluirá ejemplos en cada sección</p>
            <p className="mt-1 text-blue-700">Resumen, problema, objetivos, metodología, evidencias, encuestas, resultados, impacto, conclusiones y referencias. El contenido se autoguardará cada 5 segundos.</p>
          </div>
          <button type="button" disabled={saving} onClick={createReport} className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Creando informe…' : 'Crear informe y abrir editor'}</button>
        </section>
      </div>
    </main>
  </div>
}
