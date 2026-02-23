'use client'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

const typeStyles: Record<string, string> = {
  info: 'bg-blue-600 text-white',
  warning: 'bg-yellow-400 text-yellow-900',
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
}

const typeIcon: Record<string, string> = {
  info: 'ℹ️', warning: '⚠️', success: '✅', error: '🚨',
}

export default function NotificationBanner() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('notifications')
      .select('*')
      .eq('active', true)
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotifications(data ?? []))
  }, [])

  const visible = notifications.filter(n => !dismissed.includes(n.id))
  if (visible.length === 0) return null

  return (
    <div className="fixed top-0 left-64 right-0 z-40 space-y-0">
      {visible.map(n => (
        <div key={n.id} className={`flex items-center justify-between px-6 py-2.5 ${typeStyles[n.type] ?? typeStyles.info}`}>
          <div className="flex items-center gap-2 text-sm">
            <span>{typeIcon[n.type]}</span>
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
