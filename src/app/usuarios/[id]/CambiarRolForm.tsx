'use client'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const roles = [
  { value: 'estudiante', label: '🎓 Estudiante' },
  { value: 'docente', label: '👨‍🏫 Docente' },
  { value: 'coordinador', label: '🎯 Coordinador' },
  { value: 'admin', label: '👑 Administrador' },
]

export default function CambiarRolForm({ userId, currentRole }: { userId: string, currentRole: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [role, setRole] = useState(currentRole)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <select value={role} onChange={e => setRole(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
        {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <button onClick={handleSave} disabled={loading || role === currentRole}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
        {loading ? 'Guardando...' : 'Guardar rol'}
      </button>
      {saved && <p className="text-green-600 text-xs text-center">✅ Rol actualizado</p>}
    </div>
  )
}
