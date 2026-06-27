import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function ConversacionNotificadaPage({ searchParams }: { searchParams: Promise<{ sender?: string; receiver?: string }> }) {
  const params = await searchParams
  const sender = params.sender ?? ''
  const receiver = params.receiver ?? ''
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()

  if (perfil?.role !== 'admin') {
    return <div className="flex min-h-screen bg-gray-50"><Sidebar /><main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8"><div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center"><div className="text-4xl mb-3">🚫</div><h2 className="text-lg font-semibold text-red-700">Acceso restringido</h2></div></main></div>
  }

  let messages: any[] = []
  if (sender && receiver) {
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, read, created_at, sender:profiles!messages_sender_id_fkey(full_name, email, role, curso), receiver:profiles!messages_receiver_id_fkey(full_name, email, role, curso)')
      .or(`and(sender_id.eq.${sender},receiver_id.eq.${receiver}),and(sender_id.eq.${receiver},receiver_id.eq.${sender})`)
      .order('created_at', { ascending: true })
    messages = data ?? []
  }

  const first = messages[0]
  const left = first?.sender_id === sender ? first?.sender : first?.receiver
  const right = first?.sender_id === sender ? first?.receiver : first?.sender

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href="/admin/moderacion" className="text-blue-600 text-sm hover:underline">← Volver a moderación</Link>
          <div className="mt-3 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Revisión de mensaje notificado</p>
              <h1 className="text-2xl font-bold text-blue-900 mt-1">Conversación notificada</h1>
              <p className="text-gray-500 mt-1 text-sm">Revisa el contexto completo entre los participantes antes de tomar una decisión.</p>
            </div>
            <Link href="/admin/mensajes" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">Abrir monitoreo general</Link>
          </div>
        </div>

        {sender && receiver ? (
          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-blue-900">{left?.full_name ?? left?.email ?? 'Participante'} ↔ {right?.full_name ?? right?.email ?? 'Participante'}</h2>
              <p className="text-xs text-gray-500 mt-1">{messages.length} mensaje(s) encontrados</p>
            </div>
            <div className="p-5 space-y-3">
              {messages.length > 0 ? messages.map((message: any) => {
                const isSender = message.sender_id === sender
                return (
                  <article key={message.id} className={`rounded-2xl border p-4 ${isSender ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{message.sender?.full_name ?? message.sender?.email ?? 'Sin nombre'}</p>
                        <p className="text-xs text-gray-500">{message.sender?.role ?? 'sin rol'} {message.sender?.curso ? `· ${message.sender.curso}` : ''}</p>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(message.created_at).toLocaleString('es-CL')}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{message.content}</p>
                  </article>
                )
              }) : <div className="p-10 text-center text-gray-400">No se encontraron mensajes para esta conversación. Puede tratarse de un mensaje retenido antes de ser enviado.</div>}
            </div>
          </section>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800">Faltan parámetros de conversación. Vuelve a Moderación y abre una alerta desde “Abrir conversación notificada”.</div>
        )}
      </main>
    </div>
  )
}
