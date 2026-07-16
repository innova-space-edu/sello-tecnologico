'use client'

import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'

type Notice = {
  id: string
  title: string
  message: string
  type: string
  source_type?: string | null
  source_id?: string | null
  is_read: boolean
  created_at: string
}

function destination(row: Notice) {
  if (row.source_type === 'followup' && row.source_id) return `/seguimientos/${row.source_id}`
  if (row.source_type === 'survey') return '/mis-encuestas'
  if (row.source_type === 'story' && row.source_id) return `/revision-historias?historia=${row.source_id}`
  if (row.source_type === 'report' && row.source_id) return `/informes/${row.source_id}`
  return '/dashboard'
}

function noticeLabel(row: Notice) {
  if (row.type === 'story_review') return 'Historia'
  if (row.type === 'project_report') return 'Informe'
  if (row.type === 'report_rubric') return 'Rúbrica'
  return row.type
}

export default function MisNotificacionesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Notice[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = async (uid: string) => {
    const { data } = await supabase
      .from('user_notifications')
      .select('id, title, message, type, source_type, source_id, is_read, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    setRows((data ?? []) as Notice[])
    setLoading(false)
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      await refresh(user.id)
      channel = supabase.channel(`my-notices-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` }, () => refresh(user.id))
        .subscribe()
    }
    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [supabase])

  const markRead = async (id: string) => {
    await supabase.from('user_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    setRows(prev => prev.map(row => row.id === id ? { ...row, is_read: true } : row))
  }

  const markAllRead = async () => {
    if (!userId) return
    await supabase.from('user_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', userId).eq('is_read', false)
    setRows(prev => prev.map(row => ({ ...row, is_read: true })))
  }

  return <div className="flex min-h-screen bg-gray-50">
    <Sidebar />
    <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
      <div className="flex flex-wrap justify-between gap-3 items-start mb-6">
        <div><h1 className="text-2xl font-bold text-blue-900">Mis avisos</h1><p className="text-gray-500 mt-1">Revisa asignaciones, resultados, rúbricas y retroalimentaciones asociadas a tu cuenta.</p></div>
        <button type="button" onClick={markAllRead} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold">Marcar todo como leído</button>
      </div>

      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <div className="p-10 text-center text-gray-400">Cargando avisos…</div> : rows.length > 0 ? <div className="divide-y divide-gray-100">{rows.map(row => <div key={row.id} className={`px-5 lg:px-6 py-4 ${row.is_read ? 'bg-white' : 'bg-blue-50'}`}>
          <div className="flex flex-wrap justify-between gap-3 items-start">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 items-center mb-1"><span className="text-xs rounded-full px-2.5 py-1 font-semibold bg-gray-100 text-gray-700">{noticeLabel(row)}</span>{!row.is_read && <span className="text-xs rounded-full px-2.5 py-1 font-semibold bg-red-100 text-red-700">Nuevo</span>}</div><h2 className="font-semibold text-gray-800">{row.title}</h2><p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{row.message}</p><p className="text-xs text-gray-400 mt-2">{new Date(row.created_at).toLocaleString('es-CL')}</p></div>
            <div className="flex flex-wrap gap-2 shrink-0">{!row.is_read && <button type="button" onClick={() => markRead(row.id)} className="border border-gray-200 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-50">Marcar leído</button>}<Link href={destination(row)} onClick={() => markRead(row.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold">Abrir</Link></div>
          </div>
        </div>)}</div> : <div className="p-12 text-center text-gray-400">Todavía no tienes avisos personales.</div>}
      </section>
    </main>
  </div>
}
