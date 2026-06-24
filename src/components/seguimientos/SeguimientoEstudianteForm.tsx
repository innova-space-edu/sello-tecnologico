'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

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

type FollowupItem = {
  criterion: string
  result: string
  score: string
  comment: string
}

const ASIGNATURAS = [
  'Tecnología', 'Ciencias para la Ciudadanía', 'Ciencias Naturales', 'Física',
  'Química', 'Biología', 'Matemática', 'Lengua y Literatura', 'Historia',
  'Artes Visuales', 'Educación Física', 'Orientación', 'Otra',
]

const ESTADOS = ['Pendiente', 'En proceso', 'Logrado', 'Requiere apoyo']

const criteriosIniciales: FollowupItem[] = [
  { criterion: 'Avance realizado por el equipo', result: 'En proceso', score: '', comment: '' },
  { criterion: 'Evidencias registradas durante la clase', result: 'En proceso', score: '', comment: '' },
  { criterion: 'Dificultades y solución propuesta', result: 'En proceso', score: '', comment: '' },
  { criterion: 'Próximo paso del proyecto', result: 'Pendiente', score: '', comment: '' },
]

function generarTicket() {
  const ahora = new Date()
  const fecha = ahora.toISOString().slice(0, 10).replaceAll('-', '')
  const hora = ahora.toTimeString().slice(0, 8).replaceAll(':', '')
  return `SEG-EST-${fecha}-${hora}`
}

function normalizarNombreArchivo(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
}

