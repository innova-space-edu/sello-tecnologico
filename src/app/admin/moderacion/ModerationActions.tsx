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

  const enviarAdvertencia = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('messages').insert({
      sender_id: user?.id,
      receiver_id: senderId,
      content: '⚠️ AVISO IMPORTANTE: Se ha detectado contenido inapropiado en tus mensajes. Por favor, usa la plataforma de forma respetuosa. Cualquier reincidencia será reportada a las autoridades del colegio.',
    })

    await supabase.from('flagged_messages')
      .update({ reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId)

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <button onClick={enviarAdvertencia} disabled={loading}
        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
        ⚠️ Enviar advertencia
      </button>
      <button onClick={marcarRevisado} disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
        ✅ Marcar revisado
      </button>
    </div>
  )
}
