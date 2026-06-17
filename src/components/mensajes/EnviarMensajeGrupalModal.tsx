'use client'

import { useMemo, useState } from 'react'

type Usuario = { id: string; full_name?: string | null; email?: string | null; role?: string | null; curso?: string | null }
type Props = { usuarios: Usuario[]; currentUser: Usuario | null; onClose: () => void; onSent: () => void }
type TargetType = 'all' | 'course' | 'students' | 'staff' | 'selected'

function userName(user: Usuario) { return user.full_name || user.email || 'Usuario sin nombre' }

export default function EnviarMensajeGrupalModal({ usuarios, currentUser, onClose, onSent }: Props) {
  const [targetType, setTargetType] = useState<TargetType>('course')
  const [courseName, setCourseName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const courses = useMemo(() => Array.from(new Set(usuarios.map(user => user.curso?.trim()).filter((curso): curso is string => Boolean(curso)))).sort((a, b) => a.localeCompare(b, 'es')), [usuarios])
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return usuarios
    return usuarios.filter(user => userName(user).toLowerCase().includes(query) || String(user.email ?? '').toLowerCase().includes(query) || String(user.curso ?? '').toLowerCase().includes(query))
  }, [usuarios, search])

  const recipients = useMemo(() => {
    if (targetType === 'all') return usuarios
    if (targetType === 'course') return usuarios.filter(user => user.curso?.trim() === courseName)
    if (targetType === 'students') return usuarios.filter(user => user.role === 'estudiante')
    if (targetType === 'staff') return usuarios.filter(user => ['docente', 'coordinador', 'utp', 'admin'].includes(String(user.role)))
    if (targetType === 'selected') return usuarios.filter(user => selectedIds.includes(user.id))
    return []
  }, [usuarios, targetType, courseName, selectedIds])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(''); setSuccess('')
    if (!currentUser || !['admin', 'docente'].includes(String(currentUser.role))) return setError('Solo docentes y administradores pueden enviar mensajes grupales.')
    if (!content.trim()) return setError('Debes escribir un mensaje.')
    if (recipients.length === 0) return setError('Debes seleccionar al menos un destinatario.')
    if (!window.confirm(`Enviar mensaje a ${recipients.length} destinatario(s)?`)) return

    setSending(true)
    const response = await fetch('/api/mensajes/grupal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: targetType, course_name: courseName, selected_user_ids: selectedIds, title, content }),
    })
    const data = await response.json().catch(() => ({}))
    setSending(false)
    if (!response.ok) return setError(data.error ?? 'No fue posible enviar el mensaje grupal.')
    setSuccess(`Mensaje enviado a ${data.total_recipients} destinatario(s).`)
    setTimeout(onSent, 900)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div><p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Mensajes</p><h2 className="text-xl font-bold text-blue-900 mt-1">Enviar mensaje grupal</h2><p className="text-sm text-gray-500 mt-1">Disponible solo para docentes y administradores.</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={submit} className="overflow-y-auto p-6 space-y-5">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Destinatarios</h3>
              <div className="space-y-2 text-sm">
                {([['all','Todos'],['course','Curso completo'],['students','Estudiantes'],['staff','Docentes/equipo'],['selected','Elegir usuarios']] as [TargetType,string][]).map(([value,label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 p-2.5 cursor-pointer hover:bg-blue-50"><input type="radio" name="targetType" checked={targetType === value} onChange={() => setTargetType(value)} /><span>{label}</span></label>
                ))}
              </div>
              {targetType === 'course' && <label className="block text-sm font-medium text-gray-700 mt-4">Curso<select value={courseName} onChange={event => setCourseName(event.target.value)} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white"><option value="">Selecciona</option>{courses.map(course => <option key={course} value={course}>{course}</option>)}</select></label>}
              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm text-blue-800 font-semibold">Destinatarios: {recipients.length}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Mensaje</h3>
              <label className="block text-sm font-medium text-gray-700">Asunto opcional<input value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white" /></label>
              <label className="block text-sm font-medium text-gray-700 mt-3">Mensaje *<textarea rows={6} value={content} onChange={event => setContent(event.target.value)} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white" /></label>
            </div>
          </section>
          {targetType === 'selected' && <section className="bg-white border border-gray-200 rounded-xl p-4"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3"><h3 className="font-semibold text-gray-800">Seleccionar usuarios</h3><input value={search} onChange={event => setSearch(event.target.value)} className="border border-gray-300 rounded-xl px-3 py-2 text-sm" placeholder="Buscar" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto">{filteredUsers.map(user => <label key={user.id} className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm hover:bg-blue-50 cursor-pointer"><input type="checkbox" className="mt-1" checked={selectedIds.includes(user.id)} onChange={event => setSelectedIds(prev => event.target.checked ? [...prev, user.id] : prev.filter(item => item !== user.id))} /><span><span className="font-medium text-gray-800 block">{userName(user)}</span><span className="text-xs text-gray-400">{user.role ?? 'sin rol'} · {user.curso ?? 'sin curso'}</span></span></label>)}</div></section>}
          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">⚠️ {error}</div>}
          {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">✅ {success}</div>}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4"><button type="button" onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl px-5 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={sending || recipients.length === 0 || !content.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl px-5 py-2.5 text-sm font-semibold">{sending ? 'Enviando…' : `Enviar a ${recipients.length}`}</button></div>
        </form>
      </div>
    </div>
  )
}
