'use client'

import { createClient } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'

type Student = {
  id: string
  full_name?: string | null
  email?: string | null
  curso?: string | null
  role?: string | null
}

type CourseMemberRow = {
  user_id: string
  profiles: Student | Student[] | null
}

type Props = {
  courseId: string
  courseName?: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export default function EstudiantesEncuestaPanel({ courseId, courseName, selectedIds, onChange }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [students, setStudents] = useState<Student[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!courseId) {
        setStudents([])
        return
      }

      setLoading(true)
      setError('')

      const [{ data: members, error: membersError }, { data: fallbackProfiles }] = await Promise.all([
        supabase
          .from('course_members')
          .select('user_id, profiles(id, full_name, email, curso, role)')
          .eq('course_id', courseId),
        courseName
          ? supabase
              .from('profiles')
              .select('id, full_name, email, curso, role')
              .eq('role', 'estudiante')
              .eq('curso', courseName)
          : Promise.resolve({ data: [] as Student[] }),
      ])

      if (membersError) setError('No fue posible cargar completamente la nómina del curso.')

      const fromMembers = ((members ?? []) as unknown as CourseMemberRow[])
        .map(row => Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)
        .filter((profile): profile is Student => Boolean(profile && profile.role === 'estudiante'))

      const merged = new Map<string, Student>()
      for (const student of [...fromMembers, ...((fallbackProfiles ?? []) as Student[])]) {
        if (student.id && student.role === 'estudiante') merged.set(student.id, student)
      }

      setStudents([...merged.values()].sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? '', 'es')))
      setLoading(false)
    }

    load()
  }, [courseId, courseName, supabase])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleStudents = students.filter(student => {
    if (!normalizedQuery) return true
    return `${student.full_name ?? ''} ${student.email ?? ''}`.toLowerCase().includes(normalizedQuery)
  })

  const toggle = (studentId: string, checked: boolean) => {
    onChange(checked ? [...new Set([...selectedIds, studentId])] : selectedIds.filter(id => id !== studentId))
  }

  return (
    <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
      <details className="group" open>
        <summary className="cursor-pointer list-none flex justify-between gap-3 font-bold text-blue-900">
          <span>👥 Estudiantes registrados del curso ({selectedIds.length}/{students.length})</span>
          <span className="text-gray-400">▼</span>
        </summary>

        <p className="text-sm text-gray-500 mt-3">
          Selecciona estudiantes internos para controlar quién respondió y quién sigue pendiente. El enlace público seguirá disponible para personas externas.
        </p>

        {!courseId ? (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">Selecciona primero un curso.</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mt-4">
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar estudiante por nombre o correo" className="flex-1 min-w-60 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button type="button" onClick={() => onChange([...new Set([...selectedIds, ...visibleStudents.map(student => student.id)])])} className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-semibold">Seleccionar visibles</button>
              <button type="button" onClick={() => onChange([])} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold">Limpiar</button>
            </div>

            {error && <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">⚠️ {error}</div>}
            {loading ? <p className="mt-4 text-sm text-gray-400">Cargando estudiantes…</p> : (
              <div className="mt-4 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {visibleStudents.length > 0 ? visibleStudents.map(student => (
                  <label key={student.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-sm">
                    <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => toggle(student.id, event.target.checked)} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-gray-700 truncate">{student.full_name ?? 'Estudiante sin nombre'}</span>
                      <span className="block text-xs text-gray-400 truncate">{student.email ?? 'Sin correo registrado'}</span>
                    </span>
                  </label>
                )) : <div className="px-4 py-5 text-sm text-gray-400">No se encontraron estudiantes registrados para este curso.</div>}
              </div>
            )}
          </>
        )}
      </details>
    </section>
  )
}
