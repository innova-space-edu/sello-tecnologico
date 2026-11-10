'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function OnlineSurveyShare({ slug, published }: { slug: string; published: boolean }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { setUrl(window.location.origin + '/formularios-online/' + slug) }, [slug])
  const qr = 'https://quickchart.io/qr?size=320&margin=2&text=' + encodeURIComponent(url)

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { setCopied(false) }
  }

  return <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-blue-950">🔗 Enlace público y código QR</h2>
    {published
      ? <p className="mt-2 text-sm text-slate-600">Comparte la dirección o el QR. Cualquier persona puede responder sin crear una cuenta.</p>
      : <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">El enlace quedará disponible cuando administración apruebe la encuesta. El QR se habilitará al publicarse.</p>}
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <input readOnly value={url} aria-label="Dirección de la encuesta"
        className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-700" />
      <button type="button" onClick={copy} disabled={!url} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
        {copied ? '✓ Copiado' : 'Copiar enlace'}
      </button>
    </div>
    {published && url && <div className="mt-4 flex flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Código QR para responder la encuesta pública" width={256} height={256} className="aspect-square rounded-xl border border-slate-200 bg-white p-2" />
      <div className="flex flex-wrap justify-center gap-3 text-sm font-bold text-blue-700">
        <Link href={'/formularios-online/' + slug} target="_blank" rel="noopener noreferrer" className="hover:underline">Abrir formulario</Link>
        <a href={qr} target="_blank" rel="noopener noreferrer" className="hover:underline">Abrir QR para imprimir</a>
      </div>
      <p className="text-xs text-slate-500">El QR utiliza un generador externo y contiene exclusivamente la dirección pública de esta encuesta.</p>
    </div>}
  </section>
}
