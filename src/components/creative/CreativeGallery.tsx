'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { CREATIVE_MAX_BYTES, CREATIVE_MIMES, CREATIVE_EXTENSIONS } from '@/lib/creative-space-public'

type Work = {
  id: string
  title: string
  author: string
  description: string
  type: 'image' | 'video' | 'audio'
  url: string
  date: string
}

type Props = { canUpload: boolean, viewerName: string }
type Filter = 'all' | Work['type']
type Mode = 'museum' | 'mosaic'

const filters: { key: Filter, label: string, icon: string }[] = [
  { key: 'all', label: 'Todas', icon: '✦' },
  { key: 'image', label: 'Imágenes', icon: '🖼️' },
  { key: 'video', label: 'Videos', icon: '🎬' },
  { key: 'audio', label: 'Podcasts', icon: '🎙️' },
]

function Media({ work, large = false }: { work: Work, large?: boolean }) {
  if (work.type === 'image') {
    return <img src={work.url} alt={work.title + ' de ' + work.author} loading={large ? 'eager' : 'lazy'} className="h-full w-full object-contain" />
  }
  if (work.type === 'video') {
    return <video src={work.url} controls={large} preload="metadata" playsInline className="h-full w-full object-contain" aria-label={work.title} />
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-gradient-to-br from-indigo-950 via-fuchsia-950 to-slate-950 px-5 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-fuchsia-300/40 bg-fuchsia-400/10 text-5xl shadow-[0_0_60px_rgba(217,70,239,0.28)]">🎙️</div>
      <div className="flex h-14 items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: 23 }, (_, index) => (
          <span key={index} className="creative-wave w-1 rounded-full bg-gradient-to-t from-fuchsia-500 to-cyan-300"
            style={{ height: String(12 + (index * 17 % 43)) + 'px', animationDelay: String((index % 7) * .13) + 's' }} />
        ))}
      </div>
      {large && <audio src={work.url} controls preload="none" className="max-w-full" aria-label={'Reproducir ' + work.title} />}
      {!large && <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-200/70">Escucha la obra</p>}
    </div>
  )
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function CreativeGallery({ canUpload, viewerName }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('museum')
  const [focusId, setFocusId] = useState<string | null>(null)
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const deepLinkApplied = useRef(false)

  const loadWorks = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch('/api/espacio-creativo', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'No fue posible abrir la galería.')
      setWorks((json.works || []) as Work[])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Error al cargar las obras.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadWorks() }, [loadWorks])

  useEffect(() => {
    if (!works.length || deepLinkApplied.current) return
    deepLinkApplied.current = true
    const id = new URLSearchParams(window.location.search).get('obra')
    if (id && works.some(work => work.id === id)) {
      setFocusId(id)
      setLightboxId(id)
    }
  }, [works])

  useEffect(() => {
    if (!lightboxId) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightboxId(null) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [lightboxId])

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-CL')
    return works.filter(work => (filter === 'all' || work.type === filter) &&
      (!normalized || [work.title, work.author, work.description].join(' ').toLocaleLowerCase('es-CL').includes(normalized)))
  }, [works, filter, query])

  const selected = visible.find(work => work.id === focusId) ?? visible[0] ?? null
  const openWork = works.find(work => work.id === lightboxId) ?? null

  const move = (direction: number) => {
    if (!selected || visible.length < 2) return
    const index = visible.findIndex(work => work.id === selected.id)
    setFocusId(visible[(index + direction + visible.length) % visible.length].id)
  }

  const share = async (work: Work) => {
    const url = window.location.origin + '/espacio-creativo?obra=' + encodeURIComponent(work.id)
    try {
      if (navigator.share) await navigator.share({ title: work.title, text: 'Espacio creativo · ' + work.author, url })
      else {
        await navigator.clipboard.writeText(url)
        setShareMessage('Enlace copiado')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setShareMessage('Copia este enlace: ' + url)
    }
  }

  return (
    <>
      <div className="pointer-events-none absolute left-0 top-20 h-[500px] w-full overflow-hidden" aria-hidden="true">
        <div className="absolute -left-20 top-5 h-80 w-80 rounded-full bg-fuchsia-700/15 blur-3xl" />
        <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-blue-700/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-12">
        <div className="mb-10 flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-200">
              ✦ Museo digital de la comunidad
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Espacio <span className="bg-gradient-to-r from-fuchsia-300 via-rose-200 to-cyan-300 bg-clip-text text-transparent">creativo.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Un recorrido por las ideas, imágenes, cortometrajes, voces y creaciones de estudiantes y docentes.
              Explora cada obra como si estuvieras en una exposición de arte.
            </p>
          </div>
          <button type="button" onClick={() => canUpload ? setUploadOpen(true) : window.location.assign('/login')}
            className="inline-flex shrink-0 items-center justify-center gap-3 self-start rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-7 py-4 font-black text-white shadow-[0_18px_50px_rgba(167,67,221,0.25)] transition hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(167,67,221,0.45)]">
            <span className="text-xl">＋</span> Subir material
          </button>
        </div>

        <div className="mb-10 grid grid-cols-3 gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:max-w-lg sm:p-5">
          {[['Obras', works.length], ['Imágenes', works.filter(work => work.type === 'image').length], ['Videos y podcasts', works.filter(work => work.type !== 'image').length]].map(([label, count]) => (
            <div key={label} className="border-r border-white/10 px-2 text-center last:border-0">
              <div className="text-2xl font-black text-white sm:text-3xl">{count}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
            </div>
          ))}
        </div>

        <div className="mb-7 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar formatos">
            {filters.map(item => (
              <button key={item.key} type="button" onClick={() => { setFilter(item.key); setFocusId(null) }}
                aria-pressed={filter === item.key}
                className={'rounded-full px-4 py-2.5 text-sm font-bold transition ' +
                  (filter === item.key ? 'bg-white text-slate-950 shadow-lg' : 'bg-white/5 text-slate-300 hover:bg-white/15')}>
                <span className="mr-1">{item.icon}</span> {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input type="search" value={query} onChange={event => { setQuery(event.target.value); setFocusId(null) }}
              placeholder="Buscar obra o autor…" aria-label="Buscar obra o autor"
              className="min-w-0 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-fuchsia-300 sm:w-52" />
            <div className="inline-flex rounded-full border border-white/15 bg-black/25 p-1" role="group" aria-label="Vista de galería">
              <button type="button" aria-pressed={mode === 'museum'} onClick={() => setMode('museum')}
                className={'rounded-full px-4 py-2 text-sm font-bold ' + (mode === 'museum' ? 'bg-fuchsia-400 text-slate-950' : 'text-slate-300 hover:bg-white/10')}>◈ Sala</button>
              <button type="button" aria-pressed={mode === 'mosaic'} onClick={() => setMode('mosaic')}
                className={'rounded-full px-4 py-2 text-sm font-bold ' + (mode === 'mosaic' ? 'bg-fuchsia-400 text-slate-950' : 'text-slate-300 hover:bg-white/10')}>▦ Mosaico</button>
            </div>
          </div>
        </div>

        {loadError && (
          <div role="alert" className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-950/30 p-5 text-rose-200">
            {loadError} <button type="button" onClick={() => void loadWorks()} className="ml-2 underline">Reintentar</button>
          </div>
        )}
        {loading ? (
          <div className="py-24 text-center text-slate-300" role="status">Preparando la exposición…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-white/20 bg-white/[0.03] px-6 py-24 text-center">
            <div className="mb-4 text-6xl">🎨</div>
            <h2 className="text-2xl font-black">{works.length ? 'No hay obras con estos filtros' : 'La exposición espera sus primeras obras'}</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-400">
              {works.length ? 'Prueba otra búsqueda o formato.' : 'Las imágenes, videos y podcasts aparecerán aquí después de su revisión institucional.'}
            </p>
            {canUpload && !works.length && <button type="button" onClick={() => setUploadOpen(true)}
              className="mt-7 rounded-full bg-fuchsia-500 px-6 py-3 font-bold text-white">Subir la primera obra</button>}
          </div>
        ) : mode === 'museum' && selected ? (
          <section aria-label="Sala de exposición">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111729] p-4 shadow-[0_40px_90px_rgba(0,0,0,0.4)] sm:p-7">
              <div className="absolute left-1/2 top-0 h-36 w-2/3 -translate-x-1/2 rounded-full bg-fuchsia-300/10 blur-3xl" aria-hidden="true" />
              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(250px,0.85fr)]">
                <button type="button" onClick={() => setLightboxId(selected.id)} aria-label={'Abrir obra: ' + selected.title}
                  className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border-[10px] border-[#29253b] bg-[#070a13] shadow-[0_25px_55px_rgba(0,0,0,0.55)] transition hover:border-[#514069]">
                  <Media work={selected} />
                  <span className="absolute bottom-4 right-4 rounded-full bg-black/70 px-4 py-2 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">Ampliar ↗</span>
                </button>
                <div className="flex flex-col justify-center">
                  <span className="text-xs font-black uppercase tracking-[0.32em] text-fuchsia-300">Obra en exhibición</span>
                  <h2 className="mt-4 break-words text-3xl font-black sm:text-4xl">{selected.title}</h2>
                  <p className="mt-3 text-sm font-semibold text-slate-300">Por {selected.author}</p>
                  <p className="mt-1 text-xs text-slate-500">{dateLabel(selected.date)}</p>
                  <p className="mt-6 whitespace-pre-wrap break-words leading-relaxed text-slate-300">{selected.description || 'Una creación de nuestra comunidad educativa.'}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <button type="button" onClick={() => setLightboxId(selected.id)}
                      className="rounded-full bg-fuchsia-400 px-5 py-3 text-sm font-black text-slate-950">Explorar obra</button>
                    <button type="button" onClick={() => void share(selected)}
                      className="rounded-full border border-white/20 px-5 py-3 text-sm font-black hover:bg-white/10">Compartir ↗</button>
                  </div>
                  <div className="mt-10 flex items-center gap-3">
                    <button type="button" onClick={() => move(-1)} aria-label="Obra anterior" className="h-11 w-11 rounded-full border border-white/20 hover:bg-white/10">←</button>
                    <span className="text-sm font-bold text-slate-400">{visible.findIndex(work => work.id === selected.id) + 1} / {visible.length}</span>
                    <button type="button" onClick={() => move(1)} aria-label="Obra siguiente" className="h-11 w-11 rounded-full border border-white/20 hover:bg-white/10">→</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-7 flex gap-4 overflow-x-auto pb-5" aria-label="Otras obras de la exposición">
              {visible.map(work => (
                <button key={work.id} type="button" onClick={() => setFocusId(work.id)} aria-label={'Seleccionar ' + work.title}
                  aria-pressed={work.id === selected.id}
                  className={'w-36 shrink-0 overflow-hidden rounded-2xl border text-left transition hover:-translate-y-1 sm:w-44 ' +
                    (work.id === selected.id ? 'border-fuchsia-300 bg-fuchsia-300/15' : 'border-white/10 bg-white/5 hover:border-white/30')}>
                  <div className="aspect-[4/3] overflow-hidden bg-slate-950"><Media work={work} /></div>
                  <p className="truncate px-3 pt-3 text-sm font-bold">{work.title}</p>
                  <p className="truncate px-3 pb-3 text-xs text-slate-400">{work.author}</p>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section aria-label="Mosaico de obras" className="grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((work, index) => (
              <article key={work.id} className="group min-w-0 rounded-3xl border border-white/10 bg-white/[0.05] p-3 shadow-xl transition duration-300 hover:-translate-y-2 hover:border-fuchsia-200/50 hover:shadow-[0_24px_70px_rgba(192,90,230,0.18)]">
                <button type="button" onClick={() => { setFocusId(work.id); setLightboxId(work.id) }}
                  aria-label={'Ver ' + work.title} className={'relative block w-full overflow-hidden rounded-2xl bg-[#0c1020] ' +
                  (index % 3 === 1 ? 'aspect-[4/5]' : 'aspect-[5/4]')}>
                  <Media work={work} />
                  <span className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1.5 text-xs font-black text-white">{work.type === 'image' ? 'Imagen' : work.type === 'video' ? 'Video' : 'Podcast'}</span>
                  <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold opacity-0 transition group-hover:opacity-100">Abrir exposición ↗</span>
                </button>
                <div className="flex items-start justify-between gap-2 px-2 pb-2 pt-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black">{work.title}</h2>
                    <p className="mt-1 truncate text-sm text-slate-400">Por {work.author}</p>
                  </div>
                  <button type="button" onClick={() => void share(work)} aria-label={'Compartir ' + work.title}
                    className="shrink-0 rounded-full border border-white/20 px-3 py-2 text-sm hover:bg-white/10">↗</button>
                </div>
              </article>
            ))}
          </section>
        )}

        <p role="status" aria-live="polite" className="mt-5 min-h-5 text-center text-xs text-fuchsia-200">{shareMessage}</p>
        <p className="mt-8 text-center text-sm text-slate-500">
          Espacio creativo · Creaciones compartidas con autorización y revisión de la comunidad educativa.
        </p>
      </div>

      {openWork && (
        <div role="dialog" aria-modal="true" aria-label={'Exposición: ' + openWork.title}
          className="fixed inset-0 z-[100] flex flex-col bg-[#050711]/95 p-4 backdrop-blur-xl sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{openWork.title}</p>
              <p className="truncate text-sm text-slate-400">Por {openWork.author}</p>
            </div>
            <button type="button" onClick={() => setLightboxId(null)} autoFocus aria-label="Cerrar obra"
              className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/15">Cerrar ✕</button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-black"><Media work={openWork} large /></div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="line-clamp-2 text-sm text-slate-300">{openWork.description}</p>
            <button type="button" onClick={() => void share(openWork)}
              className="shrink-0 rounded-full bg-fuchsia-400 px-5 py-2.5 text-sm font-black text-slate-950">Compartir ↗</button>
          </div>
        </div>
      )}

      {uploadOpen && (
        <CreativeUploadModal supabase={supabase} viewerName={viewerName} onClose={() => setUploadOpen(false)} />
      )}
    </>
  )
}

function CreativeUploadModal({
  supabase, viewerName, onClose,
}: {
  supabase: ReturnType<typeof createClient>, viewerName: string, onClose: () => void
}) {
  const [author, setAuthor] = useState(viewerName)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!file || !CREATIVE_MIMES[file.type] || file.size > CREATIVE_MAX_BYTES ||
      !CREATIVE_EXTENSIONS[file.type]?.includes(file.name.split('.').pop()?.toLowerCase() ?? '')) {
      setError('Selecciona una imagen, un video o un audio compatible de hasta 50 MB.')
      return
    }
    if (!rights) {
      setError('Debes confirmar que tienes autorización para compartir este material.')
      return
    }

    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Inicia sesión antes de subir el material.')
      const ext = file.name.split('.').pop()?.toLowerCase()
      const path = user.id + '/' + crypto.randomUUID() + '.' + ext
      const { error: storageError } = await supabase.storage.from('creative-space')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (storageError) throw storageError

      const response = await fetch('/api/espacio-creativo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author, title, description, mime: file.type, size: file.size,
          fileName: file.name, path, rightsConfirmed: rights,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'No se pudo registrar la obra.')
      setSuccess(json.message || 'Obra enviada para revisión.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo subir el material.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Subir material al Espacio creativo"
      className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/90 p-3 backdrop-blur-lg sm:p-6">
      <div className="mx-auto my-5 max-w-xl rounded-[2rem] border border-white/15 bg-[#131a2b] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.23em] text-fuchsia-300">Participa en la exposición</p>
            <h2 className="mt-2 text-3xl font-black">Subir material</h2>
            <p className="mt-2 text-sm text-slate-400">Todas las obras se revisan antes de aparecer públicamente.</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar formulario"
            className="rounded-full border border-white/20 px-3 py-2 hover:bg-white/10">✕</button>
        </div>

        {success ? (
          <div role="status" className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-5">
            <div className="text-4xl">✓</div>
            <p className="mt-3 font-bold text-emerald-200">{success}</p>
            <p className="mt-2 text-sm text-slate-300">Si la obra incluye información personal o aparece un estudiante menor de edad, debe contar con las autorizaciones institucionales correspondientes.</p>
            <button type="button" onClick={onClose} className="mt-6 rounded-full bg-white px-6 py-3 font-bold text-slate-900">Cerrar</button>
          </div>
        ) : (
          <form onSubmit={event => void submit(event)} className="space-y-5">
            <label className="block text-sm font-bold text-slate-200">
              Autor o autores *
              <input required minLength={2} maxLength={120} value={author} onChange={event => setAuthor(event.target.value)}
                placeholder="Nombre del estudiante, docente o equipo"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-normal text-white outline-none focus:border-fuchsia-300" />
            </label>
            <label className="block text-sm font-bold text-slate-200">
              Título de la obra *
              <input required minLength={2} maxLength={160} value={title} onChange={event => setTitle(event.target.value)}
                placeholder="¿Cómo se llama tu creación?"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-normal text-white outline-none focus:border-fuchsia-300" />
            </label>
            <label className="block text-sm font-bold text-slate-200">
              Descripción
              <textarea maxLength={1200} rows={3} value={description} onChange={event => setDescription(event.target.value)}
                placeholder="Cuéntanos qué inspiró este trabajo"
                className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-normal text-white outline-none focus:border-fuchsia-300" />
            </label>
            <label className="block rounded-2xl border border-dashed border-fuchsia-300/35 bg-fuchsia-300/5 p-5 text-sm font-bold text-slate-200">
              Archivo: imagen, video o podcast *
              <input required type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mp3,.m4a,.wav,.ogg,.oga,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm"
                onChange={event => setFile(event.target.files?.[0] || null)}
                className="mt-3 block w-full cursor-pointer text-sm font-normal text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-fuchsia-400 file:px-4 file:py-2 file:font-bold file:text-slate-950" />
              <span className="mt-3 block text-xs font-normal text-slate-400">{file ? file.name + ' · ' + (file.size / 1048576).toFixed(1) + ' MB' : 'Un archivo por publicación. Máximo 50 MB.'}</span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} required
                className="mt-1 h-4 w-4 accent-fuchsia-400" />
              <span>Confirmo que soy titular de esta obra o tengo permiso para compartirla, y que cuento con las autorizaciones de imagen y datos personales necesarias.</span>
            </label>
            {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-6 py-3.5 font-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
              {busy ? 'Subiendo material…' : 'Enviar para revisión'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
