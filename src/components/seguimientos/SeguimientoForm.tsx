'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

type FollowupItem = {
  criterion: string
  result: string
  score: string
  comment: string
}

type ExistingPhoto = {
  id: string
  storage_path: string
  file_name: string
}

type Course = {
  id: string
  name: string
  level?: string | null
  area?: string | null
  year?: number | null
}

type Project = {
  id: string
  title: string
  course_id?: string | null
  asignaturas?: string[] | null
  courses?: { name?: string | null } | null
}

type StudentProfile = {
  id: string
  full_name?: string | null
  email?: string | null
  curso?: string | null
  role?: string | null
}

type CourseMemberRow = {
  user_id: string
  profiles?: StudentProfile | StudentProfile[] | null
}

const ESTADOS = ['Pendiente', 'En proceso', 'Logrado', 'Requiere apoyo']
const ASIGNATURAS = [
  'Tecnología', 'Ciencias para la Ciudadanía', 'Ciencias Naturales', 'Física',
  'Química', 'Biología', 'Matemática', 'Lengua y Literatura', 'Historia',
  'Artes Visuales', 'Educación Física', 'Orientación', 'Otra',
]

const criteriosIniciales: FollowupItem[] = [
  { criterion: 'Avance respecto del objetivo de la sesión', result: 'En proceso', score: '', comment: '' },
  { criterion: 'Organización y participación del equipo', result: 'En proceso', score: '', comment: '' },
  { criterion: 'Uso de evidencias y registro del proceso', result: 'En proceso', score: '', comment: '' },
]

function generarTicket() {
  const ahora = new Date()
  const fecha = ahora.toISOString().slice(0, 10).replaceAll('-', '')
  const hora = ahora.toTimeString().slice(0, 8).replaceAll(':', '')
  return `SEG-${fecha}-${hora}`
}

function normalizarNombreArchivo(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
}

