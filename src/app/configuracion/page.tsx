'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    school_name: 'Colegio Providencia',
    repo_name: 'Sello Tecnológico',
    year_active: '2026',
    logo_url: ''
  })

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single()
      .then(({ data }) => {
        if (data) setForm({
          school_name: data.school_name ?? '',
          repo_name: data.repo_name ?? '',
          year_active: String(data.year_active ?? 2026),
          logo_url: data.logo_url ?? ''
        })
      })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await supabase.from('settings').update({
      school_name: form.school_name,
      repo_name: form.repo_name,
      year_active: parseInt(form.year_active),
      logo_url: form.logo_url
    }).eq('id', 1)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Configuración</h1>
          <p className="text-gray-500 mt-1">Personaliza la plataforma del Sello Tecnológico</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 max-w-lg">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del colegio</label>
              <input value={form.school_name} onChange={e => setForm({...form, school_name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del repositorio</label>
              <input value={form.repo_name} onChange={e => setForm({...form, repo_name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año activo</label>
              <input value={form.year_active} onChange={e => setForm({...form, year_active: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL del logo institucional</label>
              <input value={form.logo_url} onChange={e => setForm({...form, logo_url: e.target.value})}
                placeholder="https://tu-colegio.cl/logo.png"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              {form.logo_url && (
                <img src={form.logo_url} alt="Logo preview" className="mt-2 h-12 object-contain rounded" />
              )}
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar configuración'}
            </button>
            {saved && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 text-center">
                ✅ Configuración guardada correctamente
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  )
}
