'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CompartirFormulario({ slug }: { slug: string }) {
  const pathname = usePathname()
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const surveyId = pathname.split('/').filter(Boolean)[1] ?? ''

  useEffect(() => {
    setUrl(`${window.location.origin}/formularios/${slug}`)
  }, [slug])

  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const qr = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=280`

  return (
    <section className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="font-bold text-blue-900 mb-3">🔗 Compartir encuesta</h2>
      <p className="text-sm text-gray-500 mb-3">Comparte el enlace o proyecta el código QR para que otras personas respondan.</p>
      <div className="flex gap-2">
        <input readOnly value={url} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50" />
        <button type="button" onClick={copy} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">{copied ? 'Copiado ✓' : 'Copiar link'}</button>
      </div>
      {surveyId && (
        <Link href={`/encuestas/estudiantes/${surveyId}`} className="mt-4 block text-center bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
          👥 Gestionar estudiantes del curso
        </Link>
      )}
      {url && (
        <div className="mt-4 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Código QR de la encuesta" className="w-56 h-56 border border-gray-200 rounded-lg" />
          <a href={qr} target="_blank" rel="noreferrer" className="text-blue-600 text-sm mt-2 hover:underline">Abrir QR para imprimir</a>
        </div>
      )}
    </section>
  )
}
