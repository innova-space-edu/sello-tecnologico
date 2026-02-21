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
    title: '', description: '', objectives: '',
    type: 'Proyecto', status: 'Borrador',
    course_id: '', start_date: '', end_date: ''
  })

  useEffect(() => {
    supabase.from('courses').select('id, name').then(({ data }) => setCursos(data ?? []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('projects').insert({ ...form, owner_id: user?.id })
    router.push('/proyectos')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Nuevo Proyecto</h1>
          <p className="text-gray-500 mt-1">Completa los datos del proyecto</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                placeholder="Nombre del proyecto"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Curso</label>
              <select value={form.course_id} onChange={e => setForm({...form, course_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Sin curso asignado</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {['Proyecto','Actividad','Plan','Implementación'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {['Borrador','En progreso','En revisión','Aprobado','Cerrado'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                rows={3} placeholder="Describe el proyecto..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objetivos</label>
              <textarea value={form.objectives} onChange={e => setForm({...form, objectives: e.target.value})}
                rows={3} placeholder="Objetivos del proyecto..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha término</label>
                <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {loading ? 'Guardando...' : 'Crear proyecto'}
              </button>
              <button type="button" onClick={() => router.push('/proyectos')}
                className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
