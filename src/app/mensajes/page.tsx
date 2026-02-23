'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useEffect, useState, useRef } from 'react'

export default function MensajesPage() {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setCurrentUser(perfil)

      const { data: users } = await supabase.from('profiles').select('*').neq('id', user.id).order('full_name')
      setUsuarios(users ?? [])

      // Contar no leídos por usuario
      const { data: unreadMsgs } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', user.id)
        .eq('read', false)

      const counts: Record<string, number> = {}
      unreadMsgs?.forEach(m => { counts[m.sender_id] = (counts[m.sender_id] ?? 0) + 1 })
      setUnread(counts)
    }
    init()
  }, [])

  useEffect(() => {
    if (!selectedUser || !currentUser) return
    fetchMessages()

    const channel = supabase
      .channel('messages')
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
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, email)')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true })

    setMessages(data ?? [])

    // Marcar como leídos
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', selectedUser.id)
      .eq('receiver_id', currentUser.id)
      .eq('read', false)

    setUnread(prev => ({ ...prev, [selectedUser.id]: 0 }))
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !selectedUser || !currentUser) return
    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content: input.trim(),
    })
    setInput('')
  }

  const roleColor: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    coordinador: 'bg-blue-100 text-blue-700',
    docente: 'bg-green-100 text-green-700',
    estudiante: 'bg-sky-100 text-sky-700',
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
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                  {(u.full_name ?? u.email)?.[0]?.toUpperCase() ?? '?'}
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
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${roleColor[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
                    {u.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Área de conversación */}
        {selectedUser ? (
          <div className="flex-1 flex flex-col">
            {/* Header conversación */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                {(selectedUser.full_name ?? selectedUser.email)?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{selectedUser.full_name ?? selectedUser.email}</p>
                <p className="text-xs text-gray-400">{selectedUser.email} · {selectedUser.role}</p>
              </div>
            </div>

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
            <div className="bg-white px-6 py-4 border-t border-gray-200">
              <form onSubmit={handleSend} className="flex gap-3">
                <input value={input} onChange={e => setInput(e.target.value)}
                  placeholder={`Mensaje para ${selectedUser.full_name ?? selectedUser.email}...`}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50" />
                <button type="submit" disabled={!input.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                  Enviar
                </button>
              </form>
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
