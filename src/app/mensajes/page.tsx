'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const PALABRAS_BLOQUEADAS = [
  'te amo','te quiero','eres mi vida','mi amor','mi corazon','mi corazón',
  'estoy enamorado','estoy enamorada','me gustas','quiero estar contigo',
  'eres hermosa','eres hermoso','eres linda','eres lindo','mi cielo',
  'mi reina','mi rey','mi princesa','mi principe','bésame','besame',
  'un beso','te extraño','te extrano','pienso en ti','sueño contigo',
  'sueno contigo','sal conmigo','me enamoré','me enamore',
  'declaracion','te declaro','eres especial para mi','me tienes loco','me tienes loca',
  'idiota','imbecil','estupido','estupida','retrasado','retrasada',
  'inutil','basura','te voy a pegar','te voy a matar','suicidio',
  'sexo','porno','desnudo','desnuda','puta','prostituta',
]

function detectarPalabrasBloqueadas(texto: string): string[] {
  const lower = texto.toLowerCase()
  return PALABRAS_BLOQUEADAS.filter(p => lower.includes(p))
}

export default function MensajesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [warning, setWarning] = useState('')
  const [bloqueado, setBloqueado] = useState(false)
  const [parBloqueado, setParBloqueado] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (perfil?.blocked && perfil?.role !== 'admin') {
        router.push('/bloqueado')
        return
      }

      setCurrentUser(perfil)

      const { data: users } = await supabase
        .from('profiles').select('*').neq('id', user.id).order('full_name')
      setUsuarios(users ?? [])

      const { data: unreadMsgs } = await supabase
        .from('messages').select('sender_id')
        .eq('receiver_id', user.id).eq('read', false)
      const counts: Record<string, number> = {}
      unreadMsgs?.forEach(m => { counts[m.sender_id] = (counts[m.sender_id] ?? 0) + 1 })
      setUnread(counts)

      await supabase.from('profiles')
        .update({ last_seen: new Date().toISOString() }).eq('id', user.id)

      // Presencia en tiempo real
      const presenceChannel = supabase.channel('online-users')
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState()
          const ids = new Set(Object.values(state).flat().map((p: any) => p.user_id))
          setOnlineUsers(ids)
        })
        .on('presence', { event: 'join' }, ({ newPresences }: any) => {
          setOnlineUsers(prev => {
            const next = new Set(prev)
            newPresences.forEach((p: any) => next.add(p.user_id))
            return next
          })
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
          setOnlineUsers(prev => {
            const next = new Set(prev)
            leftPresences.forEach((p: any) => next.delete(p.user_id))
            return next
          })
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ user_id: user.id })
          }
        })

      // Listener bloqueo en tiempo real
      const blockChannel = supabase
        .channel('block-listener-' + user.id)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        }, (payload) => {
          if (payload.new.blocked === true) {
            setBloqueado(true)
            setTimeout(() => { router.push('/bloqueado') }, 3000)
          }
        })
        .subscribe()

      const interval = setInterval(async () => {
        await supabase.from('profiles')
          .update({ last_seen: new Date().toISOString() }).eq('id', user.id)
      }, 30000)

      return () => {
        clearInterval(interval)
        supabase.removeChannel(presenceChannel)
        supabase.removeChannel(blockChannel)
      }
    }
    init()
  }, [])

  // Verificar si el par está bloqueado al seleccionar usuario
  useEffect(() => {
    if (!selectedUser || !currentUser) return
    setParBloqueado(false)
    setWarning('')

    const checkPar = async () => {
      const uidA = [currentUser.id, selectedUser.id].sort()[0]
      const uidB = [currentUser.id, selectedUser.id].sort()[1]
      const { data } = await supabase
        .from('blocked_pairs')
        .select('id')
        .eq('user_a', uidA)
        .eq('user_b', uidB)
        .maybeSingle()
      if (data) setParBloqueado(true)
    }
    checkPar()
    fetchMessages()

    const channel = supabase
      .channel('messages-' + selectedUser.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchMessages()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedUser])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchMessages = async () => {
    if (!selectedUser || !currentUser) return
    const { data } = await supabase
      .from('messages').select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    await supabase.from('messages').update({ read: true })
      .eq('sender_id', selectedUser.id)
      .eq('receiver_id', currentUser.id)
      .eq('read', false)
    setUnread(prev => ({ ...prev, [selectedUser.id]: 0 }))
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !selectedUser || !currentUser) return

    // Verificar bloqueo personal
    const { data: perfil } = await supabase
      .from('profiles').select('blocked').eq('id', currentUser.id).single()
    if (perfil?.blocked) {
      router.push('/bloqueado')
      return
    }

    // Verificar bloqueo entre el par
    const uidA = [currentUser.id, selectedUser.id].sort()[0]
    const uidB = [currentUser.id, selectedUser.id].sort()[1]
    const { data: par } = await supabase
      .from('blocked_pairs')
      .select('id')
      .eq('user_a', uidA)
      .eq('user_b', uidB)
      .maybeSingle()

    if (par) {
      setParBloqueado(true)
      setWarning('Esta conversación fue bloqueada por el administrador. No puedes enviar mensajes a este usuario.')
      return
    }

    // Detectar palabras bloqueadas
    const palabrasEncontradas = detectarPalabrasBloqueadas(input)
    if (palabrasEncontradas.length > 0) {
      setWarning(`Tu mensaje infringe el Reglamento Escolar. Contiene contenido inapropiado ("${palabrasEncontradas[0]}"). Tu cuenta será bloqueada inmediatamente.`)
    }

    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content: input.trim(),
    })
    setInput('')
    fetchMessages()
  }

  const roleColor: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    coordinador: 'bg-blue-100 text-blue-700',
    docente: 'bg-green-100 text-green-700',
    estudiante: 'bg-sky-100 text-sky-700',
  }

  const isOnline = (userId: string) => onlineUsers.has(userId)

  // Pantalla de bloqueo en tiempo real
  if (bloqueado) {
    return (
      <div className="fixed inset-0 bg-red-900 bg-opacity-95 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center mx-4">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-red-700 mb-3">Cuenta bloqueada</h1>
          <p className="text-gray-600 mb-4">
            Tu mensaje infringió el Reglamento Escolar del Colegio Providencia.
            Tu cuenta ha sido bloqueada automáticamente y el administrador ha sido notificado.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-700 font-medium">
              🚨 El administrador revisará el caso y tomará las medidas correspondientes.
            </p>
          </div>
          <p className="text-xs text-gray-400">Redirigiendo en unos segundos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 flex pt-14 lg:pt-0" style={{ height: '100vh' }}>

        {/* Lista de usuarios */}
        <div className="w-full sm:w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-blue-900 text-lg">Mensajes</h2>
            <p className="text-gray-400 text-xs mt-0.5">Conversaciones directas</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {usuarios.map(u => (
              <button key={u.id} onClick={() => setSelectedUser(u)}
                className={`w-full px-5 py-3.5 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 ${
                  selectedUser?.id === u.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}>
                <div className="relative shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                    {(u.full_name ?? u.email)?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    isOnline(u.id) ? 'bg-green-500' : 'bg-red-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-gray-800 text-sm truncate">{u.full_name ?? u.email}</p>
                    {(unread[u.id] ?? 0) > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 ml-1">
                        {unread[u.id]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${roleColor[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
                      {u.role}
                    </span>
                    <span className={`text-xs ${isOnline(u.id) ? 'text-green-500' : 'text-gray-400'}`}>
                      {isOnline(u.id) ? '● En línea' : '● Desconectado'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Área de conversación */}
        {selectedUser ? (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Header conversación */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center gap-3 shrink-0">
              <div className="relative">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                  {(selectedUser.full_name ?? selectedUser.email)?.[0]?.toUpperCase()}
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  isOnline(selectedUser.id) ? 'bg-green-500' : 'bg-red-400'
                }`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{selectedUser.full_name ?? selectedUser.email}</p>
                <p className={`text-xs font-medium ${isOnline(selectedUser.id) ? 'text-green-500' : 'text-red-400'}`}>
                  {isOnline(selectedUser.id) ? '● En línea ahora' : '● Desconectado'}
                </p>
              </div>
              {parBloqueado && (
                <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-medium">
                  🚫 Conversación bloqueada
                </span>
              )}
            </div>

            {/* Banner conversación bloqueada entre el par */}
            {parBloqueado && (
              <div className="mx-4 mt-4 bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3 shrink-0">
                <span className="text-2xl shrink-0">🚫</span>
                <div>
                  <p className="text-sm font-bold text-red-700">Conversación bloqueada por el administrador</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    No puedes enviar ni recibir mensajes de este usuario. Contacta al administrador para más información.
                  </p>
                </div>
              </div>
            )}

            {/* Aviso de mensaje bloqueado */}
            {warning && !parBloqueado && (
              <div className="mx-4 mt-4 bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3 shrink-0">
                <span className="text-2xl shrink-0">🚨</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-700 mb-1">
                    Mensaje bloqueado — Reglamento Escolar infringido
                  </p>
                  <p className="text-xs text-red-600">{warning}</p>
                </div>
                <button onClick={() => setWarning('')} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
              </div>
            )}

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-gray-50">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-10">
                  <div className="text-4xl mb-2">💬</div>
                  <p>Inicia la conversación con {selectedUser.full_name ?? selectedUser.email}</p>
                </div>
              )}
              {messages.map(m => {
                const isMe = m.sender_id === currentUser?.id
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs mr-2 shrink-0 mt-1">
                        {(selectedUser.full_name ?? selectedUser.email)?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                    }`}>
                      <p>{m.content}</p>
                      <p className={`text-xs mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        {isMe && <span className="ml-1">{m.read ? '✓✓' : '✓'}</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="bg-white px-6 py-4 border-t border-gray-200 shrink-0">
              {parBloqueado ? (
                <div className="flex items-center justify-center py-2 gap-2 text-red-400">
                  <span>🚫</span>
                  <span className="text-sm font-medium">No puedes enviar mensajes a este usuario</span>
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex gap-3">
                  <input value={input} onChange={e => { setInput(e.target.value); setWarning('') }}
                    placeholder={`Mensaje para ${selectedUser.full_name ?? selectedUser.email}...`}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50" />
                  <button type="submit" disabled={!input.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                    Enviar
                  </button>
                </form>
              )}
              <p className="text-xs text-gray-400 mt-2 text-center">
                Los mensajes son monitoreados para garantizar un entorno escolar seguro
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <div className="text-6xl mb-4">💬</div>
              <p className="font-medium text-gray-500">Selecciona un usuario para chatear</p>
              <p className="text-sm mt-1">Mensajes directos entre docentes, estudiantes y coordinadores</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
