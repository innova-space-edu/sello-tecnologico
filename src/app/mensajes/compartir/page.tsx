'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type Perfil = { id: string; full_name?: string | null; email?: string | null; role?: string | null; curso?: string | null }

function cleanName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120)
}

export default function CompartirPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [receiverId, setReceiverId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [enlace, setEnlace] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('id, full_name, email, role, curso').neq('id', user.id).order('full_name')
      setUsuarios(data ?? [])
    }
    init()
  }, [])

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!receiverId || !titulo.trim()) return
    setLoading(true)
    setStatus('')

    const { data: { user } } = await supabase.auth.getUser()
    let fileUrl = ''
    if (user && file) {
      const path = `mensajes/${user.id}/${receiverId}/${Date.now()}-${cleanName(file.name)}`
      const { error } = await supabase.storage.from('evidencias').upload(path, file, { upsert: false })
      if (error) {
        setLoading(false)
        setStatus(error.message)
        return
      }
      const { data } = supabase.storage.from('evidencias').getPublicUrl(path)
      fileUrl = data.publicUrl
    }

    const contenido = [
      '📚 Trabajo escolar compartido',
      `Título: ${titulo.trim()}`,
      detalle.trim() ? `Detalle: ${detalle.trim()}` : '',
      enlace.trim() ? `Enlace: ${enlace.trim()}` : '',
      file && fileUrl ? `Archivo: ${file.name}` : '',
      file && fileUrl ? `Abrir archivo: ${fileUrl}` : '',
    ].filter(Boolean).join('\n')

    const res = await fetch('/api/mensajes/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId, content: contenido }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setStatus(json.error ?? json.warning ?? 'No se pudo enviar.')
      return
    }

    setTitulo('')
    setDetalle('')
    setEnlace('')
    setFile(null)
    setStatus('Compartido correctamente.')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <Link href="/mensajes" className="text-blue-600 text-sm hover:underline">← Volver</Link>
        <h1 className="text-2xl font-bold text-blue-900 mt-2">Compartir trabajo</h1>
        <p className="text-gray-500 text-sm mt-1 mb-6">Comparte información, enlaces o archivos de clase.</p>

        <form onSubmit={enviar} className="max-w-2xl bg-white rounded-xl shadow-sm p-6 space-y-4">
          <select required value={receiverId} onChange={e => setReceiverId(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 text-sm">
            <option value="">Selecciona destinatario</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name ?? u.email} · {u.role}{u.curso ? ` · ${u.curso}` : ''}</option>)}
          </select>
          <input required value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título" className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          <textarea value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Información" rows={5} className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          <input value={enlace} onChange={e => setEnlace(e.target.value)} placeholder="Enlace opcional" className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileRef.current?.click()} className="w-full border border-dashed rounded-xl p-4 text-blue-700 font-semibold">{file ? file.name : '📎 Seleccionar archivo'}</button>
          {status && <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">{status}</div>}
          <button disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">{loading ? 'Enviando…' : 'Compartir'}</button>
        </form>
      </main>
    </div>
  )
}
