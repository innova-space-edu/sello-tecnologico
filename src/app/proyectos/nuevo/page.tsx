'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function NuevoProyectoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [cursos, setCursos] = useState<any[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    objectives: '',
    methodology: '',
    expected_results: '',
    resources: '',
    evaluation_criteria: '',
    type: 'Proyecto',
    status: 'Borrador',
    course_id: '',
    start_date: '',
    end_date: '',
    responsible: '',
    participants: '',
  })

  useEffect(() => {
    supabase.from('courses').select('id, name').then(({ data }) => setCursos(data ?? []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('projects').insert({
      title: form.title,
      description: form.description,
      objectives: form.objectives,
      type: form.type,
      status: form.status,
      course_id: form.course_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      owner_id: user?.id,
    })
    if (!error) {
      router.push('/proyectos')
    } else {
      alert('Error al guardar: ' + error.message)
      setLoading(false)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Nuevo Proyecto</h1>
          <p className="text-gray-500 mt-1">Completa la ficha del proyecto educativo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

          {/* Sección 1: Identificación */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-blue-900 mb-4 pb-2 border-b border-gray-100">
              📋 Identificación del proyecto
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Título del proyecto *</label>
                <input required value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Ej: Prototipo de robot recolector de basura"
                  className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Tipo de proyecto</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className={inputClass}>
                    {['Proyecto','Investigación','Prototipo','Actividad','Plan','Implementación','Feria Científica'].map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Estado inicial</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputClass}>
                    {['Borrador','En progreso','En revisión','Aprobado','Cerrado'].map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Curso asociado</label>
                  <select value={form.course_id} onChange={e => setForm({...form, course_id: e.target.value})} className={inputClass}>
                    <option value="">Sin curso asignado</option>
                    {cursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Responsable principal</label>
                  <input value={form.responsible}
                    onChange={e => setForm({...form, responsible: e.target.value})}
                    placeholder="Nombre del docente o líder"
                    className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Participantes</label>
                <input value={form.participants}
                  onChange={e => setForm({...form, participants: e.target.value})}
                  placeholder="Ej: Grupo 3 — Ana, Pedro, Sofía"
                  className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Fecha de inicio</label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm({...form, start_date: e.target.value})}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Fecha de término</label>
                  <input type="date" value={form.end_date}
                    onChange={e => setForm({...form, end_date: e.target.value})}
                    className={inputClass} />
                </div>
              </div>
            </div>
          </div>

          {/* Sección 2: Descripción */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-blue-900 mb-4 pb-2 border-b border-gray-100">
              📝 Descripción del proyecto
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Descripción general *</label>
                <textarea required value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  rows={3} placeholder="¿En qué consiste el proyecto? ¿Qué problema resuelve o qué necesidad aborda?"
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Objetivos del proyecto *</label>
                <textarea required value={form.objectives}
                  onChange={e => setForm({...form, objectives: e.target.value})}
                  rows={3} placeholder="Objetivo general y objetivos específicos del proyecto..."
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Metodología de trabajo</label>
                <textarea value={form.methodology}
                  onChange={e => setForm({...form, methodology: e.target.value})}
                  rows={3} placeholder="¿Cómo se llevará a cabo? ¿Qué pasos o etapas seguirá el equipo?"
                  className={inputClass} />
              </div>
            </div>
          </div>

          {/* Sección 3: Evaluación */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-blue-900 mb-4 pb-2 border-b border-gray-100">
              🎯 Resultados y evaluación
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Resultados esperados</label>
                <textarea value={form.expected_results}
                  onChange={e => setForm({...form, expected_results: e.target.value})}
                  rows={3} placeholder="¿Qué producto, prototipo o aprendizaje se espera obtener al finalizar?"
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Recursos necesarios</label>
                <textarea value={form.resources}
                  onChange={e => setForm({...form, resources: e.target.value})}
                  rows={2} placeholder="Materiales, herramientas, tecnología, espacios que se necesitarán..."
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Criterios de evaluación</label>
                <textarea value={form.evaluation_criteria}
                  onChange={e => setForm({...form, evaluation_criteria: e.target.value})}
                  rows={2} placeholder="¿Cómo se evaluará el éxito del proyecto? ¿Qué indicadores se usarán?"
                  className={inputClass} />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pb-8">
            <button type="submit" disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : '💾 Crear proyecto'}
            </button>
            <button type="button" onClick={() => router.push('/proyectos')}
              className="border border-gray-300 text-gray-600 px-8 py-3 rounded-xl hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
