'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  buildWorkbookBuffer,
  downloadBuffer,
  type GridCell,
  type WorkbookData,
} from '@/components/promedios/NativeSpreadsheetCore'

type Course = { id: string; name: string; level?: string | null; year?: number | null }
type Student = { id: string; label: string }

type Gradebook = {
  id: string
  course_id: string
  owner_id: string
  subject: string
  period: '1S' | '2S'
  school_year: number
  passing_percent: number
  min_grade: number
  max_grade: number
  passing_grade: number
}

type AssessmentKind = 'parcial' | 'acumulativa' | 'sumativa' | 'formativa' | 'diagnostica' | 'otra'
type EntryMode = 'grade' | 'points' | 'percent'

type Assessment = {
  id: string
  gradebook_id: string
  title: string
  kind: AssessmentKind
  entry_mode: EntryMode
  max_points: number | null
  passing_percent: number | null
  weight: number
  counts_toward_average: boolean
  assessment_date: string | null
  sort_order: number
}

type GradeEntry = {
  assessment_id: string
  student_id: string
  grade: number | null
  raw_score: number | null
  status: string
}

type EntryState = {
  grade: number | null
  raw_score: number | null
  status: string
}

type GradebookPayload = {
  gradebook: Gradebook | null
  assessments: Assessment[]
  grades: GradeEntry[]
}

const YEAR = new Date().getFullYear()
const GRADE_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function keyOf(assessmentId: string, studentId: string) {
  return `${assessmentId}::${studentId}`
}

