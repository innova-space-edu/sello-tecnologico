'use client'

import { useEffect } from 'react'

export default function ShareRedirect({ destination, title }: { destination: string; title: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace(destination), 120)
    return () => window.clearTimeout(timer)
  }, [destination])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        <div className="text-5xl">🌐</div>
        <h1 className="mt-4 text-2xl font-black">{title}</h1>
        <p className="mt-2 text-sm text-slate-300">Abriendo el contenido compartido…</p>
        <a href={destination} className="mt-6 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">
          Abrir ahora
        </a>
      </div>
    </main>
  )
}
