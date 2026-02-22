'use client'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ComentariosSection({ proyectoId, comentarios, userId }: {
  proyectoId: string, comentarios: any[], userId: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) return
    setLoading(true)
    await supabase.from('comments').insert({
      project_id: proyectoId,
      user_id: userId,
      text: texto.trim()
    })
    setTexto('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-blue-900">Comentarios ({comentarios.length})</h2>
      </div>

      {comentarios.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {comentarios.map(c => (
            <div key={c.id} className="px-6 py-4">
              <div className="flex justify-between items-start">
                <p className="font-medium text-sm text-blue-800">
                  {c.profiles?.full_name ?? 'Usuario'}
                  <span className="ml-2 text-xs text-gray-400 font-normal">{c.profiles?.role}</span>
                </p>
                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('es-CL')}</span>
              </div>
              <p className="text-gray-600 text-sm mt-1">{c.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-6 py-6 text-center text-gray-400 text-sm">Sin comentarios aún</div>
      )}

      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <form onSubmit={handleEnviar} className="flex gap-3">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escribe un comentario..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button type="submit" disabled={loading || !texto.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
            {loading ? '...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  )
}
