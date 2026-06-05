'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

type Props = { mode: 'list' | 'detail'; followupId?: string; seriesId?: string }

export default function FollowupRealtimeRefresh({ mode, followupId, seriesId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 250)
    }
    const filter = mode === 'detail' && followupId ? `followup_id=eq.${followupId}` : undefined
    const seriesFilter = mode === 'detail' && seriesId ? `series_id=eq.${seriesId}` : undefined
    let channel = supabase.channel(`followups-${mode}-${followupId ?? 'all'}`)
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'project_followups', ...(seriesFilter ? { filter: seriesFilter } : {}) }, refresh)
    for (const table of ['followup_participants', 'followup_items', 'followup_photos']) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, refresh)
    }
    channel.subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [followupId, mode, router, seriesId, supabase])

  return null
}
