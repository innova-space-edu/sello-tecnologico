'use client'

import { createClient } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'

export default function PersonalNotificationCount() {
  const supabase = useMemo(() => createClient(), [])
  const [count, setCount] = useState(0)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const refresh = async () => {
        const { count: unread } = await supabase
          .from('user_notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
        setCount(unread ?? 0)
      }

      await refresh()
      channel = supabase
        .channel(`personal-notifications-count-${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}`,
        }, refresh)
        .subscribe()
    }

    load()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [supabase])

  if (count === 0) return null
  return <span className="ml-auto flex items-center justify-center bg-red-500 text-white text-xs rounded-full min-w-5 h-5 px-1 font-bold">{count > 9 ? '9+' : count}</span>
}
