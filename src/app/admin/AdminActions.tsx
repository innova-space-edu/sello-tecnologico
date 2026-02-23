'use client'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'

export default function AdminActions({ userId, userEmail }: { userId: string, userEmail: string }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleResetPassword = async () => {
    if (!confirm(`¿Enviar correo de restablecimiento de contraseña a ${userEmail}?`)) return
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    setLoading(false)
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleResetPassword}
        disabled={loading}
        title="Restablecer contraseña"
        className="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
      >
        {sent ? '✅' : loading ? '...' : '🔑'}
      </button>
    </div>
  )
}
