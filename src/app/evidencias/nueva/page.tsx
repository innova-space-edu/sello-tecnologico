'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function NuevaEvidenciaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [proyectos, setProyectos] = useState<any[]>([])
  const [form, setForm] = useState({
    title: '', description: '', type: 'documento',
    project_id: '', drive_url: '', tags: ''
  })

  useEffect(() => {
    supabase.from('projects').select('id, title').then(({ data }) => setProyectos(data ?? []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const tagsArray = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    await supabase.from('evidences').insert({
      title: form.title,
      description: form.description,
      type: form.type,
      project_id: form.project_id || null,
      drive_url: form.drive_url || null,
      tags: tagsArray,
      created_by: user?.id
    })
    router.push('/evidencias')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Nueva Evidencia</h1>
          <p className="text-gray-500 mt-1">Registra un archivo o enlace como evidencia</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                placeholder="Nombre de la evidencia"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {['documento','foto','video','enlace','presentación','código'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                <select value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Sin proyecto</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                rows={3} placeholder="Describe brevemente esta evidencia..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link de Drive</label>
              <input value={form.drive_url} onChange={e => setForm({...form, drive_url: e.target.value})}
                placeholder="https://drive.google.com/..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
              <input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})}
                placeholder="Ej: robótica, diseño, prototipo (separadas por coma)"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {loading ? 'Guardando...' : 'Guardar evidencia'}
              </button>
              <button type="button" onClick={() => router.push('/evidencias')}
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
