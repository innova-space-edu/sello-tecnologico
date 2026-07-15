'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'

const ACCEPTED = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']

type PageOption = {
  id: string
  title: string
  project_id?: string | null
  course_id?: string | null
}

type Props = {
  onClose: () => void
  onCreated: (storyId: string) => void
}

function safeFileName(name: string) {
  const extension = name.includes('.') ? `.${name.split('.').pop()}` : ''
  const base = name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'archivo'
  return `${base}${extension.toLowerCase()}`
}

export default function StoryUploader({ onClose, onCreated }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [pageId, setPageId] = useState('')
  const [pages, setPages] = useState<PageOption[]>([])
  const [userId, setUserId] = useState('')
  const [loadingUser, setLoadingUser] = useState(true)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingUser(false)
        return
      }
      setUserId(user.id)
      const { data } = await supabase
        .from('project_public_pages')
        .select('id, title, project_id, course_id')
        .order('updated_at', { ascending: false })
        .limit(50)
      setPages(((data ?? []) as PageOption[]).map(page => ({ ...page, title: page.title.replace(/^Vitrina:\s*/i, '') })))
      setLoadingUser(false)
    }
    init()
  }, [supabase])

  useEffect(() => {
    const next = files.map(file => URL.createObjectURL(file))
    setPreviews(next)
    return () => next.forEach(url => URL.revokeObjectURL(url))
  }, [files])

  const chooseFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const selected = Array.from(event.target.files ?? []).slice(0, 10)
    const invalid = selected.find(file => !ACCEPTED.includes(file.type) || file.size > 50 * 1024 * 1024)
    if (invalid) {
      setError('Usa imágenes JPG, PNG, WebP o GIF y videos MP4, WebM o MOV de hasta 50 MB cada uno.')
      event.target.value = ''
      return
    }
    setFiles(selected)
  }

  const publish = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!userId) {
      window.location.href = '/login'
      return
    }
    if (files.length === 0) {
      setError('Selecciona al menos una imagen o video.')
      return
    }

    setSending(true)
    setError('')
    const storyId = crypto.randomUUID()
    const uploadedPaths: string[] = []

    try {
      const items = []
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        setProgress(`Subiendo ${index + 1} de ${files.length}…`)
        const path = `${userId}/${storyId}/${String(index + 1).padStart(2, '0')}-${Date.now()}-${safeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage.from('community-stories').upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        })
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
        items.push({
          mediaType: file.type.startsWith('video/') ? 'video' : 'image',
          storagePath: path,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        })
      }

      setProgress('Publicando historia…')
      const selectedPage = pages.find(page => page.id === pageId)
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: storyId,
          title,
          caption,
          pageId: pageId || null,
          projectId: selectedPage?.project_id ?? null,
          courseId: selectedPage?.course_id ?? null,
          items,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.error ?? 'No se pudo publicar la historia.')

      setProgress('¡Publicada! Ya es visible en la comunidad.')
      window.setTimeout(() => onCreated(storyId), 600)
    } catch (caught: any) {
      if (uploadedPaths.length) await supabase.storage.from('community-stories').remove(uploadedPaths)
      setError(caught?.message ?? 'No se pudo publicar la historia.')
      setProgress('')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Crear historia">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-xl font-black text-slate-900">Crear historia</h2>
            <p className="text-xs font-semibold text-slate-500">Se publicará inmediatamente y quedará notificada para revisión.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-600 hover:bg-slate-200">×</button>
        </div>

        {loadingUser ? <div className="p-12 text-center text-slate-400">Comprobando tu cuenta…</div> : !userId ? (
          <div className="p-10 text-center">
            <div className="text-5xl">🔐</div>
            <h3 className="mt-4 text-xl font-black text-slate-900">Inicia sesión para publicar</h3>
            <p className="mt-2 text-sm text-slate-500">Todos pueden ver las historias, pero solo usuarios registrados pueden subir contenido.</p>
            <a href="/login" className="mt-5 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white">Ingresar</a>
          </div>
        ) : (
          <form onSubmit={publish} className="space-y-5 p-5 sm:p-7">
            <label className="block cursor-pointer rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50 p-6 text-center transition hover:border-blue-400 hover:bg-blue-100">
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple onChange={chooseFiles} className="hidden" disabled={sending} />
              <div className="text-4xl">📸</div>
              <p className="mt-2 font-black text-blue-900">Seleccionar imágenes o videos cortos</p>
              <p className="mt-1 text-xs text-blue-700">Hasta 10 elementos · máximo 50 MB por archivo · formato vertical recomendado</p>
            </label>

            {previews.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {previews.map((url, index) => (
                  <div key={url} className="relative aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-950 shadow-sm">
                    {files[index]?.type.startsWith('video/') ? <video src={url} muted playsInline className="h-full w-full object-cover" /> : <img src={url} alt={`Vista previa ${index + 1}`} className="h-full w-full object-cover" />}
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-black text-white">{index + 1}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">Título opcional
                <input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="Ej.: Experimento de ciencias" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200" />
              </label>
              <label className="block text-sm font-bold text-slate-700">Página o proyecto opcional
                <select value={pageId} onChange={event => setPageId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">Historia general de la comunidad</option>
                  {pages.map(page => <option key={page.id} value={page.id}>{page.title}</option>)}
                </select>
              </label>
            </div>

            <label className="block text-sm font-bold text-slate-700">Descripción
              <textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={600} rows={3} placeholder="Cuenta brevemente qué están mostrando…" className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200" />
            </label>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <strong>Publicación inmediata:</strong> aparecerá en la comunidad apenas termine la carga. Docentes y administradores recibirán un aviso para revisarla después.
            </div>

            {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
            {progress && <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{progress}</div>}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={sending} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={sending || files.length === 0} className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{sending ? 'Publicando…' : 'Publicar ahora'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
