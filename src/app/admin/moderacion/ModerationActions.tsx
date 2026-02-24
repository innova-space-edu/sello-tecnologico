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
  const [resultado, setResultado] = useState('')

  const desbloquearUsuario = async (uid: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ blocked: false, blocked_reason: null, blocked_at: null })
      .eq('id', uid)
    return error
  }

  const desbloquearAmbos = async () => {
    if (!confirm('¿Desbloquear ambos usuarios? Podrán usar la plataforma pero NO podrán hablarse entre sí.')) return
    setLoading(true)
    setResultado('')
    const { data: { user } } = await supabase.auth.getUser()

    // Dos queries separadas — garantizado
    const err1 = await desbloquearUsuario(senderId)
    const err2 = await desbloquearUsuario(receiverId)

    if (err1 || err2) {
      setResultado(`⚠️ Error: ${err1?.message ?? err2?.message}`)
      setLoading(false)
      return
    }

    // Advertencia a cada uno por separado
    await supabase.from('messages').insert({
      sender_id: user?.id,
      receiver_id: senderId,
      content: '⚠️ AVISO: Tu cuenta ha sido desbloqueada. Tu acceso a la plataforma ha sido restituido. Sin embargo, tienes prohibido comunicarte con el otro participante de la conversación infractora. Cualquier reincidencia tendrá consecuencias disciplinarias graves.',
    })

    await supabase.from('messages').insert({
      sender_id: user?.id,
      receiver_id: receiverId,
      content: '⚠️ AVISO: Tu cuenta ha sido desbloqueada. Tu acceso a la plataforma ha sido restituido. Sin embargo, tienes prohibido comunicarte con el otro participante de la conversación infractora. Cualquier reincidencia tendrá consecuencias disciplinarias graves.',
    })

    await supabase.from('flagged_messages')
      .update({ reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId)

    setResultado('✅ Ambos desbloqueados correctamente')
    setLoading(false)
    setTimeout(() => router.refresh(), 1000)
  }

  const eliminarChatYDesbloquear = async () => {
    if (!confirm('¿Eliminar TODOS los mensajes y desbloquear? El bloqueo entre ellos permanecerá.')) return
    setLoading(true)
    setResultado('')
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('messages')
      .delete()
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)

    const err1 = await desbloquearUsuario(senderId)
    const err2 = await desbloquearUsuario(receiverId)

    if (err1 || err2) {
      setResultado(`⚠️ Error al desbloquear: ${err1?.message ?? err2?.message}`)
      setLoading(false)
      return
    }

    await supabase.from('messages').insert({
      sender_id: user?.id,
      receiver_id: senderId,
      content: '🗑️ AVISO: El historial de tu conversación ha sido eliminado. Tu cuenta ha sido desbloqueada, pero no podrás comunicarte con el otro participante.',
    })

    await supabase.from('messages').insert({
      sender_id: user?.id,
      receiver_id: receiverId,
      content: '🗑️ AVISO: El historial de tu conversación ha sido eliminado. Tu cuenta ha sido desbloqueada, pero no podrás comunicarte con el otro participante.',
    })

    await supabase.from('flagged_messages')
      .update({ reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId)

    setResultado('✅ Chat eliminado y ambos desbloqueados')
    setLoading(false)
    setTimeout(() => router.refresh(), 1000)
  }

  const falsaAlarma = async () => {
    if (!confirm('¿Confirmas falsa alarma? Se desbloquea todo y podrán volver a hablarse.')) return
    setLoading(true)
    setResultado('')

    const err1 = await desbloquearUsuario(senderId)
    const err2 = await desbloquearUsuario(receiverId)

    if (err1 || err2) {
      setResultado(`⚠️ Error: ${err1?.message ?? err2?.message}`)
      setLoading(false)
      return
    }

    // Eliminar bloqueo del par
    const uidA = [senderId, receiverId].sort()[0]
    const uidB = [senderId, receiverId].sort()[1]
    await supabase.from('blocked_pairs')
      .delete()
      .eq('user_a', uidA)
      .eq('user_b', uidB)

    await supabase.from('flagged_messages')
      .update({ reviewed: true })
      .eq('id', flagId)

    setResultado('✅ Falsa alarma — ambos desbloqueados completamente')
    setLoading(false)
    setTimeout(() => router.refresh(), 1000)
  }

  return (
    <div className="flex flex-col gap-2 shrink-0 min-w-48">

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
        <p className="text-xs text-gray-400 text-center animate-pulse">Procesando...</p>
      )}

      {resultado && (
        <p className={`text-xs text-center font-medium px-2 py-1.5 rounded-lg ${
          resultado.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {resultado}
        </p>
      )}
    </div>
  )
}
