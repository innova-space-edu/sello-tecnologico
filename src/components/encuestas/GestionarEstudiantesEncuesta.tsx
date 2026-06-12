'use client'

import { useEffect, useMemo, useState } from 'react'

type Student = {
  id: string
  full_name?: string | null
  email?: string | null
  curso?: string | null
}

type SurveyStudentsPayload = {
  survey_id: string
  course_id: string
  course_name: string
  student_ids: string[]
  responded_student_ids: string[]
  students: Student[]
}

export default function GestionarEstudiantesEncuesta({ surveyId }: { surveyId: string }) {
  const [payload, setPayload] = useState<SurveyStudentsPayload | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/encuestas/${surveyId}/estudiantes`)
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'No fue posible cargar los estudiantes.')
        setLoading(false)
        return
      }
      setPayload(data)
      setSelectedIds(data.student_ids ?? [])
      setLoading(false)
    }
    load()
  }, [surveyId])

  const respondedSet = useMemo(() => new Set(payload?.responded_student_ids ?? []), [payload])
  const normalizedQuery = query.trim().toLowerCase()
  const students = payload?.students ?? []
  const visibleStudents = students.filter(student => {
    if (!normalizedQuery) return true
    return `${student.full_name ?? ''} ${student.email ?? ''}`.toLowerCase().includes(normalizedQuery)
  })
  const selectedSet = new Set(selectedIds)
  const selectedStudents = students.filter(student => selectedSet.has(student.id))
  const respondedSelected = selectedStudents.filter(student => respondedSet.has(student.id)).length
  const pendingSelected = selectedStudents.length - respondedSelected

  const toggle = (studentId: string, checked: boolean) => {
    setSaved(false)
    setSelectedIds(prev => checked ? [...new Set([...prev, studentId])] : prev.filter(id => id !== studentId))
  }

  const selectVisible = () => {
    setSaved(false)
    setSelectedIds(prev => [...new Set([...prev, ...visibleStudents.map(student => student.id)])])
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    const response = await fetch(`/api/encuestas/${surveyId}/estudiantes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_ids: selectedIds }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? 'No fue posible guardar la nómina.')
      setSaving(false)
      return
    }
    setSelectedIds(data.student_ids ?? [])
    setSaved(true)
    setSaving(false)
  }

  if (loading) return <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">Cargando nómina del curso…</div>

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">⚠️ {error}</div>}
      {saved && <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">✅ Nómina guardada correctamente.</div>}

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <h2 className="font-bold text-blue-900">👥 Estudiantes registrados · {payload?.course_name || 'Curso'}</h2>
        <p className="text-sm text-gray-500 mt-2">La nómina se sincroniza con los usuarios registrados. Selecciona estudiantes internos para controlar quién respondió y quién sigue pendiente. El enlace público seguirá aceptando respuestas externas.</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-blue-50 rounded-lg p-4"><p className="text-xs text-blue-500 uppercase font-semibold">Registrados</p><p className="text-2xl font-bold text-blue-900 mt-1">{students.length}</p></div>
          <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase font-semibold">Seleccionados</p><p className="text-2xl font-bold text-gray-800 mt-1">{selectedStudents.length}</p></div>
          <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-green-600 uppercase font-semibold">Respondieron</p><p className="text-2xl font-bold text-green-700 mt-1">{respondedSelected}</p></div>
          <div className="bg-yellow-50 rounded-lg p-4"><p className="text-xs text-yellow-600 uppercase font-semibold">Pendientes</p><p className="text-2xl font-bold text-yellow-700 mt-1">{pendingSelected}</p></div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <div className="flex flex-wrap gap-2">
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar estudiante por nombre o correo" className="flex-1 min-w-60 border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
          <button type="button" onClick={selectVisible} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2.5 rounded-lg text-sm font-semibold">Seleccionar visibles</button>
          <button type="button" onClick={() => { setSelectedIds([]); setSaved(false) }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2.5 rounded-lg text-sm font-semibold">Limpiar</button>
        </div>

        <div className="mt-4 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[34rem] overflow-y-auto">
          {visibleStudents.length > 0 ? visibleStudents.map(student => {
            const responded = respondedSet.has(student.id)
            return (
              <label key={student.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-sm">
                <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => toggle(student.id, event.target.checked)} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-gray-700 truncate">{student.full_name ?? 'Estudiante sin nombre'}</span>
                  <span className="block text-xs text-gray-400 truncate">{student.email ?? 'Sin correo registrado'}</span>
                </span>
                <span className={`text-xs rounded-full px-2.5 py-1 font-semibold ${responded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{responded ? 'Respondió' : 'Pendiente'}</span>
              </label>
            )
          }) : <div className="px-4 py-6 text-sm text-gray-400">No se encontraron estudiantes registrados para este curso.</div>}
        </div>

        <div className="flex justify-end mt-4">
          <button type="button" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-lg text-sm font-semibold">{saving ? 'Guardando…' : 'Guardar estudiantes seleccionados'}</button>
        </div>
      </section>
    </div>
  )
}
