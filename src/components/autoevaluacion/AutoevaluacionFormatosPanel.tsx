'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DEFAULT_AUTOEVALUACION_FORMAT_ID, AutoevaluacionQuestion } from '@/lib/autoevaluacion'

type Course = { id: string; name: string }
type Student = { id: string; full_name?: string | null; email?: string | null; curso?: string | null }

type Format = {
  id: string
  title: string
  description?: string | null
  questions: AutoevaluacionQuestion[]
  source?: string | null
  created_at?: string | null
  isDefault?: boolean
}

type Props = {
  formats: Format[]
  courses: Course[]
  students: Student[]
  canManageFormats: boolean
}

export default function AutoevaluacionFormatosPanel({ formats, courses, students, canManageFormats }: Props) {
  const [selectedFormatId, setSelectedFormatId] = useState(formats[0]?.id ?? DEFAULT_AUTOEVALUACION_FORMAT_ID)
  const [target, setTarget] = useState<'course' | 'student'>('course')
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [studentId, setStudentId] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedFormat = useMemo(() => formats.find(format => format.id === selectedFormatId) ?? formats[0], [formats, selectedFormatId])
  const selectedCourseName = courses.find(course => course.id === courseId)?.name ?? ''
  const filteredStudents = useMemo(() => {
    if (target !== 'student') return students
    if (!selectedCourseName) return students
    return students.filter(student => !student.curso || student.curso === selectedCourseName)
  }, [students, target, selectedCourseName])

  const notify = async () => {
    if (!selectedFormat) return
    setError('')
    setMessage('')
    if (target === 'course' && !courseId) {
      setError('Selecciona un curso para enviar la autoevaluación.')
      return
    }
    if (target === 'student' && !studentId) {
      setError('Selecciona un estudiante para enviar la autoevaluación.')
      return
    }

    setSending(true)
    const response = await fetch(`/api/autoevaluacion/formatos/${selectedFormat.id}/notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, course_id: courseId, student_id: studentId }),
    })
    const data = await response.json().catch(() => ({}))
    setSending(false)

    if (!response.ok) {
      setError(data.error ?? 'No fue posible enviar la notificación.')
      return
    }
    setMessage(`Notificación enviada a ${data.count ?? 0} estudiante${data.count === 1 ? '' : 's'}${data.target_label ? ` · ${data.target_label}` : ''}.`)
  }

  return (
    <section id="formatos-autoevaluacion" className="max-w-5xl mx-auto mb-5 bg-white rounded-2xl shadow-sm p-5 lg:p-6 border border-blue-100 scroll-mt-24">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Formatos de autoevaluación</p>
          <h2 className="text-xl font-bold text-blue-900 mt-1">Usar, copiar, crear y enviar formatos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Los formatos guardados aparecerán aquí mismo. Desde esta sección puedes reutilizarlos y enviarlos por notificación a un curso o a un estudiante.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Link href="/autoevaluacion/formatos/copiar" className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-4 py-2.5 rounded-xl text-sm font-semibold text-center">
            Editar copia del formato actual
          </Link>
          <Link href="/autoevaluacion/formatos/nuevo" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold text-center">
            Crear nuevo formato
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          {formats.map(format => (
            <article key={format.id} className={`border rounded-xl p-4 ${selectedFormatId === format.id ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {format.isDefault && <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">Actual</span>}
                    {!format.isDefault && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-semibold">Guardado</span>}
                    <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-semibold">{format.questions.length} pregunta{format.questions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <h3 className="font-bold text-gray-800">{format.title}</h3>
                  {format.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{format.description}</p>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={format.isDefault ? '/autoevaluacion#autoevaluacion-actual' : `/autoevaluacion?formato=${format.id}#autoevaluacion-actual`}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 text-xs font-semibold">
                  Responder
                </Link>
                <button type="button" onClick={() => setSelectedFormatId(format.id)} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg px-3 py-2 text-xs font-semibold">
                  Seleccionar para enviar
                </button>
                {canManageFormats && !format.isDefault && (
                  <Link href={`/autoevaluacion/formatos/${format.id}/editar`} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg px-3 py-2 text-xs font-semibold">
                    Editar
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        {canManageFormats && (
          <aside className="border border-blue-100 bg-blue-50 rounded-xl p-4 h-fit">
            <h3 className="font-bold text-blue-900">📢 Enviar por notificación</h3>
            <p className="text-xs text-blue-900/70 mt-1">El estudiante recibirá el aviso en “Mis avisos”.</p>

            <div className="mt-4 space-y-3">
              <label className="text-xs font-semibold text-blue-900">Formato
                <select value={selectedFormatId} onChange={e => setSelectedFormatId(e.target.value)} className="mt-1 w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm">
                  {formats.map(format => <option key={format.id} value={format.id}>{format.title}</option>)}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTarget('course')} className={`rounded-lg px-3 py-2 text-xs font-semibold border ${target === 'course' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200'}`}>
                  Por curso
                </button>
                <button type="button" onClick={() => setTarget('student')} className={`rounded-lg px-3 py-2 text-xs font-semibold border ${target === 'student' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200'}`}>
                  Por estudiante
                </button>
              </div>

              <label className="text-xs font-semibold text-blue-900">Curso
                <select value={courseId} onChange={e => setCourseId(e.target.value)} className="mt-1 w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecciona curso</option>
                  {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                </select>
              </label>

              {target === 'student' && (
                <label className="text-xs font-semibold text-blue-900">Estudiante
                  <select value={studentId} onChange={e => setStudentId(e.target.value)} className="mt-1 w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Selecciona estudiante</option>
                    {filteredStudents.map(student => (
                      <option key={student.id} value={student.id}>{student.full_name ?? student.email ?? 'Sin nombre'}{student.curso ? ` · ${student.curso}` : ''}</option>
                    ))}
                  </select>
                </label>
              )}

              <button type="button" onClick={notify} disabled={sending} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl px-4 py-2.5 text-sm font-semibold">
                {sending ? 'Enviando…' : 'Enviar notificación'}
              </button>
              {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">⚠️ {error}</p>}
              {message && <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">✅ {message}</p>}
            </div>
          </aside>
        )}
      </div>
    </section>
  )
}
