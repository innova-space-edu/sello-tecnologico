'use client'

import { createClient } from '@/lib/supabase'
import { useRef, useState } from 'react'

type Props = {
  receiverId: string
  disabled?: boolean
  onSent?: () => void | Promise<void>
  onWarning?: (message: string) => void
}

const MAX_FILE_SIZE = 25 * 1024 * 1024

function safeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
}

function fileIcon(file: File) {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('image/')) return '🖼️'
  if (file.type.startsWith('video/')) return '🎥'
  if (name.endsWith('.pdf')) return '📄'
  if (name.endsWith('.doc') || name.endsWith('.docx')) return '📝'
  if (name.endsWith('.ppt') || name.endsWith('.pptx')) return '📊'
  if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) return '📈'
  if (name.endsWith('.zip') || name.endsWith('.rar')) return '🗂️'
  return '📎'
}

export default function ShareSchoolFileButton({ receiverId, disabled, onSent, onWarning }: Props) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || disabled || uploading) return

    if (file.size > MAX_FILE_SIZE) {
      onWarning?.('El archivo supera 25 MB. Usa un enlace de Drive o comprime el archivo antes de compartirlo.')
      return
    }

    setUploading(true)
    onWarning?.('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploading(false)
      onWarning?.('Debes iniciar sesión para compartir archivos.')
      return
    }

    const cleanName = safeFileName(file.name)
    const path = `mensajes/${user.id}/${receiverId}/${Date.now()}-${cleanName}`

    const { error: uploadError } = await supabase.storage
      .from('evidencias')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      setUploading(false)
      onWarning?.('No se pudo subir el archivo: ' + uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    const content = [
      `${fileIcon(file)} Archivo compartido para trabajo escolar`,
      `Nombre: ${file.name}`,
      `Tipo: ${file.type || 'archivo'}`,
      `Abrir archivo: ${publicUrl}`,
    ].join('\n')

    const response = await fetch('/api/mensajes/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId, content }),
    })

    const data = await response.json().catch(() => ({}))
    setUploading(false)

    if (!response.ok || data.status === 'held_for_review') {
      onWarning?.(data.warning ?? data.error ?? 'El archivo fue subido, pero el aviso no pudo enviarse como mensaje.')
      return
    }

    if (data.warning) onWarning?.(data.warning)
    await onSent?.()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFile}
        accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.rar,.js,.ts,.html,.css,.py"
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className="border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
        title="Compartir archivo, evidencia o trabajo escolar"
      >
        {uploading ? 'Subiendo…' : '📎 Archivo'}
      </button>
    </>
  )
}
