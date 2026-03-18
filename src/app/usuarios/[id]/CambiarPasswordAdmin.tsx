'use client'
import { useState } from 'react'

export default function CambiarPasswordAdmin({ userId }: { userId: string }) {
  const [form, setForm] = useState({ nueva: '', confirmar: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if (form.nueva.length < 6) {
      setMsg({ type: 'error', text: 'Mínimo 6 caracteres.' })
      return
    }
    if (form.nueva !== form.confirmar) {
      setMsg({ type: 'error', text: 'Las contraseñas no coinciden.' })
      return
    }

    setLoading(true)
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password: form.nueva }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setMsg({ type: 'error', text: data.error ?? 'Error al cambiar contraseña.' })
    } else {
      setMsg({ type: 'ok', text: '✅ Contraseña actualizada en Supabase.' })
      setForm({ nueva: '', confirmar: '' })
      setTimeout(() => setMsg(null), 5000)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <input
          type={showPw ? 'text' : 'password'}
          value={form.nueva}
          onChange={e => setForm({ ...form, nueva: e.target.value })}
          placeholder="Nueva contraseña"
          className={inputClass + ' pr-16'}
        />
        <button type="button" onClick={() => setShowPw(v => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
          {showPw ? '🙈' : '👁'}
        </button>
      </div>

      <div>
        <input
          type={showPw ? 'text' : 'password'}
          value={form.confirmar}
          onChange={e => setForm({ ...form, confirmar: e.target.value })}
          placeholder="Confirmar contraseña"
          className={inputClass}
        />
        {form.confirmar.length > 0 && (
          <p className={`text-xs mt-1 ${form.nueva === form.confirmar ? 'text-green-600' : 'text-red-500'}`}>
            {form.nueva === form.confirmar ? '✓ Coinciden' : '✗ No coinciden'}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || form.nueva.length < 6 || form.nueva !== form.confirmar}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-40">
        {loading ? 'Actualizando...' : '🔒 Cambiar contraseña'}
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