function numberOrNull(value: unknown) {
  if (value === '' || value == null) return null
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function round1(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

function chileGrade(percent: number, exigencia: number) {
  const p = Math.max(0, Math.min(100, percent))
  const e = Math.max(1, Math.min(99, exigencia))
  const value = p <= e
    ? 1 + (p / e) * 3
    : 4 + ((p - e) / (100 - e)) * 3
  return Math.max(1, Math.min(7, round1(value)))
}

function surnameKey(name: string) {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (!clean) return ''
  if (clean.includes(',')) {
    const [surnames, given = ''] = clean.split(',', 2)
    return `${surnames.trim()}|${given.trim()}`
  }
  const parts = clean.split(' ')
  if (parts.length <= 2) return `${parts.at(-1) ?? ''}|${parts[0] ?? ''}`
  return `${parts.slice(-2).join(' ')}|${parts.slice(0, -2).join(' ')}`
}

function assessmentLabel(kind: AssessmentKind) {
  const labels: Record<AssessmentKind, string> = {
    parcial: 'Parcial',
    acumulativa: 'Acumulativa',
    sumativa: 'Sumativa',
    formativa: 'Formativa',
    diagnostica: 'Diagnóstica',
    otra: 'Otra',
  }
  return labels[kind]
}

function kindBadge(kind: AssessmentKind) {
  const styles: Record<AssessmentKind, string> = {
    parcial: 'bg-blue-50 text-blue-700',
    acumulativa: 'bg-amber-50 text-amber-700',
    sumativa: 'bg-violet-50 text-violet-700',
    formativa: 'bg-emerald-50 text-emerald-700',
    diagnostica: 'bg-slate-100 text-slate-700',
    otra: 'bg-cyan-50 text-cyan-700',
  }
  return styles[kind]
}

function periodLabel(period: '1S' | '2S') {
  return period === '1S' ? '1° Semestre' : '2° Semestre'
}

function safeFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || 'calificaciones'
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la operación')
  return payload
}

export default function PromediosWorkspace() {
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [subject, setSubject] = useState('')
  const [period, setPeriod] = useState<'1S' | '2S'>('1S')
  const [gradebook, setGradebook] = useState<Gradebook | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [entries, setEntries] = useState<Record<string, EntryState>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [passingDraft, setPassingDraft] = useState('60')
  const [showAssessmentForm, setShowAssessmentForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [newAssessment, setNewAssessment] = useState({
    title: '',
    kind: 'parcial' as AssessmentKind,
    entry_mode: 'grade' as EntryMode,
    max_points: '100',
    passing_percent: '',
    weight: '1',
    counts_toward_average: true,
    assessment_date: '',
  })

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const payload = await readJson(await fetch('/api/promedios/cursos', { cache: 'no-store' }))
        if (!active) return
        const list = (payload.courses ?? []) as Course[]
        setCourses(list)
        if (list.length) setCourseId((current) => current || list[0].id)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No se pudieron cargar los cursos')
      }
    })()
    return () => { active = false }
  }, [])

  const orderedStudents = useMemo(() => {
    const collator = new Intl.Collator('es-CL', { sensitivity: 'base', numeric: true })
    return [...students].sort((a, b) => collator.compare(surnameKey(a.label), surnameKey(b.label)))
  }, [students])

  const currentCourse = useMemo(() => courses.find((item) => item.id === gradebook?.course_id), [courses, gradebook])

  const effectiveGrade = (assessment: Assessment, entry?: EntryState) => {
    if (!entry || entry.status !== 'normal') return null
    if (assessment.entry_mode === 'grade') {
      const value = numberOrNull(entry.grade)
      return value == null ? null : Math.max(1, Math.min(7, round1(value)))
    }
    const raw = numberOrNull(entry.raw_score)
    if (raw == null) return null
    const percent = assessment.entry_mode === 'points'
      ? (raw / Math.max(0.01, Number(assessment.max_points || 1))) * 100
      : raw
    return chileGrade(percent, Number(assessment.passing_percent ?? gradebook?.passing_percent ?? 60))
  }

  const averageForStudent = (studentId: string) => {
    let weighted = 0
    let totalWeight = 0
    for (const assessment of assessments) {
      if (!assessment.counts_toward_average) continue
      const grade = effectiveGrade(assessment, entries[keyOf(assessment.id, studentId)])
      if (grade == null) continue
      const weight = Math.max(0.001, Number(assessment.weight || 1))
      weighted += grade * weight
      totalWeight += weight
    }
    return totalWeight ? round1(weighted / totalWeight) : null
  }

  const courseAverage = useMemo(() => {
    const values = orderedStudents
      .map((student) => averageForStudent(student.id))
      .filter((value): value is number => value != null)
    return values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedStudents, assessments, entries, gradebook?.passing_percent])

  const approvalPercent = useMemo(() => {
    const values = orderedStudents
      .map((student) => averageForStudent(student.id))
      .filter((value): value is number => value != null)
    if (!values.length) return null
    return Math.round((values.filter((value) => value >= 4).length / values.length) * 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedStudents, assessments, entries, gradebook?.passing_percent])

  const hydrate = (payload: GradebookPayload, roster?: Student[]) => {
    setGradebook(payload.gradebook)
    setAssessments(payload.assessments ?? [])
    if (roster) setStudents(roster)
    const next: Record<string, EntryState> = {}
    for (const item of payload.grades ?? []) {
      next[keyOf(item.assessment_id, item.student_id)] = {
        grade: numberOrNull(item.grade),
        raw_score: numberOrNull(item.raw_score),
        status: item.status || 'normal',
      }
    }
    setEntries(next)
    setDirty(new Set())
    if (payload.gradebook) setPassingDraft(String(Number(payload.gradebook.passing_percent)))
  }

  const fetchGradebook = async (targetCourseId: string, targetSubject: string, targetPeriod: '1S' | '2S') => {
    const params = new URLSearchParams({
      courseId: targetCourseId,
      subject: targetSubject,
      period: targetPeriod,
      schoolYear: String(YEAR),
    })
    return readJson(await fetch(`/api/promedios/calificaciones?${params.toString()}`, { cache: 'no-store' })) as Promise<GradebookPayload>
  }

  const openGradebook = async () => {
    const cleanSubject = subject.trim()
    if (!courseId) return setError('Selecciona un curso')
    if (!cleanSubject) return setError('Escribe la asignatura o nombre del seguimiento')

    setLoading(true)
    setError('')
    setNotice('')
    try {
      const studentParams = new URLSearchParams({ mode: 'name' })
      const [studentPayload, initial] = await Promise.all([
        readJson(await fetch(`/api/promedios/cursos/${courseId}/estudiantes?${studentParams.toString()}`, { cache: 'no-store' })),
        fetchGradebook(courseId, cleanSubject, period),
      ])

      let data = initial
      if (!data.gradebook) {
        await readJson(await fetch('/api/promedios/calificaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ensure',
            courseId,
            subject: cleanSubject,
            period,
            schoolYear: YEAR,
            passingPercent: 60,
          }),
        }))
        data = await fetchGradebook(courseId, cleanSubject, period)
      }

      hydrate(data, (studentPayload.students ?? []) as Student[])
      setSubject(cleanSubject)
      setNotice('Libro de calificaciones listo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el libro de calificaciones')
    } finally {
      setLoading(false)
    }
  }

  const reloadCurrent = async () => {
    if (!gradebook) return
    const payload = await fetchGradebook(gradebook.course_id, gradebook.subject, gradebook.period)
    hydrate(payload)
  }

  const updateEntry = (assessment: Assessment, studentId: string, rawValue: string) => {
    const key = keyOf(assessment.id, studentId)
    const numeric = numberOrNull(rawValue)
    setEntries((current) => {
      const previous = current[key] ?? { grade: null, raw_score: null, status: 'normal' }
      if (assessment.entry_mode === 'grade') {
        const grade = numeric == null ? null : Math.max(1, Math.min(7, round1(numeric)))
        return { ...current, [key]: { ...previous, grade, raw_score: null, status: 'normal' } }
      }
      const max = assessment.entry_mode === 'percent' ? 100 : Number(assessment.max_points || 0)
      const rawScore = numeric == null ? null : Math.max(0, max > 0 ? Math.min(max, numeric) : numeric)
      return { ...current, [key]: { ...previous, raw_score: rawScore, status: 'normal' } }
    })
    setDirty((current) => {
      const next = new Set(current)
      next.add(key)
      return next
    })
  }

  const saveEntries = async (keys = dirty) => {
    if (!gradebook || keys.size === 0) return
    const payload = [...keys].map((key) => {
      const [assessmentId, studentId] = key.split('::')
      const entry = entries[key] ?? { grade: null, raw_score: null, status: 'normal' }
      return {
        assessment_id: assessmentId,
        student_id: studentId,
        grade: entry.grade,
        raw_score: entry.raw_score,
        status: entry.status,
      }
    })

    await readJson(await fetch('/api/promedios/calificaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveGrades', gradebookId: gradebook.id, entries: payload }),
    }))
  }

  const saveDirty = async () => {
    if (!gradebook || dirty.size === 0) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await saveEntries()
      await reloadCurrent()
      setNotice('Notas guardadas correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las notas')
    } finally {
      setSaving(false)
    }
  }

  const savePassingPercent = async () => {
    if (!gradebook) return
    const value = numberOrNull(passingDraft)
    if (value == null || value <= 0 || value >= 100) {
      setError('La exigencia debe estar entre 1% y 99%.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await readJson(await fetch('/api/promedios/calificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settings', gradebookId: gradebook.id, passingPercent: value }),
      }))

      const affected = new Set<string>()
      for (const assessment of assessments) {
        if (assessment.entry_mode === 'grade' || assessment.passing_percent != null) continue
        for (const student of students) {
          const key = keyOf(assessment.id, student.id)
          if (entries[key]?.raw_score != null) affected.add(key)
        }
      }
      if (affected.size) await saveEntries(affected)
      await reloadCurrent()
      setNotice(`Exigencia actualizada a ${value}% y notas recalculadas.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la exigencia')
    } finally {
      setSaving(false)
    }
  }

  const createAssessment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!gradebook) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await readJson(await fetch('/api/promedios/calificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assessment',
          gradebookId: gradebook.id,
          assessment: {
            title: newAssessment.title,
            kind: newAssessment.kind,
            entry_mode: newAssessment.entry_mode,
            max_points: newAssessment.entry_mode === 'points' ? numberOrNull(newAssessment.max_points) : null,
            passing_percent: numberOrNull(newAssessment.passing_percent),
            weight: numberOrNull(newAssessment.weight) ?? 1,
            counts_toward_average: newAssessment.counts_toward_average,
            assessment_date: newAssessment.assessment_date || null,
          },
        }),
      }))
      setNewAssessment({
        title: '',
        kind: 'parcial',
        entry_mode: 'grade',
        max_points: '100',
        passing_percent: '',
        weight: '1',
        counts_toward_average: true,
        assessment_date: '',
      })
      setShowAssessmentForm(false)
      await reloadCurrent()
      setNotice('Evaluación agregada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la evaluación')
    } finally {
      setSaving(false)
    }
  }

  const deleteAssessment = async (assessment: Assessment) => {
    if (!gradebook) return
    if (!window.confirm(`¿Eliminar "${assessment.title}" y todas sus notas?`)) return

    setSaving(true)
    setError('')
    try {
      await readJson(await fetch('/api/promedios/calificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteAssessment', gradebookId: gradebook.id, assessmentId: assessment.id }),
      }))
      await reloadCurrent()
      setNotice('Evaluación eliminada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la evaluación')
    } finally {
      setSaving(false)
    }
  }

  const exportPdf = async () => {
    if (!gradebook) return
    setExporting(true)
    setError('')
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const courseName = currentCourse?.name || 'Curso'
      doc.setFontSize(15)
      doc.text('Libro de calificaciones', 14, 13)
      doc.setFontSize(9)
      doc.text(`${courseName} · ${gradebook.subject} · ${periodLabel(gradebook.period)} · ${gradebook.school_year}`, 14, 19)
      doc.text(`Escala 1,0–7,0 · Aprobación 4,0 · Exigencia ${Number(gradebook.passing_percent)}%`, 14, 24)

      const head = [[
        'N°',
        'Alumno',
        ...assessments.map((item) => item.title),
        'Prom.',
      ]]
      const body = orderedStudents.map((student, index) => [
        String(index + 1),
        student.label,
        ...assessments.map((assessment) => {
          const value = effectiveGrade(assessment, entries[keyOf(assessment.id, student.id)])
          return value == null ? '-' : value.toFixed(1)
        }),
        averageForStudent(student.id)?.toFixed(1) ?? '-',
      ])

      autoTable(doc, {
        head,
        body,
        startY: 29,
        theme: 'grid',
        styles: { fontSize: 6.7, cellPadding: 1.3, valign: 'middle' },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 58 } },
        horizontalPageBreak: true,
        horizontalPageBreakRepeat: [0, 1],
      })

      doc.setFontSize(7.5)
      doc.text('Promedios calculados solo con evaluaciones que inciden y cuentan con nota registrada.', 14, 202)
      doc.save(`${safeFilename(`${courseName}_${gradebook.subject}_${gradebook.period}`)}.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF')
    } finally {
      setExporting(false)
    }
  }

  const exportExcel = async () => {
    if (!gradebook) return
    setExporting(true)
    setError('')
    try {
      const courseName = currentCourse?.name || 'Curso'
      const headerStyle = {
        bold: true,
        background: '#2563EB',
        color: '#FFFFFF',
        horizontal: 'center' as const,
        vertical: 'middle' as const,
        wrap: true,
        border: true,
      }
      const labelStyle = { bold: true, background: '#EFF6FF', border: true }
      const centered = { horizontal: 'center' as const, vertical: 'middle' as const, border: true }
      const textCell = (value: string | number, style?: GridCell['style']): GridCell => ({ value, style })

      const rows: GridCell[][] = [
        [textCell('LIBRO DE CALIFICACIONES', { bold: true, fontSize: 15 }), textCell('')],
        [textCell('Curso', labelStyle), textCell(courseName), textCell('Asignatura', labelStyle), textCell(gradebook.subject)],
        [textCell('Periodo', labelStyle), textCell(periodLabel(gradebook.period)), textCell('Año', labelStyle), textCell(gradebook.school_year)],
        [textCell('Exigencia', labelStyle), textCell(`${Number(gradebook.passing_percent)}%`), textCell('Escala', labelStyle), textCell('1,0 a 7,0 · aprueba 4,0')],
        [],
        [
          textCell('N°', headerStyle),
          textCell('Alumno', headerStyle),
          ...assessments.map((item) => textCell(item.title, headerStyle)),
          textCell('Prom.', headerStyle),
        ],
        ...orderedStudents.map((student, index) => [
          textCell(index + 1, centered),
          textCell(student.label, { border: true }),
          ...assessments.map((assessment) => {
            const value = effectiveGrade(assessment, entries[keyOf(assessment.id, student.id)])
            return textCell(value ?? '', centered)
          }),
          textCell(averageForStudent(student.id) ?? '', { ...centered, bold: true }),
        ]),
      ]

      const details: GridCell[][] = [
        [
          textCell('Evaluación', headerStyle),
          textCell('Tipo', headerStyle),
          textCell('Ingreso', headerStyle),
          textCell('Ponderación', headerStyle),
          textCell('Exigencia', headerStyle),
          textCell('Incide', headerStyle),
          textCell('Fecha', headerStyle),
        ],
        ...assessments.map((item) => [
          textCell(item.title, { border: true }),
          textCell(assessmentLabel(item.kind), centered),
          textCell(item.entry_mode === 'grade' ? 'Nota' : item.entry_mode === 'points' ? 'Puntaje' : 'Porcentaje', centered),
          textCell(Number(item.weight), centered),
          textCell(`${Number(item.passing_percent ?? gradebook.passing_percent)}%`, centered),
          textCell(item.counts_toward_average ? 'Sí' : 'No', centered),
          textCell(item.assessment_date || '', centered),
        ]),
      ]

      const workbook: WorkbookData = {
        sheets: [
          {
            name: 'Calificaciones',
            cells: rows,
            merges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: Math.max(3, assessments.length + 2) }],
            columnWidths: [7, 34, ...assessments.map(() => 14), 10],
            rowHeights: rows.map((_, index) => index === 0 ? 28 : index === 5 ? 30 : 22),
            orientation: 'landscape',
            showGridlines: true,
            charts: [],
          },
          {
            name: 'Evaluaciones',
            cells: details,
            merges: [],
            columnWidths: [28, 16, 16, 14, 14, 12, 14],
            rowHeights: details.map((_, index) => index === 0 ? 28 : 22),
            orientation: 'landscape',
            showGridlines: true,
            charts: [],
          },
        ],
      }

      const buffer = await buildWorkbookBuffer(workbook)
      downloadBuffer(buffer, `${safeFilename(`${courseName}_${gradebook.subject}_${gradebook.period}`)}.xlsx`, GRADE_MIME)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el Excel')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700">
              Evaluación y avances
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Libro de calificaciones</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Registro nativo por curso, ordenado por apellidos. Agrega evaluaciones, ingresa notas o puntajes y revisa el promedio antes de exportar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!gradebook || saving}
              onClick={() => setShowAssessmentForm((value) => !value)}
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Evaluación
            </button>
            <button
              type="button"
              disabled={!gradebook || exporting}
              onClick={() => void exportPdf()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              PDF
            </button>
            <button
              type="button"
              disabled={!gradebook || exporting}
              onClick={() => void exportExcel()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Excel
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.1fr_1.1fr_.8fr_auto]">
          <label className="text-xs font-black uppercase tracking-wider text-slate-500">
            Curso
            <select
              value={courseId}
              onChange={(event) => { setCourseId(event.target.value); setGradebook(null); setStudents([]); setAssessments([]); setEntries({}) }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">Seleccionar curso</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>

          <label className="text-xs font-black uppercase tracking-wider text-slate-500">
            Asignatura / seguimiento
            <input
              value={subject}
              onChange={(event) => { setSubject(event.target.value); setGradebook(null); setStudents([]); setAssessments([]); setEntries({}) }}
              placeholder="Ej. Matemática"
              maxLength={120}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-blue-500"
            />
          </label>

          <label className="text-xs font-black uppercase tracking-wider text-slate-500">
            Periodo
            <select
              value={period}
              onChange={(event) => { setPeriod(event.target.value as '1S' | '2S'); setGradebook(null); setStudents([]); setAssessments([]); setEntries({}) }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="1S">1° Semestre</option>
              <option value="2S">2° Semestre</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => void openGradebook()}
            disabled={loading || !courseId || !subject.trim()}
            className="self-end rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {loading ? 'Cargando…' : 'Abrir curso'}
          </button>
        </div>
      </section>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Escala oficial</div>
          <div className="mt-1 text-xl font-black text-slate-950">1,0 → 7,0</div>
          <div className="mt-1 text-xs text-slate-500">Aprobación mínima: 4,0</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Exigencia</div>
          {gradebook ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="99"
                step="1"
                value={passingDraft}
                onChange={(event) => setPassingDraft(event.target.value)}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-lg font-black"
              />
              <span className="font-black text-slate-700">%</span>
              <button
                type="button"
                onClick={() => void savePassingPercent()}
                disabled={saving}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700"
              >
                Aplicar
              </button>
            </div>
          ) : (
            <div className="mt-1 text-xl font-black text-slate-950">60%</div>
          )}
          <div className="mt-1 text-xs text-slate-500">Parámetro institucional editable.</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Promedio curso</div>
          <div className={`mt-1 text-2xl font-black ${courseAverage != null && courseAverage < 4 ? 'text-red-600' : 'text-slate-950'}`}>
            {courseAverage == null ? '—' : courseAverage.toFixed(1)}
          </div>
          <div className="mt-1 text-xs text-slate-500">{orderedStudents.length} estudiantes</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Aprobación vista previa</div>
          <div className="mt-1 text-2xl font-black text-slate-950">{approvalPercent == null ? '—' : `${approvalPercent}%`}</div>
          <div className="mt-1 text-xs text-slate-500">{assessments.filter((item) => item.counts_toward_average).length} evaluaciones incidentes</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
        La escala anual 1,0–7,0 y la aprobación 4,0 corresponden al Decreto 67/2018. La exigencia de 60% se configura aquí como regla institucional y puede modificarse según el reglamento de evaluación del establecimiento.
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div>}

      {showAssessmentForm && gradebook && (
        <form onSubmit={createAssessment} className="mt-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-black text-slate-950">Nueva evaluación</h2>
            <p className="text-sm text-slate-500">Puede ingresar una nota directa o convertir puntaje/porcentaje a nota chilena.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Nombre
              <input
                required
                maxLength={120}
                value={newAssessment.title}
                onChange={(event) => setNewAssessment((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ej. Prueba Unidad 1"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900"
              />
            </label>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Tipo
              <select
                value={newAssessment.kind}
                onChange={(event) => setNewAssessment((current) => ({ ...current, kind: event.target.value as AssessmentKind }))}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900"
              >
                <option value="parcial">Parcial</option>
                <option value="acumulativa">Acumulativa</option>
                <option value="sumativa">Sumativa</option>
                <option value="formativa">Formativa</option>
                <option value="diagnostica">Diagnóstica</option>
                <option value="otra">Otra</option>
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Forma de ingreso
              <select
                value={newAssessment.entry_mode}
                onChange={(event) => setNewAssessment((current) => ({ ...current, entry_mode: event.target.value as EntryMode }))}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900"
              >
                <option value="grade">Nota 1,0–7,0</option>
                <option value="points">Puntaje</option>
                <option value="percent">Porcentaje</option>
              </select>
            </label>
            {newAssessment.entry_mode === 'points' ? (
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Puntaje máximo
                <input
                  required
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={newAssessment.max_points}
                  onChange={(event) => setNewAssessment((current) => ({ ...current, max_points: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900"
                />
              </label>
            ) : (
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Ponderación / coef.
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.1"
                  value={newAssessment.weight}
                  onChange={(event) => setNewAssessment((current) => ({ ...current, weight: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900"
                />
              </label>
            )}
            {newAssessment.entry_mode === 'points' && (
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Ponderación / coef.
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.1"
                  value={newAssessment.weight}
                  onChange={(event) => setNewAssessment((current) => ({ ...current, weight: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900"
                />
              </label>
            )}
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Exigencia propia
              <input
                type="number"
                min="1"
                max="99"
                step="1"
                value={newAssessment.passing_percent}
                onChange={(event) => setNewAssessment((current) => ({ ...current, passing_percent: event.target.value }))}
                placeholder={`Usar ${Number(gradebook.passing_percent)}%`}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900"
              />
            </label>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Fecha
              <input
                type="date"
                value={newAssessment.assessment_date}
                onChange={(event) => setNewAssessment((current) => ({ ...current, assessment_date: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900"
              />
            </label>
            <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={newAssessment.counts_toward_average}
                onChange={(event) => setNewAssessment((current) => ({ ...current, counts_toward_average: event.target.checked }))}
              />
              Incide en el promedio
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? 'Guardando…' : 'Agregar evaluación'}
            </button>
            <button type="button" onClick={() => setShowAssessmentForm(false)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-black text-slate-700">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {gradebook ? (
        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">{currentCourse?.name || 'Curso'} · {gradebook.subject}</h2>
              <p className="mt-1 text-xs text-slate-500">{periodLabel(gradebook.period)} · Vista previa de cálculo · orden alfabético por apellidos</p>
            </div>
            <div className="flex items-center gap-2">
              {dirty.size > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{dirty.size} cambios sin guardar</span>}
              <button
                type="button"
                onClick={() => void saveDirty()}
                disabled={saving || dirty.size === 0}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-30 w-12 min-w-12 border-b border-r border-blue-800 bg-blue-700 px-2 py-3 text-center text-xs font-black text-white">N°</th>
                  <th className="sticky left-12 z-30 min-w-[290px] border-b border-r border-blue-800 bg-blue-700 px-3 py-3 text-left text-xs font-black text-white">Alumno</th>
                  {assessments.map((assessment) => (
                    <th key={assessment.id} className="min-w-[145px] border-b border-r border-blue-800 bg-blue-700 px-2 py-2 text-center align-top text-white">
                      <div className="flex items-start justify-between gap-1">
                        <span className="min-w-0 flex-1 truncate text-xs font-black" title={assessment.title}>{assessment.title}</span>
                        <button
                          type="button"
                          onClick={() => void deleteAssessment(assessment)}
                          className="rounded px-1 text-blue-100 hover:bg-blue-800 hover:text-white"
                          title="Eliminar evaluación"
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-1 flex flex-wrap justify-center gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${kindBadge(assessment.kind)}`}>{assessmentLabel(assessment.kind)}</span>
                        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-black">
                          {assessment.entry_mode === 'grade' ? 'Nota' : assessment.entry_mode === 'points' ? `/${Number(assessment.max_points)} pts` : '%'}
                        </span>
                      </div>
                      <div className="mt-1 text-[9px] font-semibold text-blue-100">
                        Pond. {Number(assessment.weight)} · {assessment.counts_toward_average ? 'incide' : 'no incide'}
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-30 min-w-[88px] border-b border-blue-800 bg-slate-900 px-3 py-3 text-center text-xs font-black text-white">Prom.</th>
                </tr>
              </thead>
              <tbody>
                {orderedStudents.map((student, index) => {
                  const average = averageForStudent(student.id)
                  return (
                    <tr key={student.id} className="group">
                      <td className="sticky left-0 z-20 border-b border-r border-slate-200 bg-white px-2 py-2.5 text-center text-xs font-bold text-slate-500 group-hover:bg-slate-50">{index + 1}</td>
                      <td className="sticky left-12 z-20 border-b border-r border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-800 group-hover:bg-slate-50">{student.label}</td>
                      {assessments.map((assessment) => {
                        const key = keyOf(assessment.id, student.id)
                        const entry = entries[key]
                        const grade = effectiveGrade(assessment, entry)
                        const direct = assessment.entry_mode === 'grade'
                        const inputValue = direct ? entry?.grade : entry?.raw_score
                        return (
                          <td key={assessment.id} className="border-b border-r border-slate-200 bg-white px-2 py-1.5 text-center group-hover:bg-slate-50">
                            <div className="mx-auto flex max-w-[120px] flex-col items-center gap-1">
                              <input
                                type="number"
                                min={direct ? 1 : 0}
                                max={direct ? 7 : assessment.entry_mode === 'percent' ? 100 : Number(assessment.max_points || 0)}
                                step={0.1}
                                value={inputValue == null ? '' : String(inputValue)}
                                onChange={(event) => updateEntry(assessment, student.id, event.target.value)}
                                className={`w-full rounded-lg border px-2 py-1.5 text-center font-black outline-none focus:border-blue-500 ${grade != null && grade < 4 ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-300 bg-white text-slate-800'}`}
                                aria-label={`${assessment.title} - ${student.label}`}
                              />
                              {!direct && (
                                <span className={`text-[10px] font-black ${grade != null && grade < 4 ? 'text-red-600' : 'text-emerald-700'}`}>
                                  {grade == null ? 'Nota —' : `Nota ${grade.toFixed(1)}`}
                                </span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td className={`sticky right-0 z-20 border-b border-slate-200 px-3 py-2.5 text-center text-base font-black ${average != null && average < 4 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-950'}`}>
                        {average == null ? '—' : average.toFixed(1)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {orderedStudents.length === 0 && (
            <div className="p-10 text-center text-sm text-slate-500">Este curso todavía no tiene estudiantes asociados.</div>
          )}

          {orderedStudents.length > 0 && assessments.length === 0 && (
            <div className="border-t border-dashed border-slate-200 p-8 text-center">
              <div className="text-3xl">🧮</div>
              <div className="mt-2 font-black text-slate-900">El curso ya está listo</div>
              <p className="mt-1 text-sm text-slate-500">Agrega la primera evaluación para comenzar a ingresar notas.</p>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-5xl">📊</div>
          <h2 className="mt-4 text-xl font-black text-slate-950">Selecciona el curso y la asignatura</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            El sistema cargará la nómina del curso, ordenará a los estudiantes por apellidos y abrirá una planilla de notas propia de la plataforma.
          </p>
        </section>
      )}
    </div>
  )
}
