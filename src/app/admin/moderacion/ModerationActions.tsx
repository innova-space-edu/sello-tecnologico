'use client'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ModerationActions({
  flagId, senderId, receiverId
}: {
  flagId: string
  senderId: string
  receiverId: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const desbloquearConAdvertencia = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Enviar advertencia a ambos
    await supabase.from('messages').insert([
      {
        sender_id: user?.id,
        receiver_id: senderId,
        content: '⚠️ ADVERTENCIA: Tu cuenta fue bloqueada por infringir el Reglamento Escolar. Ha sido desbloqueada, pero cualquier reincidencia tendrá consecuencias disciplinarias graves.',
      },
      {
        sender_id: user?.id,
        receiver_id: receiverId,
        content: '⚠️ ADVERTENCIA: Tu cuenta fue bloqueada por participar en una conversación inapropiada. Ha sido desbloqueada. Se espera conducta respetuosa en todo momento.',
      }
    ])

    // Desbloquear ambos
    await supabase.from('profiles')
      .update({ blocked: false, blocked_reason: null, blocked_at: null })
      .in('id', [senderId, receiverId])

    // Marcar revisado
    await supabase.from('flagged_messages')
      .update({ reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId)

    setLoading(false)
    router.refresh()
  }

  const desbloquearFalsaAlarma = async () => {
    if (!confirm('¿Confirmas que es falsa alarma? Se desbloquearán ambos usuarios y podrán volver a chatear entre sí.')) return
    setLoading(true)

    // Desbloquear ambos
    await supabase.from('profiles')
      .update({ blocked: false, blocked_reason: null, blocked_at: null })
      .in('id', [senderId, receiverId])

    // Eliminar bloqueo entre el par
    await supabase.from('blocked_pairs')
      .delete()
      .or(`and(user_a.eq.${[senderId,receiverId].sort()[0]},user_b.eq.${[senderId,receiverId].sort()[1]})`)

    // Marcar revisado
    await supabase.from('flagged_messages')
      .update({ reviewed: true })
      .eq('id', flagId)

    setLoading(false)
    router.refresh()
  }

  const eliminarChatYDesbloquear = async () => {
    if (!confirm('¿Eliminar TODOS los mensajes entre estos dos usuarios y desbloquearlos? Esta acción no se puede deshacer.')) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Eliminar todos los mensajes entre ellos
    await supabase.from('messages')
      .delete()
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)

    // Desbloquear ambos
    await supabase.from('profiles')
      .update({ blocked: false, blocked_reason: null, blocked_at: null })
      .in('id', [senderId, receiverId])

    // Marcar revisado
    await supabase.from('flagged_messages')
      .update({ reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId)

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 shrink-0 min-w-44">
      <button onClick={desbloquearConAdvertencia} disabled={loading}
        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
        ⚠️ Advertir y desbloquear
      </button>
      <button onClick={eliminarChatYDesbloquear} disabled={loading}
        className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
        🗑️ Eliminar chat y desbloquear
      </button>
      <button onClick={desbloquearFalsaAlarma} disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
        ✅ Falsa alarma
      </button>
    </div>
  )
}
