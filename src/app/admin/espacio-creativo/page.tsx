'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

type Work = {
  id: string
  title: string
  author: string
  description: string
  type: 'image' | 'video' | 'audio'
  status: 'pending' | 'published'
  date: string
  url: string | null
}

export default function RevisarEspacioCreativo() {
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/espacio-creativo/revision', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar la revisión.')
      setWorks(data.works || [])
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar la revisión.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const review = async (work: Work, action: 'publish' | 'reject') => {
    setBusyId(work.id)
    setError('')
    try {
      const response = await fetch('/api/espacio-creativo/revision', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: work.id, action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar la revisión.')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la revisión.')
    } finally {
      setBusyId('')
    }
  }

  const pending = works.filter(work => work.status === 'pending')
  const published = works.filter(work => work.status === 'published')

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 lg:ml-64 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-6xl">
          <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:underline">← Administración</Link>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-blue-950">Revisión · Espacio creativo</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                Revisa archivos, atribución y privacidad antes de aprobar su exhibición. La publicación exige autorización vigente para visibilidad pública.
              </p>
            </div>
            <Link href="/espacio-creativo" className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">Ver galería</Link>
          </div>

          <div className="my-7 flex flex-wrap gap-3">
            <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-bold text-amber-900">Pendientes: {pending.length}</span>
            <span className="rounded-full bg-emerald-100 px-5 py-2 text-sm font-bold text-emerald-900">Publicadas: {published.length}</span>
            <button type="button" onClick={() => void reload()} className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-bold">Actualizar</button>
          </div>
          {error && <p role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
          {loading ? <p role="status" className="p-8 text-slate-500">Cargando obras…</p> : works.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">No hay obras pendientes ni publicadas.</div>
          ) : (
            <div className="space-y-10">
              {[{ heading: 'Pendientes de revisión', rows: pending }, { heading: 'Obras en exhibición', rows: published }].map(section => (
                <section key={section.heading}>
                  <h2 className="mb-4 text-xl font-black text-slate-800">{section.heading}</h2>
                  {section.rows.length === 0 ? <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Sin obras en esta categoría.</p> : (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {section.rows.map(work => (
                        <article key={work.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="flex aspect-video items-center justify-center bg-slate-900 text-white">
                            {!work.url ? <span>Vista previa no disponible</span> : work.type === 'image' ? (
                              <img src={work.url} alt={work.title} className="h-full w-full object-contain" />
                            ) : work.type === 'video' ? (
                              <video src={work.url} controls preload="metadata" className="h-full w-full" />
                            ) : (
                              <audio src={work.url} controls className="w-[90%]" />
                            )}
                          </div>
                          <div className="space-y-3 p-5">
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">{work.type === 'audio' ? 'Podcast' : work.type === 'image' ? 'Imagen' : 'Video'}</p>
                            <h3 className="break-words text-lg font-black">{work.title}</h3>
                            <p className="text-sm font-semibold">Autor: {work.author}</p>
                            <p className="break-words text-sm text-slate-600">{work.description || 'Sin descripción.'}</p>
                            <p className="text-xs text-slate-400">{new Date(work.date).toLocaleDateString('es-CL')}</p>
                            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                              {work.status === 'pending' && (
                                <button type="button" disabled={busyId === work.id} onClick={() => void review(work, 'publish')}
                                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Aprobar</button>
                              )}
                              <button type="button" disabled={busyId === work.id} onClick={() => void review(work, 'reject')}
                                className="rounded-full bg-rose-100 px-4 py-2 text-xs font-bold text-rose-800 disabled:opacity-50">
                                {work.status === 'published' ? 'Retirar' : 'Rechazar'}
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
