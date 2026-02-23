'use client'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AgregarMiembroForm({
  cursoId,
  estudiantes,
}: {
  cursoId: string
  estudiantes: { id: string; full_name: string; email: string; rut?: string }[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAgregar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    setLoading(true)
    setError('')

    const { error } = await supabase.from('course_members').insert({
      course_id: cursoId,
      user_id: selectedId,
    })

    if (error) {
      setError('Error al agregar estudiante')
    } else {
      setSelectedId('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleAgregar} className="space-y-3">
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
        <option value="">Seleccionar estudiante...</option>
        {estudiantes.map(e => (
          <option key={e.id} value={e.id}>
            {e.full_name ?? e.email}{e.rut ? ` · ${e.rut}` : ''}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button type="submit" disabled={!selectedId || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
        {loading ? 'Agregando...' : '+ Agregar al curso'}
      </button>
    </form>
  )
}