export default function SeguimientoEstudianteForm() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [items, setItems] = useState<FollowupItem[]>(criteriosIniciales)
  const [form, setForm] = useState({
    followup_date: new Date().toISOString().slice(0, 10),
    course_id: '',
    project_id: '',
    subject: 'Tecnología',
    ticket: generarTicket(),
    observations: '',
    overall_status: 'En proceso',
  })

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

      const { data: perfil, error: perfilError } = await supabase
        .from('profiles')
        .select('id, full_name, email, curso, role')
        .eq('id', user.id)
        .single()

      if (perfilError || !perfil) {
        setError('No fue posible verificar tu usuario.')
        setLoading(false)
        return
      }

      if (perfil.role !== 'estudiante') {
        setError('Esta ficha está pensada para estudiantes. Si eres docente, usa la modalidad docente.')
        setLoading(false)
        return
      }

      setProfile(perfil)
      setSelectedStudents([user.id])

      const [{ data: cursos }, { data: proyectos }] = await Promise.all([
        supabase.from('courses').select('id, name, level, area, year').order('name'),
        supabase.from('projects').select('id, title, course_id, asignaturas, courses(name)').order('title'),
      ])

      const normalizedCurso = String(perfil.curso ?? '').trim().toLowerCase()
      const cursosFiltrados = normalizedCurso
        ? (cursos ?? []).filter((course: Course) => course.name?.toLowerCase().includes(normalizedCurso) || normalizedCurso.includes(course.name?.toLowerCase?.() ?? ''))
        : (cursos ?? [])

      const listaCursos = (cursosFiltrados.length > 0 ? cursosFiltrados : cursos ?? []) as Course[]
      setCourses(listaCursos)
      setProjects((proyectos ?? []) as unknown as Project[])

      if (listaCursos.length === 1) {
        setForm(prev => ({ ...prev, course_id: listaCursos[0].id }))
      }

      setLoading(false)
    }

    cargar()
  }, [router, supabase])

  useEffect(() => {
    if (!form.course_id || !userId) return

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
        .filter((student): student is StudentProfile => Boolean(student && student.role === 'estudiante'))
        .sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? '', 'es'))

      const existsSelf = lista.some(student => student.id === userId)
      const listaConUsuario = existsSelf || !profile ? lista : [profile, ...lista]
      setStudents(listaConUsuario)
      setSelectedStudents(prev => Array.from(new Set([userId, ...prev])))
    }

    cargarEstudiantes()
  }, [form.course_id, profile, supabase, userId])

  const projectsByCourse = useMemo(
    () => projects.filter(project => !form.course_id || project.course_id === form.course_id),
    [projects, form.course_id]
  )

  const selectedProject = projects.find(project => project.id === form.project_id)
  const subjectSuggestions = Array.from(new Set([
    ...ASIGNATURAS,
    ...((selectedProject?.asignaturas ?? []) as string[]),
  ]))

  const newPhotoPreviews = useMemo(
    () => newPhotos.map(file => ({ file, url: URL.createObjectURL(file) })),
    [newPhotos]
  )

  useEffect(() => {
    return () => {
      newPhotoPreviews.forEach(preview => URL.revokeObjectURL(preview.url))
    }
  }, [newPhotoPreviews])

  const seleccionarCurso = (courseId: string) => {
    setForm(prev => ({ ...prev, course_id: courseId, project_id: '' }))
    setSelectedStudents(userId ? [userId] : [])
  }

  const toggleStudent = (studentId: string) => {
    if (studentId === userId) return
    setSelectedStudents(prev => prev.includes(studentId)
      ? prev.filter(id => id !== studentId)
      : [...prev, studentId]
    )
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

  const actualizarItem = (index: number, patch: Partial<FollowupItem>) => {
    setItems(prev => prev.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item))
  }

  const agregarItem = () => {
    setItems(prev => [...prev, { criterion: '', result: 'En proceso', score: '', comment: '' }])
  }

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!userId || profile?.role !== 'estudiante') return
    if (!form.course_id || !form.project_id || !form.subject.trim() || !form.ticket.trim()) {
      setError('Completa fecha, ticket, curso, asignatura y proyecto.')
      return
    }

    const participants = Array.from(new Set([userId, ...selectedStudents]))
    if (participants.length === 0) {
      setError('Selecciona al menos un integrante del equipo.')
      return
    }

    const validItems = items.filter(item => item.criterion.trim())
    if (validItems.length === 0) {
      setError('Registra al menos un criterio o avance del proyecto.')
      return
    }

    setSaving(true)
    const payload = {
      teacher_id: userId,
      followup_date: form.followup_date,
      course_id: form.course_id,
      project_id: form.project_id,
      subject: form.subject.trim(),
      ticket: form.ticket.trim(),
      observations: form.observations.trim() || null,
      feedback: null,
      overall_status: form.overall_status,
      score: null,
    }

    const { data, error: insertError } = await supabase
      .from('project_followups')
      .insert(payload)
      .select('id')
      .single()

    if (insertError || !data) {
      setError('No fue posible enviar el seguimiento: ' + (insertError?.message ?? 'respuesta vacía'))
      setSaving(false)
      return
    }

    const followupId = data.id

    const { error: participantsError } = await supabase.from('followup_participants').insert(
      participants.map(studentId => ({ followup_id: followupId, user_id: studentId }))
    )

    if (participantsError) {
      setError('El seguimiento fue creado, pero no se pudieron guardar los integrantes: ' + participantsError.message)
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
      setError('El seguimiento fue creado, pero no se pudo guardar la tabla de avances: ' + itemsError.message)
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
    return <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">Cargando formulario de estudiante…</div>
  }

  if (profile?.role !== 'estudiante') {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">{error}</div>
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">⚠️ {error}</div>}

      <section className="bg-sky-50 border border-sky-100 rounded-xl p-5 lg:p-6">
        <h2 className="font-bold text-sky-900 mb-2">🧑‍🎓 Seguimiento creado por estudiante</h2>
        <p className="text-sm text-sky-800">
          Registra el avance real del equipo. El docente podrá ver, editar y retroalimentar esta ficha.
        </p>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-4">📋 Datos del seguimiento</h2>
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
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="">Selecciona un curso</option>
              {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Asignatura *
            <input required list="student-subject-options" value={form.subject}
              onChange={event => setForm({ ...form, subject: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <datalist id="student-subject-options">
              {subjectSuggestions.map(subject => <option key={subject} value={subject} />)}
            </datalist>
          </label>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-4">🗂️ Proyecto</h2>
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
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
            <p className="px-4 py-4 text-sm text-gray-400">Selecciona un curso para ver proyectos disponibles.</p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-4">👥 Integrantes del equipo ({selectedStudents.length})</h2>
        <p className="text-sm text-gray-500 mb-3">Selecciona tu nombre y los integrantes reales del equipo. Tu nombre queda seleccionado automáticamente.</p>
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {students.length > 0 ? students.map(student => (
            <label key={student.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm">
              <input type="checkbox" checked={selectedStudents.includes(student.id)} disabled={student.id === userId}
                onChange={() => toggleStudent(student.id)} />
              <span className="flex-1">
                <span className="font-medium text-gray-800">{student.full_name ?? student.email}</span>
                {student.id === userId && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Tú</span>}
                <span className="block text-xs text-gray-400">{student.email}</span>
              </span>
            </label>
          )) : (
            <p className="px-4 py-4 text-sm text-gray-400">Selecciona un curso para cargar estudiantes.</p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-4">📝 Avance, dificultades y próximos pasos</h2>
        <textarea value={form.observations}
          onChange={event => setForm({ ...form, observations: event.target.value })}
          rows={5}
          placeholder="Describe qué avanzaron, qué dificultad tuvieron y qué realizarán en la próxima clase."
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <div className="flex justify-between gap-3 items-center mb-4">
          <h2 className="font-bold text-blue-900">📊 Auto-seguimiento del equipo</h2>
          <button type="button" onClick={agregarItem} className="text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-lg font-medium">
            + Agregar fila
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Criterio / tarea</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Estado</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Puntaje opcional</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Comentario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 min-w-[220px]">
                    <input value={item.criterion} onChange={event => actualizarItem(index, { criterion: event.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5" />
                  </td>
                  <td className="px-3 py-2 min-w-[150px]">
                    <select value={item.result} onChange={event => actualizarItem(index, { result: event.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                      {ESTADOS.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 min-w-[120px]">
                    <input type="number" min="0" max="100" value={item.score} onChange={event => actualizarItem(index, { score: event.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5" />
                  </td>
                  <td className="px-3 py-2 min-w-[220px]">
                    <input value={item.comment} onChange={event => actualizarItem(index, { comment: event.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900 mb-4">📷 Evidencias fotográficas</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={event => agregarFotos(event.target.files)} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => agregarFotos(event.target.files)} />
          <button type="button" onClick={() => galleryInputRef.current?.click()} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
            Subir desde galería
          </button>
          <button type="button" onClick={() => cameraInputRef.current?.click()} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
            Tomar fotografía
          </button>
        </div>
        {newPhotoPreviews.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {newPhotoPreviews.map((preview, index) => (
              <div key={`${preview.file.name}-${index}`} className="relative border border-gray-200 rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt={preview.file.name} className="w-full h-32 object-cover" />
                <button type="button" onClick={() => setNewPhotos(prev => prev.filter((_, currentIndex) => currentIndex !== index))}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs">×</button>
                <p className="text-xs text-gray-500 truncate px-2 py-1">{preview.file.name}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => router.push('/seguimientos')} className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60">
          {saving ? 'Enviando…' : 'Enviar seguimiento al docente'}
        </button>
      </div>
    </form>
  )
}
