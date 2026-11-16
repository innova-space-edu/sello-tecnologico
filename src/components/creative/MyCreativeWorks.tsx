'use client'

import { useCallback, useEffect, useState } from 'react'

type Work = {
  id: string
  title: string
  author: string
  description: string
  tags: string[]
  type: 'image' | 'video' | 'audio'
  fileName: string
  status: 'pending' | 'published' | 'rejected'
  createdAt: string
  updatedAt: string
  url: string | null
}

const statusLabels = {
  pending: 'Pendiente de revisión',
  published: 'Publicada',
  rejected: 'Rechazada',
} as const

function Preview({ work }: { work: Work }) {
  if (!work.url) return <span className="text-sm text-slate-400">Vista previa no disponible</span>
  if (work.type === 'image') return <img src={work.url} alt={work.title} className="h-full w-full object-contain" />
  if (work.type === 'video') return <video src={work.url} controls preload="metadata" playsInline className="h-full w-full" />
  return <audio src={work.url} controls preload="metadata" className="w-[90%]" />
}

export default function MyCreativeWorks() {
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const reload = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const response = await fetch('/api/espacio-creativo/mis-obras', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'No fue posible consultar tus obras.')
      setWorks((json.works || []) as Work[])
    } catch (caught) {
      setListError(caught instanceof Error ? caught.message : 'Error al consultar tus obras.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-10">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">Tu portafolio</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Mis obras</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            Consulta el estado de las obras que registraste. La gestión de la galería está reservada a Administración.
          </p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={loading}
          className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
          Actualizar lista
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
        La galería pública muestra solo obras autorizadas. Para solicitar una corrección, contacta a Administración.
      </div>

      {listError && <p role="alert" className="mb-6 rounded-xl border border-rose-300/25 bg-rose-500/10 p-4 text-rose-200">{listError}</p>}

      {loading ? <p role="status" className="py-16 text-center text-slate-300">Consultando tus obras…</p> : !works.length ? (
        <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-12 text-center">
          <div className="text-5xl">🎨</div>
          <p className="mt-4 text-xl font-bold">Todavía no has subido obras</p>
          <a href="/espacio-creativo" className="mt-5 inline-block rounded-full bg-fuchsia-400 px-6 py-3 font-black text-slate-950">Ver galería pública</a>
        </div>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-2">
          {works.map(work => (
            <article key={work.id} className="overflow-hidden rounded-3xl border border-white/15 bg-[#141b2d] shadow-xl">
              <div className="flex h-60 items-center justify-center bg-black/40">
                <Preview work={work} />
              </div>
              <div className="space-y-3 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold">
                    {statusLabels[work.status]}
                  </span>
                  <span className="text-xs uppercase tracking-widest text-fuchsia-300">
                    {work.type === 'image' ? 'Imagen' : work.type === 'video' ? 'Video' : 'Podcast'}
                  </span>
                </div>
                <h2 className="break-words text-xl font-black">{work.title}</h2>
                <p className="text-sm text-slate-300">Autor: {work.author}</p>
                <p className="break-words text-sm text-slate-400">{work.description || 'Sin descripción.'}</p>
                {work.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {work.tags.map(tag => <span key={tag} className="rounded-full bg-fuchsia-400/10 px-3 py-1 text-xs text-fuchsia-200">#{tag}</span>)}
                  </div>
                )}
                <p className="truncate text-xs text-slate-500">Archivo: {work.fileName}</p>

                <p className="text-xs text-slate-400">Solo Administración puede modificar o retirar esta obra.</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
