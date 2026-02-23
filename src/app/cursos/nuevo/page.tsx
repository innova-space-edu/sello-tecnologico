'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NuevoCursoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', level: '', area: '', year: '2026' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('courses').insert({
      ...form,
      year: parseInt(form.year),
      created_by: user?.id
    })
    router.push('/cursos')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Nuevo Curso</h1>
          <p className="text-gray-500 mt-1">Completa los datos del curso</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del curso *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Ej: 2° Medio B – Tecnología"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
              <input
                value={form.level}
                onChange={e => setForm({...form, level: e.target.value})}
                placeholder="Ej: 2° Medio"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
              <input
                value={form.area}
                onChange={e => setForm({...form, area: e.target.value})}
                placeholder="Ej: Ciencias, Tecnología"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input
                value={form.year}
                onChange={e => setForm({...form, year: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Crear curso'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/cursos')}
                className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
