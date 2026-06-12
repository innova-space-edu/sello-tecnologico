'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const roles = [
  { value: 'estudiante', label: '🎓 Estudiante' },
  { value: 'docente', label: '👨‍🏫 Docente' },
  { value: 'coordinador', label: '🎯 Coordinador' },
  { value: 'utp', label: '📘 UTP' },
  { value: 'admin', label: '👑 Administrador' },
]

const cursos = [
  '1° Básico A', '1° Básico B', '2° Básico A', '2° Básico B',
  '3° Básico A', '3° Básico B', '4° Básico A', '4° Básico B',
  '5° Básico A', '5° Básico B', '6° Básico A', '6° Básico B',
  '7° Básico A', '7° Básico B', '8° Básico A', '8° Básico B',
  '1° Medio A', '1° Medio B', '2° Medio A', '2° Medio B',
  '3° Medio A', '3° Medio B', '4° Medio A', '4° Medio B',
]

type EditableProfile = {
  id: string
  full_name: string | null
  email: string
  rut: string | null
  curso: string | null
  role: string
}

export default function EditarPerfilAdmin({ usuario }: { usuario: EditableProfile }) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: usuario.full_name ?? '',
    email: usuario.email ?? '',
    rut: usuario.rut ?? '',
    curso: usuario.curso ?? '',
    role: usuario.role ?? 'estudiante',
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMsg(null)

    try {
      const response = await fetch('/api/admin/update-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: usuario.id, ...form }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setMsg({ type: 'error', text: data.error ?? 'No se pudo actualizar el usuario.' })
        return
      }

      setMsg({ type: 'ok', text: '✅ Perfil y acceso actualizados correctamente.' })
      router.refresh()
    } catch {
      setMsg({ type: 'error', text: 'No se pudo conectar con el servidor.' })
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
        <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
          placeholder="Nombre y apellidos" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico *</label>
        <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="correo@ejemplo.cl" className={inputClass} />
        <p className="text-[11px] text-gray-400 mt-1">También se actualiza el correo de inicio de sesión.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">RUT</label>
        <input value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })}
          placeholder="12.345.678-9" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Rol *</label>
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputClass}>
          {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
        </select>
      </div>
      {form.role === 'estudiante' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Curso *</label>
          <input required list="cursos-sello-tecnologico" value={form.curso}
            onChange={e => setForm({ ...form, curso: e.target.value })}
            placeholder="Ej: 2° Medio B" className={inputClass} />
          <datalist id="cursos-sello-tecnologico">
            {cursos.map(curso => <option key={curso} value={curso} />)}
          </datalist>
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
        {loading ? 'Guardando...' : '💾 Guardar datos del usuario'}
      </button>

      {msg && (
        <div className={`text-xs rounded-lg px-3 py-2 text-center border ${msg.type === 'ok'
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}
    </form>
  )
}
