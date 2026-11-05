'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  CREATIVE_BUCKET, CREATIVE_MAX_BYTES, CREATIVE_MIMES,
  CREATIVE_EXTENSIONS, normalizeCreativeTags,
} from '@/lib/creative-space-public'

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

const fileAccept = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mp3,.m4a,.wav,.ogg,.oga,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm'

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
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [replacement, setReplacement] = useState<File | null>(null)
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

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

  const beginEdit = (work: Work) => {
    setEditingId(work.id)
    setTitle(work.title)
    setAuthor(work.author)
    setDescription(work.description)
    setTagsText(work.tags.join(', '))
    setReplacement(null)
    setRights(false)
    setFormError('')
    setNotice('')
  }

  const save = async (event: React.FormEvent<HTMLFormElement>, work: Work) => {
    event.preventDefault()
    setFormError('')
    const tags = tagsText.trim() === '' ? [] : normalizeCreativeTags(tagsText.split(','))
    if (!tags) {
      setFormError('Utiliza como máximo 8 etiquetas, separadas por comas, de hasta 24 caracteres cada una.')
      return
    }
    if (replacement) {
      const ext = replacement.name.split('.').pop()?.toLowerCase() ?? ''
      if (!CREATIVE_MIMES[replacement.type] ||
          !CREATIVE_EXTENSIONS[replacement.type]?.includes(ext) ||
          replacement.size <= 0 || replacement.size > CREATIVE_MAX_BYTES) {
        setFormError('Selecciona un archivo compatible de hasta 50 MB.')
        return
      }
    }
    if (!rights) {
      setFormError('Confirma los derechos antes de guardar los cambios.')
      return
    }

    setBusy(true)
    try {
      let nextFile: { path: string, mime: string, size: number, fileName: string } | null = null
      if (replacement) {
        const client = createClient()
        const { data: { user }, error: sessionError } = await client.auth.getUser()
        if (sessionError || !user) throw new Error('Debes iniciar sesión para reemplazar el archivo.')
        const ext = replacement.name.split('.').pop()?.toLowerCase()
        const path = user.id + '/' + crypto.randomUUID() + '.' + ext
        const { error: uploadError } = await client.storage.from(CREATIVE_BUCKET)
          .upload(path, replacement, { contentType: replacement.type, upsert: false })
        if (uploadError) throw uploadError
        nextFile = { path, mime: replacement.type, size: replacement.size, fileName: replacement.name }
      }

      const response = await fetch('/api/espacio-creativo/mis-obras', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: work.id, expectedUpdatedAt: work.updatedAt,
          title, author, description, tags, rightsConfirmed: rights, replacement: nextFile,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'No fue posible guardar los cambios.')
      setEditingId(null)
      setReplacement(null)
      setNotice(json.message || 'Cambios enviados para revisión.')
      await reload()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'No fue posible guardar la obra.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-10">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">Tu portafolio</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Mis obras</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            Corrige títulos, autores, descripciones y etiquetas, o sustituye un archivo equivocado.
            Solo puedes editar lo que tú subiste.
          </p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={loading || busy}
          className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
          Actualizar lista
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
        Cualquier corrección, incluso de una obra ya publicada, la devuelve a revisión.
        Los cambios no serán públicos hasta que un administrador vuelva a aprobarla.
      </div>

      {notice && <p role="status" className="mb-6 rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-emerald-200">{notice}</p>}
      {listError && <p role="alert" className="mb-6 rounded-xl border border-rose-300/25 bg-rose-500/10 p-4 text-rose-200">{listError}</p>}

      {loading ? <p role="status" className="py-16 text-center text-slate-300">Consultando tus obras…</p> : !works.length ? (
        <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-12 text-center">
          <div className="text-5xl">🎨</div>
          <p className="mt-4 text-xl font-bold">Todavía no has subido obras</p>
          <a href="/espacio-creativo" className="mt-5 inline-block rounded-full bg-fuchsia-400 px-6 py-3 font-black text-slate-950">Ir a subir material</a>
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

                {editingId !== work.id ? (
                  <button type="button" disabled={busy} onClick={() => beginEdit(work)}
                    className="mt-3 w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-5 py-3 font-black text-white disabled:opacity-50">
                    ✎ Editar mi obra
                  </button>
                ) : (
                  <form onSubmit={event => void save(event, work)} className="mt-5 space-y-4 border-t border-white/10 pt-5">
                    <h3 className="text-lg font-black">Editar publicación</h3>
                    <label className="block text-sm font-semibold">Título *
                      <input required minLength={2} maxLength={160} value={title} onChange={event => setTitle(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/20 bg-black/25 px-4 py-2.5 font-normal outline-none focus:border-fuchsia-300" />
                    </label>
                    <label className="block text-sm font-semibold">Autor o autores *
                      <input required minLength={2} maxLength={120} value={author} onChange={event => setAuthor(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/20 bg-black/25 px-4 py-2.5 font-normal outline-none focus:border-fuchsia-300" />
                    </label>
                    <label className="block text-sm font-semibold">Descripción
                      <textarea rows={3} maxLength={1200} value={description} onChange={event => setDescription(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/20 bg-black/25 px-4 py-2.5 font-normal outline-none focus:border-fuchsia-300" />
                    </label>
                    <label className="block text-sm font-semibold">Etiquetas
                      <input value={tagsText} onChange={event => setTagsText(event.target.value)}
                        placeholder="Ciencias, Robótica, Fotografía"
                        className="mt-1 w-full rounded-xl border border-white/20 bg-black/25 px-4 py-2.5 font-normal outline-none focus:border-fuchsia-300" />
                      <span className="mt-1 block text-xs font-normal text-slate-400">Hasta 8 etiquetas separadas por comas.</span>
                    </label>
                    <label className="block rounded-xl border border-dashed border-white/20 p-4 text-sm font-semibold">
                      Cambiar archivo (opcional)
                      <input type="file" accept={fileAccept} onChange={event => setReplacement(event.target.files?.[0] ?? null)}
                        className="mt-2 block w-full text-xs font-normal text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-400 file:px-3 file:py-2 file:font-bold file:text-slate-950" />
                      <span className="mt-2 block text-xs font-normal text-slate-400">
                        {replacement ? replacement.name : 'Conservaremos el archivo actual si no eliges uno nuevo.'} Máximo 50 MB.
                      </span>
                    </label>
                    <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-slate-200">
                      <input type="checkbox" required checked={rights} onChange={event => setRights(event.target.checked)} className="mt-0.5 accent-fuchsia-400" />
                      Confirmo mis derechos sobre la versión corregida y las autorizaciones necesarias para su publicación.
                    </label>
                    {formError && <p role="alert" className="rounded-xl bg-rose-900/40 p-3 text-sm text-rose-200">{formError}</p>}
                    <div className="flex flex-wrap gap-3">
                      <button type="submit" disabled={busy}
                        className="rounded-full bg-fuchsia-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
                        {busy ? 'Guardando…' : 'Guardar y enviar a revisión'}
                      </button>
                      <button type="button" disabled={busy} onClick={() => setEditingId(null)}
                        className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/10">
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
