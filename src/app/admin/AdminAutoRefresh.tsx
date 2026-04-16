'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Props {
  intervalo?: number // fallback polling en ms (por defecto 30s como respaldo)
}

export default function AdminAutoRefresh({ intervalo = 30000 }: Props) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Realtime: re-renderizar el Server Component al instante cuando cambia cualquier tabla clave
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evidences' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => {
        router.refresh()
      })
      .subscribe()

    // Fallback: polling de respaldo cada 30s por si el canal WebSocket falla
    const timer = setInterval(() => router.refresh(), intervalo)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [router, intervalo])

  return null
}
