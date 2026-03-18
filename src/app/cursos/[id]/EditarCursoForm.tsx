'use client'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EditarCursoForm({
  cursoId, name, level, area, year,
}: {
  cursoId: string; name: string; level: string; area: string; year: number
}) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name, level, area, year: String(year) })

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await supabase.from('courses').update({
      name: form.name,
      level: form.level,
      area: form.area,
      year: parseInt(form.year),
    }).eq('id', cursoId)
    setLoading(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); setOpen(false); router.refresh() }, 1500)
  }

  const handleEliminar = async () => {
    if (!confirm(`¿Eliminar el curso "${name}"? Se eliminarán también sus miembros y proyectos asociados.`)) return
    await supabase.from('course_members').delete().eq('course_id', cursoId)
    await supabase.from('courses').delete().eq('id', cursoId)
    router.push('/cursos')
  }

  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-700 px-3 py-1.5 rounded-lg transition-colors">
        ✏️ Editar curso
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-blue-900">✏️ Editar curso</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del curso</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  required className={inputClass} placeholder="Ej: 1° Medio A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
                  <input value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                    className={inputClass} placeholder="Ej: 1° Medio" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                  <input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}
                    type="number" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                <input value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}
                  className={inputClass} placeholder="Ej: Tecnología" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleEliminar}
                  className="flex-1 border border-red-200 text-red-600 text-sm font-medium py-2.5 rounded-xl hover:bg-red-50 transition-colors">
                  🗑️ Eliminar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50">
                  {loading ? 'Guardando...' : saved ? '✅ Guardado' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
