'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { getReportBuilderTemplate, REPORT_BUILDER_TEMPLATES } from '@/lib/report-builder-templates'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

export default function NuevoInformePage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [projectId, setProjectId] = useState('')
  const [templateId, setTemplateId] = useState('project')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('projects')
        .select('id, title, course_id, courses(name)')
        .order('created_at', { ascending: false })
      setProjects(data ?? [])
      setLoading(false)
    }
    void load()
  }, [supabase])

  const selectProject = (id: string) => {
    setProjectId(id)
    const project = projects.find(item => item.id === id)
    if (project) setTitle(`Informe: ${project.title}`)
  }

  const selectedTemplate = getReportBuilderTemplate(templateId)

  const createReport = async () => {
    setError('')
    if (!projectId || !title.trim()) { setError('Selecciona un proyecto y escribe el título del informe.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Debes iniciar sesión.')
      const project = projects.find(item => item.id === projectId)

      const { data: existing } = await supabase
        .from('project_reports')
        .select('id, title')
        .eq('project_id', projectId)
        .maybeSingle()

      if (existing?.id) {
        router.push(`/informes/${existing.id}`)
        return
      }

      const { data: report, error: reportError } = await supabase.from('project_reports').insert({
        project_id: projectId,
        course_id: project?.course_id ?? null,
        created_by: user.id,
        title: title.trim(),
        status: 'draft',
        autosave_seconds: 5,
      }).select('id').single()

      if (reportError || !report) {
        if (reportError?.code === '23505') throw new Error('Este proyecto ya tiene un informe. Ábrelo desde la lista de Informes y solicita al jefe que te agregue al equipo.')
        throw reportError ?? new Error('No se pudo crear el informe.')
      }

      const { error: memberError } = await supabase.from('project_report_members').insert({
        report_id: report.id,
        user_id: user.id,
        member_role: 'leader',
        added_by: user.id,
      })
      if (memberError) throw memberError

      const sections = selectedTemplate.sections.map((section, index) => ({
        ...section,
        report_id: report.id,
        sort_order: index,
        created_by: user.id,
        updated_by: user.id,
      }))
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
    <main className="flex-1 p-4 pt-16 lg:ml-64 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link href="/informes" className="text-sm font-semibold text-blue-600 hover:underline">← Volver a Informes</Link>
          <h1 className="mt-3 text-2xl font-bold text-blue-900">Crear informe colaborativo</h1>
          <p className="mt-1 text-gray-500">Un integrante crea el informe y queda como jefe. Después agrega al resto del grupo, quienes podrán ver y editar el mismo documento.</p>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">⚠️ {error}</div>}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700">Proyecto relacionado
              <select value={projectId} onChange={event => selectProject(event.target.value)} disabled={loading} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">{loading ? 'Cargando proyectos…' : 'Selecciona un proyecto'}</option>
                {projects.map(project => <option key={project.id} value={project.id}>{project.title} — {project.courses?.name ?? 'Sin curso'}</option>)}
              </select>
            </label>

            <label className="mt-5 block text-sm font-semibold text-gray-700">Título del informe
              <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Informe del proyecto" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </label>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700">Elige una plantilla inicial</p>
              <p className="mt-1 text-xs text-gray-500">La plantilla solo entrega una estructura. El grupo puede cambiar títulos, agregar, mover o eliminar todos los bloques.</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {REPORT_BUILDER_TEMPLATES.map(template => <button key={template.id} type="button" onClick={() => setTemplateId(template.id)} className={`rounded-xl border p-4 text-left transition ${templateId === template.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-3"><span className="text-2xl">{template.icon}</span><span className="font-bold text-gray-900">{template.name}</span></div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">{template.description}</p>
                  <p className="mt-3 text-xs font-bold text-blue-600">{template.sections.length} bloques iniciales</p>
                </button>)}
              </div>
            </div>

            <button type="button" disabled={saving || loading} onClick={() => void createReport()} className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Creando informe…' : 'Crear informe y abrir editor'}</button>
          </section>

          <aside className="rounded-2xl border border-blue-100 bg-blue-50 p-5 xl:sticky xl:top-5 xl:self-start">
            <h2 className="font-bold text-blue-900">{selectedTemplate.icon} {selectedTemplate.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-blue-800">{selectedTemplate.description}</p>
            <div className="mt-4 space-y-2">
              {selectedTemplate.sections.map((section, index) => <div key={`${section.title}-${index}`} className="rounded-lg bg-white/80 px-3 py-2 text-sm text-blue-900"><strong>{index + 1}.</strong> {section.title}</div>)}
            </div>
            <div className="mt-5 rounded-xl bg-white/80 p-4 text-xs leading-relaxed text-blue-800">
              La información existente del proyecto no se copiará automáticamente. Aparecerá en un panel lateral dentro del editor para usarla solo cuando el grupo lo decida.
            </div>
          </aside>
        </div>
      </div>
    </main>
  </div>
}
