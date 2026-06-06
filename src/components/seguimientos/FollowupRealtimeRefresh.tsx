'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

type FollowupRealtimeRefreshProps = {
  mode: 'list' | 'detail'
  followupId?: string
  seriesId?: string
}

export default function FollowupRealtimeRefresh({
  mode,
  followupId,
  seriesId,
}: FollowupRealtimeRefreshProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => router.refresh(), 250)
    }

    let channel = supabase.channel(
      `followups-${mode}-${followupId ?? 'all'}-${seriesId ?? 'all'}`
    )

    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_followups',
        ...(mode === 'detail' && seriesId
          ? { filter: `series_id=eq.${seriesId}` }
          : {}),
      },
      scheduleRefresh
    )

    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'followup_participants',
        ...(mode === 'detail' && followupId
          ? { filter: `followup_id=eq.${followupId}` }
          : {}),
      },
      scheduleRefresh
    )

    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'followup_items',
        ...(mode === 'detail' && followupId
          ? { filter: `followup_id=eq.${followupId}` }
          : {}),
      },
      scheduleRefresh
    )

    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'followup_photos',
        ...(mode === 'detail' && followupId
          ? { filter: `followup_id=eq.${followupId}` }
          : {}),
      },
      scheduleRefresh
    )

    channel.subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [followupId, mode, router, seriesId, supabase])

  return null
}
