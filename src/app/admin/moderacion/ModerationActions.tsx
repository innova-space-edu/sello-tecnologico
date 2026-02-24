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

  // Desbloquear AMBOS usuarios — el par sigue sin poder hablarse
  const desbloquearAmbos = async () => {
    if (!confirm('¿Desbloquear ambos usuarios? Podrán usar la plataforma normalmente pero NO podrán enviarse mensajes entre sí.')) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Desbloquear ambos al mismo tiempo
    await supabase.from('profiles')
      .update({ blocked: false, blocked_reason: null, blocked_at: null })
      .in('id', [senderId, receiverId])

    // Enviar advertencia a ambos
    await supabase.from('messages').insert([
      {
        sender_id: user?.id,
        receiver_id: senderId,
        content: '⚠️ AVISO: Tu cuenta ha sido desbloqueada por el administrador. Tu acceso a la plataforma ha sido restituido. Sin embargo, tienes prohibido comunicarte con el otro participante de la conversación infractora. Cualquier reincidencia tendrá consecuencias disciplinarias graves.',
      },
      {
        sender_id: user?.id,
        receiver_id: receiverId,
        content: '⚠️ AVISO: Tu cuenta ha sido desbloqueada por el administrador. Tu acceso a la plataforma ha sido restituido. Sin embargo, tienes prohibido comunicarte con el otro participante de la conversación infractora. Cualquier reincidencia tendrá consecuencias disciplinarias graves.',
      }
    ])

    // Marcar como revisado
    await supabase.from('flagged_messages')
      .update({ reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId)

    setLoading(false)
    router.refresh()
  }

  // Eliminar chat + desbloquear ambos — el par sigue sin poder hablarse
  const eliminarChatYDesbloquear = async () => {
    if (!confirm('¿Eliminar TODOS los mensajes entre estos usuarios y desbloquearlos? El bloqueo entre ellos permanecerá.')) return
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

    // Enviar aviso
    await supabase.from('messages').insert([
      {
        sender_id: user?.id,
        receiver_id: senderId,
        content: '🗑️ AVISO: El historial de tu conversación inapropiada ha sido eliminado por el administrador. Tu cuenta ha sido desbloqueada, pero no podrás comunicarte con el otro participante.',
      },
      {
        sender_id: user?.id,
        receiver_id: receiverId,
        content: '🗑️ AVISO: El historial de tu conversación inapropiada ha sido eliminado por el administrador. Tu cuenta ha sido desbloqueada, pero no podrás comunicarte con el otro participante.',
      }
    ])

    // Marcar como revisado
    await supabase.from('flagged_messages')
      .update({ reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId)

    setLoading(false)
    router.refresh()
  }

  // Falsa alarma — desbloquea TODO incluyendo el par (pueden volver a hablarse)
  const falsaAlarma = async () => {
    if (!confirm('¿Confirmas que es una falsa alarma? Se desbloquearán ambos usuarios y podrán volver a hablarse entre sí.')) return
    setLoading(true)

    // Desbloquear ambos
    await supabase.from('profiles')
      .update({ blocked: false, blocked_reason: null, blocked_at: null })
      .in('id', [senderId, receiverId])

    // Eliminar bloqueo del par para que puedan volver a hablar
    const uidA = [senderId, receiverId].sort()[0]
    const uidB = [senderId, receiverId].sort()[1]
    await supabase.from('blocked_pairs')
      .delete()
      .eq('user_a', uidA)
      .eq('user_b', uidB)

    // Marcar como revisado
    await supabase.from('flagged_messages')
      .update({ reviewed: true })
      .eq('id', flagId)

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 shrink-0 min-w-48">

      {/* Opción principal */}
      <button onClick={desbloquearAmbos} disabled={loading}
        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 text-left">
        🔓 Desbloquear ambos
        <span className="block text-orange-200 font-normal mt-0.5">No podrán hablarse entre sí</span>
      </button>

      <button onClick={eliminarChatYDesbloquear} disabled={loading}
        className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 text-left">
        🗑️ Eliminar chat y desbloquear
        <span className="block text-red-200 font-normal mt-0.5">Borra mensajes + desbloquea</span>
      </button>

      <button onClick={falsaAlarma} disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 text-left">
        ✅ Falsa alarma
        <span className="block text-green-200 font-normal mt-0.5">Desbloquea todo, pueden hablarse</span>
      </button>

      {loading && (
        <p className="text-xs text-gray-400 text-center">Procesando...</p>
      )}
    </div>
  )
}
