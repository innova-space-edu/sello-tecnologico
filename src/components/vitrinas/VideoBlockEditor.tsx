'use client'

type Preview = { kind: 'iframe' | 'video' | 'link'; src: string; provider: string }

type Props = {
  value: string
  title: string
  uploading: boolean
  onLinkChange: (value: string) => void
  onUpload: (files: FileList | null) => void
  onClear: () => void
}

function previewFor(value: string): Preview | null {
  const raw = value.trim()
  if (!raw) return null
  if (raw.startsWith('/api/vitrinas/assets/')) return { kind: 'video', src: raw, provider: 'Video subido' }

  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')
    const parts = url.pathname.split('/').filter(Boolean)

    if (host === 'youtu.be' && parts[0]) return { kind: 'iframe', src: `https://www.youtube.com/embed/${parts[0]}`, provider: 'YouTube' }
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      const id = url.searchParams.get('v') || (parts[0] === 'shorts' || parts[0] === 'embed' ? parts[1] : '')
      if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}`, provider: 'YouTube' }
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = parts.find(part => /^\d+$/.test(part))
      if (id) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}`, provider: 'Vimeo' }
    }
    if (host === 'drive.google.com') {
      const d = parts.indexOf('d')
      const id = d >= 0 ? parts[d + 1] : url.searchParams.get('id')
      if (id) return { kind: 'iframe', src: `https://drive.google.com/file/d/${id}/preview`, provider: 'Google Drive' }
    }
    if (/\.(mp4|webm|ogg|mov)$/i.test(url.pathname)) return { kind: 'video', src: raw, provider: 'Video directo' }
    return { kind: 'link', src: raw, provider: 'Enlace externo' }
  } catch {
    return null
  }
}

export default function VideoBlockEditor({ value, title, uploading, onLinkChange, onUpload, onClear }: Props) {
  const preview = previewFor(value)
  const uploaded = value.startsWith('/api/vitrinas/assets/')

  return (
    <div className="mt-3 rounded-xl border border-red-100 bg-white p-4">
      <div>
        <p className="font-bold text-gray-800">🎬 Agregar video</p>
        <p className="mt-1 text-xs text-gray-500">Sube un archivo o pega un enlace de YouTube, Vimeo, Google Drive o un video directo.</p>
      </div>

      <div className="mt-3 grid grid-cols-1 items-center gap-3 lg:grid-cols-[180px_auto_1fr]">
        <label className={`flex cursor-pointer items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold text-white ${uploading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}>
          {uploading ? 'Subiendo…' : '⬆️ Subir video'}
          <input
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            className="hidden"
            disabled={uploading}
            onChange={event => {
              onUpload(event.target.files)
              event.currentTarget.value = ''
            }}
          />
        </label>
        <span className="text-center text-xs font-bold uppercase text-gray-400">o</span>
        <input
          value={uploaded ? '' : value}
          onChange={event => onLinkChange(event.target.value)}
          placeholder="Pega el enlace del video"
          inputMode="url"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      {uploaded && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <span>✅ Video subido y vinculado al bloque.</span>
          <button type="button" onClick={onClear} className="font-bold text-red-600 hover:underline">Quitar video</button>
        </div>
      )}

      {!preview && value && <p className="mt-3 text-xs text-amber-700">No se pudo reconocer el enlace.</p>}
      {preview?.kind === 'iframe' && (
        <div className="mx-auto mt-4 max-w-3xl overflow-hidden rounded-xl border bg-black">
          <iframe src={preview.src} title={title || preview.provider} className="aspect-video w-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>
      )}
      {preview?.kind === 'video' && (
        <div className="mx-auto mt-4 max-w-3xl overflow-hidden rounded-xl border bg-black">
          <video controls playsInline preload="metadata" className="aspect-video w-full object-contain" src={preview.src} />
        </div>
      )}
      {preview?.kind === 'link' && (
        <a href={preview.src} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
          <span className="truncate">🔗 {preview.src}</span><span>Abrir</span>
        </a>
      )}
    </div>
  )
}
