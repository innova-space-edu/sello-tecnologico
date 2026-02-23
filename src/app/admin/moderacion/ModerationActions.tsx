'use client'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ModerationActions({ flagId, senderId }: { flagId: string, senderId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const marcarRevisado = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('flagged_messages')
      .update({ reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId)
    setLoading(false)
    router.refresh()
  }

  const enviarAdvertenciaYDesbloquear = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Enviar mensaje de advertencia
    await supabase.from('messages').insert({
      sender_id: user?.id,
      receiver_id: senderId,
      content: '⚠️ AVISO IMPORTANTE: Se detectó contenido inapropiado en tus mensajes. Tu cuenta fue bloqueada temporalmente. Ha sido desbloqueada, pero cualquier reincidencia tendrá consecuencias más graves.',
    })

    // Desbloquear usuario
    await supabase.from('profiles')
      .update({ blocked: false, blocked_reason: null, blocked_at: null })
      .eq('id', senderId)

    // Marcar como revisado
    await supabase.from('flagged_messages')
      .update({ reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId)

    setLoading(false)
    router.refresh()
  }

  const desbloquearSinAdvertencia = async () => {
    if (!confirm('¿Desbloquear sin enviar advertencia?')) return
    setLoading(true)

    await supabase.from('profiles')
      .update({ blocked: false, blocked_reason: null, blocked_at: null })
      .eq('id', senderId)

    await supabase.from('flagged_messages')
      .update({ reviewed: true })
      .eq('id', flagId)

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 shrink-0 min-w-40">
      <button onClick={enviarAdvertenciaYDesbloquear} disabled={loading}
        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
        ⚠️ Advertir y desbloquear
      </button>
      <button onClick={desbloquearSinAdvertencia} disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
        ✅ Desbloquear (falsa alarma)
      </button>
      <button onClick={marcarRevisado} disabled={loading}
        className="bg-gray-400 hover:bg-gray-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
        👁️ Solo revisar
      </button>
    </div>
  )
}
