'use client'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

const typeStyles: Record<string, string> = {
  info: 'bg-blue-600 text-white',
  warning: 'bg-yellow-400 text-yellow-900',
  success: 'bg-green-600 text-white',
  // Los banners de tipo 'error' (bloqueos) NO se muestran — solo van al panel admin
}

const typeIcon: Record<string, string> = {
  info: 'ℹ️', warning: '⚠️', success: '✅',
}

export default function NotificationBanner() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const fetchNotifications = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('active', true)
      // NUNCA mostrar notificaciones de tipo 'error' en el banner público
      // (los bloqueos van solo al panel admin)
      .neq('type', 'error')
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order('created_at', { ascending: false })
    setNotifications(data ?? [])
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setIsLoggedIn(true)
      fetchNotifications()
    })

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications()
      })
      .subscribe()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
      if (!session) setNotifications([])
    })

    return () => {
      supabase.removeChannel(channel)
      subscription.unsubscribe()
    }
  }, [])

  const visible = notifications.filter(n => !dismissed.includes(n.id))
  if (!isLoggedIn || visible.length === 0) return null

  return (
    <div className="fixed top-0 left-64 right-0 z-40 space-y-0">
      {visible.map(n => (
        <div key={n.id} className={`flex items-center justify-between px-6 py-2.5 ${typeStyles[n.type] ?? typeStyles.info}`}>
          <div className="flex items-center gap-2 text-sm">
            <span>{typeIcon[n.type] ?? 'ℹ️'}</span>
            <span className="font-semibold">{n.title}</span>
            {n.message && <span className="opacity-90">— {n.message}</span>}
            {n.expires_at && <span className="opacity-70 text-xs ml-2">Hasta: {n.expires_at}</span>}
          </div>
          <button onClick={() => setDismissed(prev => [...prev, n.id])}
            className="opacity-70 hover:opacity-100 transition-opacity ml-4 text-lg leading-none">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