export default function SeguimientoForm({ sessionId }: { sessionId?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [role, setRole] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([])
  const [items, setItems] = useState<FollowupItem[]>(criteriosIniciales)
  const [form, setForm] = useState({
    followup_date: new Date().toISOString().slice(0, 10),
    course_id: '',
    project_id: '',
    subject: 'Tecnología',
    ticket: generarTicket(),
    observations: '',
    feedback: '',
    overall_status: 'En proceso',
    score: '',
  })

  const puedeGestionar = ['docente', 'admin', 'coordinador', 'utp'].includes(role)

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      setError('')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      setTeacherId(user.id)

      const { data: perfil, error: perfilError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (perfilError) {
        setError('No fue posible verificar tu rol de usuario.')
        setLoading(false)
        return
      }

      const rol = perfil?.role ?? ''
      setRole(rol)
      if (!['docente', 'admin', 'coordinador', 'utp'].includes(rol)) {
        setError('Esta ficha solo puede ser creada o editada por docentes y roles directivos.')
        setLoading(false)
        return
      }

      const [{ data: cursos }, { data: proyectos }] = await Promise.all([
        supabase.from('courses').select('id, name, level, area, year').order('name'),
        supabase.from('projects').select('id, title, course_id, asignaturas, courses(name)').order('title'),
      ])
      setCourses((cursos ?? []) as Course[])
      setProjects((proyectos ?? []) as unknown as Project[])

      if (sessionId) {
        const [sessionResult, participantResult, itemResult, photoResult] = await Promise.all([
          supabase.from('project_followups').select('*').eq('id', sessionId).single(),
          supabase.from('followup_participants').select('user_id').eq('followup_id', sessionId),
          supabase.from('followup_items').select('*').eq('followup_id', sessionId).order('sort_order'),
          supabase.from('followup_photos').select('id, storage_path, file_name').eq('followup_id', sessionId).order('created_at'),
        ])

        if (sessionResult.error || !sessionResult.data) {
          setError('No fue posible cargar este seguimiento o no tienes permiso para editarlo.')
          setLoading(false)
          return
        }

        const session = sessionResult.data
        setTeacherId(session.teacher_id)
        setForm({
          followup_date: session.followup_date,
          course_id: session.course_id,
          project_id: session.project_id,
          subject: session.subject,
          ticket: session.ticket,
          observations: session.observations ?? '',
          feedback: session.feedback ?? '',
          overall_status: session.overall_status ?? 'En proceso',
          score: session.score === null || session.score === undefined ? '' : String(session.score),
        })
        setSelectedStudents((participantResult.data ?? []).map(row => row.user_id))
        setItems((itemResult.data ?? []).length > 0
          ? (itemResult.data ?? []).map(row => ({
              criterion: row.criterion,
              result: row.result,
              score: row.score === null || row.score === undefined ? '' : String(row.score),
              comment: row.comment ?? '',
            }))
          : criteriosIniciales)
        setExistingPhotos(photoResult.data ?? [])
      }

      setLoading(false)
    }

    cargar()
  }, [router, sessionId, supabase])

  useEffect(() => {
    if (!form.course_id || !puedeGestionar) return

    const cargarEstudiantes = async () => {
      const { data, error: membersError } = await supabase
        .from('course_members')
        .select('user_id, profiles(id, full_name, email, curso, role)')
        .eq('course_id', form.course_id)

      if (membersError) {
        setError('No fue posible cargar los estudiantes del curso seleccionado.')
        return
      }

      const rows = (data ?? []) as unknown as CourseMemberRow[]
      const lista = rows
        .map(row => Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)
        .filter((profile): profile is StudentProfile => Boolean(profile && profile.role === 'estudiante'))
        .sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? '', 'es'))
      setStudents(lista)
    }

    cargarEstudiantes()
  }, [form.course_id, puedeGestionar, supabase])

  const newPhotoPreviews = useMemo(
    () => newPhotos.map(file => ({ file, url: URL.createObjectURL(file) })),
    [newPhotos]
  )

  useEffect(() => {
    return () => {
      newPhotoPreviews.forEach(preview => URL.revokeObjectURL(preview.url))
    }
  }, [newPhotoPreviews])

  const projectsByCourse = useMemo(
    () => projects.filter(project => !form.course_id || project.course_id === form.course_id),
    [projects, form.course_id]
  )

  const selectedProject = projects.find(project => project.id === form.project_id)
  const subjectSuggestions = Array.from(new Set([
    ...ASIGNATURAS,
    ...((selectedProject?.asignaturas ?? []) as string[]),
  ]))

  const seleccionarCurso = (courseId: string) => {
    setForm(prev => ({ ...prev, course_id: courseId, project_id: '' }))
    setSelectedStudents([])
  }

  const agregarFotos = (files: FileList | null) => {
    if (!files) return
    const nuevas = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name}: solo se permiten imágenes.`)
        return false
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name}: supera el máximo de 10 MB.`)
        return false
      }
      return true
    })
    setNewPhotos(prev => [...prev, ...nuevas])
  }

  const eliminarFotoNueva = (index: number) => {
    setNewPhotos(prev => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const eliminarFotoExistente = async (photo: ExistingPhoto) => {
    if (!confirm(`¿Eliminar la fotografía ${photo.file_name}?`)) return
    const { error: storageError } = await supabase.storage.from('seguimiento-fotos').remove([photo.storage_path])
    if (storageError) {
      alert('No fue posible eliminar el archivo: ' + storageError.message)
      return
    }
    const { error: metadataError } = await supabase.from('followup_photos').delete().eq('id', photo.id)
    if (metadataError) {
      alert('La imagen se eliminó del almacenamiento, pero no su registro: ' + metadataError.message)
      return
    }
    setExistingPhotos(prev => prev.filter(current => current.id !== photo.id))
  }

  const actualizarItem = (index: number, patch: Partial<FollowupItem>) => {
    setItems(prev => prev.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item))
  }

  const eliminarItem = (index: number) => {
    setItems(prev => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const agregarItem = () => {
    setItems(prev => [...prev, { criterion: '', result: 'En proceso', score: '', comment: '' }])
  }

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!userId || !puedeGestionar) return
    if (!form.course_id || !form.project_id || !form.subject.trim() || !form.ticket.trim()) {
      setError('Completa la fecha, ticket, curso, asignatura y proyecto.')
      return
    }
    if (selectedStudents.length === 0) {
      setError('Selecciona al menos un estudiante para asignar el seguimiento.')
      return
    }

    const validItems = items.filter(item => item.criterion.trim())
    if (validItems.length === 0) {
      setError('Agrega al menos un criterio en la tabla de evaluación.')
      return
    }

    setSaving(true)
    const payload = {
      teacher_id: sessionId ? teacherId : userId,
      followup_date: form.followup_date,
      course_id: form.course_id,
      project_id: form.project_id,
      subject: form.subject.trim(),
      ticket: form.ticket.trim(),
      observations: form.observations.trim() || null,
      feedback: form.feedback.trim() || null,
      overall_status: form.overall_status,
      score: form.score === '' ? null : Number(form.score),
    }

    let followupId = sessionId
    if (sessionId) {
      const { error: updateError } = await supabase
        .from('project_followups')
        .update(payload)
        .eq('id', sessionId)
      if (updateError) {
        setError('No fue posible actualizar el seguimiento: ' + updateError.message)
        setSaving(false)
        return
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('project_followups')
        .insert(payload)
        .select('id')
        .single()
      if (insertError || !data) {
        setError('No fue posible crear el seguimiento: ' + (insertError?.message ?? 'respuesta vacía'))
        setSaving(false)
        return
      }
      followupId = data.id
    }

    if (!followupId) {
      setError('No fue posible obtener el identificador del seguimiento.')
      setSaving(false)
      return
    }

    if (sessionId) {
      const [deleteParticipants, deleteItems] = await Promise.all([
        supabase.from('followup_participants').delete().eq('followup_id', followupId),
        supabase.from('followup_items').delete().eq('followup_id', followupId),
      ])
      if (deleteParticipants.error || deleteItems.error) {
        setError('No fue posible renovar los participantes o criterios del seguimiento.')
        setSaving(false)
        return
      }
    }

    const { error: participantsError } = await supabase.from('followup_participants').insert(
      selectedStudents.map(studentId => ({ followup_id: followupId, user_id: studentId }))
    )
    if (participantsError) {
      setError('No fue posible asignar el seguimiento a los estudiantes: ' + participantsError.message)
      setSaving(false)
      return
    }

    const { error: itemsError } = await supabase.from('followup_items').insert(
      validItems.map((item, index) => ({
        followup_id: followupId,
        criterion: item.criterion.trim(),
        result: item.result,
        score: item.score === '' ? null : Number(item.score),
        comment: item.comment.trim() || null,
        sort_order: index,
      }))
    )
    if (itemsError) {
      setError('No fue posible guardar la tabla de evaluación: ' + itemsError.message)
      setSaving(false)
      return
    }

    for (let index = 0; index < newPhotos.length; index += 1) {
      const file = newPhotos[index]
      const fileName = normalizarNombreArchivo(file.name)
      const path = `${userId}/${followupId}/${Date.now()}-${index}-${fileName}`
      const { error: uploadError } = await supabase.storage
        .from('seguimiento-fotos')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        setError(`El seguimiento se guardó, pero falló la fotografía ${file.name}: ${uploadError.message}`)
        setSaving(false)
        return
      }

      const { error: metadataError } = await supabase.from('followup_photos').insert({
        followup_id: followupId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        uploaded_by: userId,
      })
      if (metadataError) {
        setError(`La fotografía ${file.name} se subió, pero no fue posible registrarla: ${metadataError.message}`)
        setSaving(false)
        return
      }
    }

    router.push(`/seguimientos/${followupId}`)
    router.refresh()
  }

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">Cargando formulario…</div>
  }

  if (!puedeGestionar) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">{error}</div>
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">⚠️ {error}</div>
      )}

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-4">📋 Datos de la sesión</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700">
            Fecha *
            <input type="date" required value={form.followup_date}
              onChange={event => setForm({ ...form, followup_date: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Ticket *
            <input required value={form.ticket}
              onChange={event => setForm({ ...form, ticket: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Curso *
            <select required value={form.course_id} onChange={event => seleccionarCurso(event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Selecciona un curso</option>
              {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Asignatura *
            <input required list="subject-options" value={form.subject}
              onChange={event => setForm({ ...form, subject: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <datalist id="subject-options">
              {subjectSuggestions.map(subject => <option key={subject} value={subject} />)}
            </datalist>
          </label>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <details open className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between font-bold text-blue-900">
            <span>🗂️ Proyecto asignado</span>
            <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-4 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {projectsByCourse.length > 0 ? projectsByCourse.map(project => (
              <label key={project.id} className="flex gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm">
                <input type="radio" name="project" value={project.id} checked={form.project_id === project.id}
                  onChange={() => setForm({ ...form, project_id: project.id })} />
                <span>
                  <span className="font-medium text-gray-800">{project.title}</span>
                  <span className="block text-xs text-gray-400">{project.courses?.name ?? 'Sin curso'}</span>
                </span>
              </label>
            )) : (
              <p className="px-4 py-4 text-sm text-gray-400">Selecciona un curso para ver sus proyectos.</p>
            )}
          </div>
        </details>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <details open className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between font-bold text-blue-900">
            <span>👥 Usuarios evaluados ({selectedStudents.length})</span>
            <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-4">
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setSelectedStudents(students.map(student => student.id))}
                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium">
                Seleccionar todos
              </button>
              <button type="button" onClick={() => setSelectedStudents([])}
                className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium">
                Limpiar selección
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {students.length > 0 ? students.map(student => (
                <label key={student.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedStudents.includes(student.id)}
                    onChange={event => setSelectedStudents(prev => event.target.checked
                      ? [...prev, student.id]
                      : prev.filter(id => id !== student.id))} />
                  <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                    {(student.full_name ?? student.email ?? '?')[0].toUpperCase()}
                  </span>
                  <span>
                    <span className="font-medium text-gray-800">{student.full_name ?? student.email}</span>
                    <span className="block text-xs text-gray-400">{student.email}</span>
                  </span>
                </label>
              )) : (
                <p className="px-4 py-4 text-sm text-gray-400">Selecciona un curso para mostrar sus estudiantes.</p>
              )}
            </div>
          </div>
        </details>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-4">📝 Observaciones y retroalimentación</h2>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Observaciones del seguimiento
            <textarea rows={4} value={form.observations}
              onChange={event => setForm({ ...form, observations: event.target.value })}
              placeholder="Registra avances, dificultades, acuerdos o situaciones observadas durante la sesión…"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Retroalimentación visible para los estudiantes
            <textarea rows={4} value={form.feedback}
              onChange={event => setForm({ ...form, feedback: event.target.value })}
              placeholder="Escribe recomendaciones claras para el próximo avance del equipo…"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-medium text-gray-700">
              Estado general
              <select value={form.overall_status} onChange={event => setForm({ ...form, overall_status: event.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400">
                {ESTADOS.map(estado => <option key={estado}>{estado}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Puntaje global (0–100)
              <input type="number" min="0" max="100" step="0.1" value={form.score}
                onChange={event => setForm({ ...form, score: event.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </label>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div>
            <h2 className="font-bold text-blue-900">📊 Tabla de evaluación</h2>
            <p className="text-xs text-gray-400 mt-0.5">Puedes agregar o eliminar criterios según el proyecto.</p>
          </div>
          <button type="button" onClick={agregarItem}
            className="text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-lg font-semibold">
            + Agregar fila
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
              <input value={item.criterion} onChange={event => actualizarItem(index, { criterion: event.target.value })}
                placeholder="Criterio evaluado"
                className="lg:col-span-4 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <select value={item.result} onChange={event => actualizarItem(index, { result: event.target.value })}
                className="lg:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {ESTADOS.map(estado => <option key={estado}>{estado}</option>)}
              </select>
              <input type="number" min="0" max="100" step="0.1" value={item.score}
                onChange={event => actualizarItem(index, { score: event.target.value })}
                placeholder="Puntaje"
                className="lg:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <input value={item.comment} onChange={event => actualizarItem(index, { comment: event.target.value })}
                placeholder="Comentario breve"
                className="lg:col-span-3 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button type="button" onClick={() => eliminarItem(index)}
                className="lg:col-span-1 text-red-500 hover:bg-red-50 rounded-lg px-2 py-2 text-sm">✕</button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-2">📷 Fotografías de la sesión</h2>
        <p className="text-sm text-gray-500 mb-4">Sube fotografías existentes o abre la cámara del dispositivo para registrar el avance en el instante.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => galleryInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
            🖼️ Subir fotografías
          </button>
          <button type="button" onClick={() => cameraInputRef.current?.click()}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
            📸 Tomar fotografía ahora
          </button>
          <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={event => { agregarFotos(event.target.files); event.target.value = '' }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={event => { agregarFotos(event.target.files); event.target.value = '' }} />
        </div>

        {(existingPhotos.length > 0 || newPhotos.length > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {existingPhotos.map(photo => (
              <div key={photo.id} className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                {/* URL firmada temporal: no se usa next/image para evitar cachear archivos privados. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/seguimientos/fotos/${photo.id}`} alt={photo.file_name} className="w-full h-32 object-cover" />
                <button type="button" onClick={() => eliminarFotoExistente(photo)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-7 h-7 text-xs shadow">✕</button>
                <p className="text-xs text-gray-500 truncate px-2 py-1.5">{photo.file_name}</p>
              </div>
            ))}
            {newPhotoPreviews.map((preview, index) => (
              <div key={`${preview.file.name}-${index}`} className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                {/* Previsualización local antes de guardar. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt={preview.file.name} className="w-full h-32 object-cover" />
                <button type="button" onClick={() => eliminarFotoNueva(index)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-7 h-7 text-xs shadow">✕</button>
                <p className="text-xs text-gray-500 truncate px-2 py-1.5">{preview.file.name}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-3 pb-5">
        <button type="button" onClick={() => router.back()}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">
          {saving ? 'Guardando…' : sessionId ? 'Guardar cambios' : 'Crear seguimiento'}
        </button>
      </div>
    </form>
  )
}
