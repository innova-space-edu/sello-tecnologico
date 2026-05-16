'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function sendAccessEvent(event_type: string, pathname: string, metadata: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return

  fetch('/api/access-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type, pathname, metadata }),
    keepalive: true,
  }).catch(() => {})
}

export default function AccessTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname === '/login') return
    const key = `access:${pathname}`
    const now = Date.now()
    const last = Number(sessionStorage.getItem(key) ?? 0)

    // Evita duplicados cuando React vuelve a montar componentes durante navegación rápida.
    if (now - last < 8000) return

    sessionStorage.setItem(key, String(now))
    sendAccessEvent(pathname === '/eduai' ? 'eduai_open' : pathname === '/reportes' ? 'report_view' : 'page_view', pathname, {
      referrer: document.referrer || null,
      title: document.title || null,
    })
  }, [pathname])

  return null
}
