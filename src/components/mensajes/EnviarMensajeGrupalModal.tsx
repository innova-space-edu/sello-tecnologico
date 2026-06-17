'use client'

import { useMemo, useState } from 'react'

type Usuario = {
  id: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  curso?: string | null
}

type Props = {
  usuarios: Usuario[]
  currentUser: Usuario | null
  onClose?: () => void
  onSent?: () => void
}

type TargetType = 'all' | 'course' | 'students' | 'staff' | 'selected'

const MAX_FILES = 5
const MAX_FILE_SIZE = 25 * 1024 * 1024

function userName(user: Usuario) {
  return user.full_name || user.email || 'Usuario sin nombre'
}

export default function EnviarMensajeGrupalModal({ usuarios, currentUser, onClose, onSent }: Props) {
  const [targetType, setTargetType] = useState<TargetType>('course')
  const [courseName, setCourseName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const close = onClose ?? (() => window.location.assign('/mensajes'))
  const done = onSent ?? (() => window.location.assign('/mensajes'))

  const courses = useMemo(() => {
    return Array.from(
      new Set(
        usuarios
          .map(user => user.curso?.trim())
          .filter((curso): curso is string => Boolean(curso))
      )
    ).sort((a, b) => a.localeCompare(b, 'es'))
  }, [usuarios])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return usuarios

    return usuarios.filter(user =>
      userName(user).toLowerCase().includes(query) ||
      String(user.email ?? '').toLowerCase().includes(query) ||
      String(user.curso ?? '').toLowerCase().includes(query) ||
      String(user.role ?? '').toLowerCase().includes(query)
    )
  }, [usuarios, search])

  const recipients = useMemo(() => {
    if (targetType === 'all') return usuarios
    if (targetType === 'course') return usuarios.filter(user => user.curso?.trim() === courseName)
    if (targetType === 'students') return usuarios.filter(user => user.role === 'estudiante')
    if (targetType === 'staff') return usuarios.filter(user => ['docente', 'coordinador', 'utp', 'admin'].includes(String(user.role)))
    if (targetType === 'selected') return usuarios.filter(user => selectedIds.includes(user.id))
    return []
  }, [usuarios, targetType, courseName, selectedIds])

  const toggleUser = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(item => item !== id))
  }

  const handleFiles = (fileList: FileList | null) => {
    setError('')
    const selected = Array.from(fileList ?? [])

    if (selected.length > MAX_FILES) {
      setError(`Puedes adjuntar máximo ${MAX_FILES} archivos.`)
      return
    }

    const tooLarge = selected.find(file => file.size > MAX_FILE_SIZE)
    if (tooLarge) {
      setError(`El archivo "${tooLarge.name}" supera los 25 MB.`)
      return
    }

    setFiles(selected)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!currentUser || !['admin', 'docente'].includes(String(currentUser.role))) {
      setError('Solo docentes y administradores pueden enviar mensajes grupales.')
      return
    }

    if (!content.trim()) {
      setError('Debes escribir un mensaje.')
      return
    }

    if (recipients.length === 0) {
      setError('Debes seleccionar al menos un destinatario.')
      return
    }

    const confirmed = window.confirm(`¿Enviar este mensaje a ${recipients.length} destinatario(s)?`)
    if (!confirmed) return

    const formData = new FormData()
    formData.append('target_type', targetType)
    formData.append('course_name', courseName)
    formData.append('selected_user_ids', JSON.stringify(selectedIds))
    formData.append('title', title)
    formData.append('content', content)
    files.forEach(file => formData.append('files', file))

    setSending(true)
    const response = await fetch('/api/mensajes/grupal', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json().catch(() => ({}))
    setSending(false)

    if (!response.ok) {
      setError(data.error ?? 'No fue posible enviar el mensaje grupal.')
      return
    }

    setSuccess(`Mensaje enviado a ${data.total_recipients} destinatario(s).`)
    setTitle('')
    setContent('')
    setSelectedIds([])
    setFiles([])

    setTimeout(done, 900)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Mensajes</p>
            <h2 className="text-xl font-bold text-blue-900 mt-1">Enviar mensaje grupal</h2>
            <p className="text-sm text-gray-500 mt-1">
              El sistema enviará un mensaje individual a cada destinatario seleccionado.
            </p>
          </div>
          <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto p-6 space-y-5">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3">1. Destinatarios</h3>

              <div className="space-y-2 text-sm">
                {([
                  ['all', 'Todos los usuarios'],
                  ['course', 'Curso completo'],
                  ['students', 'Solo estudiantes'],
                  ['staff', 'Solo docentes/equipo'],
                  ['selected', 'Elegir usuarios manualmente'],
                ] as [TargetType, string][]).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 p-2.5 cursor-pointer hover:bg-blue-50">
                    <input type="radio" name="targetType" checked={targetType === value} onChange={() => setTargetType(value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              {targetType === 'course' && (
                <label className="block text-sm font-medium text-gray-700 mt-4">
                  Curso
                  <select
                    value={courseName}
                    onChange={event => setCourseName(event.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white"
                  >
                    <option value="">Selecciona un curso</option>
                    {courses.map(course => <option key={course} value={course}>{course}</option>)}
                  </select>
                </label>
              )}

              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm text-blue-800 font-semibold">
                Destinatarios seleccionados: {recipients.length}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3">2. Mensaje</h3>

              <label className="block text-sm font-medium text-gray-700">
                Asunto opcional
                <input
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white"
                  placeholder="Ej: Recordatorio proyecto STEAM"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700 mt-3">
                Mensaje *
                <textarea
                  rows={6}
                  value={content}
                  onChange={event => setContent(event.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white"
                  placeholder="Escribe el mensaje para el curso o grupo seleccionado"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700 mt-3">
                Archivos adjuntos
                <input
                  type="file"
                  multiple
                  onChange={event => handleFiles(event.target.files)}
                  className="mt-1 w-full text-sm"
                />
              </label>

              <p className="text-xs text-gray-400 mt-1">
                Puedes adjuntar cualquier formato. Máximo 5 archivos y 25 MB por archivo.
              </p>

              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map(file => (
                    <p key={`${file.name}-${file.size}`} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1">
                      📎 {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>

          {targetType === 'selected' && (
            <section className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h3 className="font-semibold text-gray-800">Seleccionar usuarios</h3>
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                  placeholder="Buscar por nombre, correo, curso o rol"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {filteredUsers.map(user => (
                  <label key={user.id} className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm hover:bg-blue-50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedIds.includes(user.id)}
                      onChange={event => toggleUser(user.id, event.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-gray-800 block">{userName(user)}</span>
                      <span className="text-xs text-gray-400">{user.role ?? 'sin rol'} · {user.curso ?? 'sin curso'}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">⚠️ {error}</div>}
          {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">✅ {success}</div>}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={close} className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl px-5 py-2.5 text-sm font-semibold">
              Cancelar
            </button>
            <button
              disabled={sending || recipients.length === 0 || !content.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl px-5 py-2.5 text-sm font-semibold"
            >
              {sending ? 'Enviando…' : `Enviar a ${recipients.length}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
