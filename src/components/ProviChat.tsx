'use client'
import { createClient } from '@/lib/supabase'
import { useEffect, useState, useRef } from 'react'

export default function ProviChat() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [esDocente, setEsDocente] = useState(false)
  const [unread, setUnread] = useState(0)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [sendError, setSendError] = useState('')
  const openRef = useRef(false)
  const lastSeenRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: perfil } = await supabase
        .from('profiles').select('id, full_name, email, role, blocked').eq('id', user.id).single()
      if (cancelled) return

      // El chat de docentes solo admite docentes y administración.
      // Los estudiantes escriben exclusivamente desde /mensajes.
      const autorizado = (perfil?.role === 'docente' || perfil?.role === 'admin') &&
        perfil?.blocked !== true
      if (!autorizado) return

      setEsDocente(true)
      setCurrentUser(perfil)
      const saved = localStorage.getItem(`crealab-teacher-chat-seen-${user.id}`)
      lastSeenRef.current = saved
      setLastSeen(saved)

      await fetchMessages()
      if (cancelled) return

      // Un evento solo dispara una recarga autorizada; nunca se añade
      // directamente un mensaje sin verificar el rol de quien lo escribió.
      channel = supabase
        .channel('crealab-teacher-chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, () => {
          void fetchMessages()
        })
        .subscribe()
    }
    void init().finally(() => { if (!cancelled) setReady(true) })
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    openRef.current = open
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setUnread(0)
      const now = new Date().toISOString()
      lastSeenRef.current = now
      setLastSeen(now)
      if (currentUser?.id) localStorage.setItem(`crealab-teacher-chat-seen-${currentUser.id}`, now)
    }
  }, [open, messages, currentUser?.id])

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('group_messages')
      .select('id, sender_id, content, created_at, profiles!inner(full_name, email, role)')
      .in('profiles.role', ['docente', 'admin'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.warn('[CreaLab] No se pudo consultar el chat docente', error.code)
      setSendError('No fue posible cargar el chat docente.')
      return
    }
    // La base histórica conserva mensajes antiguos de estudiantes para auditoría,
    // pero jamás se muestran en el chat exclusivo de docentes.
    const authorizedMessages = (data ?? []).reverse()
    setMessages(authorizedMessages)
    setSendError('')
    if (!openRef.current) {
      const since = lastSeenRef.current
      setUnread(since ? authorizedMessages.filter(m => m.created_at > since).length : 0)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !currentUser || !['docente', 'admin'].includes(currentUser.role)) return
    const content = input.trim()
    if (content.length > 4000) {
      setSendError('El mensaje supera los 4000 caracteres permitidos.')
      return
    }
    const { error } = await supabase.from('group_messages').insert({
      sender_id: currentUser.id,
      content,
    })
    if (error) {
      setSendError('No se pudo enviar el mensaje. Comprueba tus permisos e inténtalo otra vez.')
      return
    }
    setInput('')
    void fetchMessages()
  }

  if (!ready || !esDocente) return null

  return (
    <>
      {/* Burbuja flotante verde */}
      <div className="fixed bottom-6 right-24 sm:right-28 z-[60]">
        <button
          onClick={() => setOpen(!open)}
          className="relative bg-green-500 hover:bg-green-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-all hover:scale-110"
          title="Chat Docentes — Provi">
          {open ? (
            <span className="text-xl">✕</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
          )}
          {/* Badge no leídos */}
          {!open && unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        {/* Label */}
        {!open && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-semibold shadow">
            Provi
          </div>
        )}
      </div>

      {/* Ventana del chat */}
      {open && (
        <div className="fixed bottom-24 right-6 sm:right-24 z-[60] w-[min(24rem,calc(100vw-1.5rem))] bg-white rounded-2xl shadow-2xl border border-green-200 flex flex-col overflow-hidden"
          style={{ height: '480px' }}>

          {/* Header */}
          <div className="bg-green-500 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Provi</p>
              <p className="text-green-100 text-xs">Chat de docentes y administración</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="text-white opacity-70 hover:opacity-100 text-lg">✕</button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-8">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-sm">Sé el primero en escribir</p>
              </div>
            )}
            {messages.map((m, i) => {
              const isMe = m.sender_id === currentUser?.id
              const showName = !isMe && (i === 0 || messages[i - 1]?.sender_id !== m.sender_id)
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showName && (
                    <p className="text-xs text-gray-400 mb-1 px-1">
                      {m.profiles?.full_name ?? m.profiles?.email ?? '—'}
                    </p>
                  )}
                  <div className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-green-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                  }`}>
                    <p>{m.content}</p>
                    <p className={`text-xs mt-0.5 ${isMe ? 'text-green-100' : 'text-gray-400'}`}>
                      {new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100">
            {sendError && <p role="alert" className="mb-2 text-xs text-red-700">{sendError}</p>}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Mensaje para docentes..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50" />
              <button type="submit" disabled={!input.trim()}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                ➤
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
