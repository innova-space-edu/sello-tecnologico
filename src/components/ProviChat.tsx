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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      // Solo docentes y admin con dominio @colprovidencia.cl
      const esProvi = user.email?.endsWith('@colprovidencia.cl') ?? false
      const rolValido = perfil?.role === 'docente' || perfil?.role === 'admin' || perfil?.role === 'coordinador'

      if (!esProvi || !rolValido) return

      setEsDocente(true)
      setCurrentUser(perfil)

      const saved = localStorage.getItem('provi-last-seen')
      setLastSeen(saved)

      await fetchMessages(saved)

      // Suscribir a mensajes nuevos
      const channel = supabase
        .channel('group-chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (payload) => {
          setMessages(prev => [...prev, payload.new])
          if (!open) {
            setUnread(prev => prev + 1)
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setUnread(0)
      const now = new Date().toISOString()
      setLastSeen(now)
      localStorage.setItem('provi-last-seen', now)
    }
  }, [open, messages])

  const fetchMessages = async (since?: string | null) => {
    const { data } = await supabase
      .from('group_messages')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data ?? [])

    // Contar no leídos
    if (since) {
      const noLeidos = (data ?? []).filter(m => m.created_at > since).length
      setUnread(noLeidos)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !currentUser) return
    await supabase.from('group_messages').insert({
      sender_id: currentUser.id,
      content: input.trim(),
    })
    setInput('')
  }

  if (!esDocente) return null

  return (
    <>
      {/* Burbuja flotante verde */}
      <div className="fixed bottom-24 right-6 z-50">
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
        <div className="fixed bottom-44 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-green-200 flex flex-col overflow-hidden"
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
              <p className="text-green-100 text-xs">Chat exclusivo docentes</p>
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
