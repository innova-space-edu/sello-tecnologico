'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

type Course = { id: string; name: string }
type Student = { id: string; label: string }
type CellValue = string | number

type Props = {
  workbookId: string
  title: string
}

type SheetData = {
  name: string
  cells: CellValue[][]
}

type WorkbookData = {
  sheets: SheetData[]
}

const ROWS = 55
const COLS = 10
const letters = Array.from({ length: COLS }, (_, index) => String.fromCharCode(65 + index))

function emptySheet(name = 'Hoja 1'): SheetData {
  return { name, cells: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => '')) }
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function notaChile(percent: number, exigencia = 60) {
  const p = Math.max(0, Math.min(100, percent))
  const e = Math.max(1, Math.min(99, exigencia))
  const grade = p <= e ? 1 + (p / e) * 3 : 4 + ((p - e) / (100 - e)) * 3
  return Math.max(1, Math.min(7, Math.round(grade * 10) / 10))
}

function cellRefToIndex(ref: string) {
  const match = ref.match(/^([A-J])(\d+)$/i)
  if (!match) return null
  return { col: match[1].toUpperCase().charCodeAt(0) - 65, row: Number(match[2]) - 1 }
}

function rangeValues(sheet: SheetData, token: string) {
  const [a, b] = token.split(':')
  const start = cellRefToIndex(a)
  const end = cellRefToIndex(b || a)
  if (!start || !end) return []
  const values: number[] = []
  for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
    for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col += 1) {
      values.push(toNumber(sheet.cells[row]?.[col]))
    }
  }
  return values
}

function evalFormula(sheet: SheetData, raw: string): CellValue {
  if (!raw.startsWith('=')) return raw
  const expr = raw.slice(1).trim()
  const fn = expr.match(/^(SUMA|PROMEDIO|MAX|MIN|CONTAR|NOTA)\(([^)]*)\)$/i)
  if (fn) {
    const name = fn[1].toUpperCase()
    const arg = fn[2].trim()
    const values = rangeValues(sheet, arg)
    if (name === 'SUMA') return values.reduce((a, b) => a + b, 0)
    if (name === 'PROMEDIO') return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
    if (name === 'MAX') return values.length ? Math.max(...values) : 0
    if (name === 'MIN') return values.length ? Math.min(...values) : 0
    if (name === 'CONTAR') return values.filter((value) => Number.isFinite(value)).length
    if (name === 'NOTA') return notaChile(values[0] ?? 0)
  }

  const ifMatch = expr.match(/^SI\(([^;]+);([^;]+);(.+)\)$/i)
  if (ifMatch) {
    const condition = ifMatch[1].trim().match(/^([A-J]\d+)\s*(>=|<=|>|<|=)\s*([0-9.,]+)$/i)
    if (condition) {
      const ref = cellRefToIndex(condition[1])
      const left = ref ? toNumber(sheet.cells[ref.row]?.[ref.col]) : 0
      const right = toNumber(condition[3])
      const op = condition[2]
      const ok = op === '>=' ? left >= right : op === '<=' ? left <= right : op === '>' ? left > right : op === '<' ? left < right : left === right
      return String(ok ? ifMatch[2] : ifMatch[3]).replace(/^['\"]|['\"]$/g, '')
    }
  }

  let safe = expr.replace(/([A-J]\d+)/gi, (refText) => {
    const ref = cellRefToIndex(refText)
    return ref ? String(toNumber(sheet.cells[ref.row]?.[ref.col])) : '0'
  })
  safe = safe.replace(/,/g, '.')
  if (!/^[0-9+\-*/().\s]+$/.test(safe)) return '#ERROR'
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${safe})`)()
    return Number.isFinite(result) ? Math.round(result * 1000) / 1000 : '#ERROR'
  } catch {
    return '#ERROR'
  }
}

export default function LightSpreadsheet({ workbookId, title }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<'alias' | 'name'>('alias')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeSheet, setActiveSheet] = useState(0)
  const [workbook, setWorkbook] = useState<WorkbookData>({ sheets: [emptySheet()] })
  const [selected, setSelected] = useState({ row: 0, col: 0 })
  const [formulaBar, setFormulaBar] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const sheet = workbook.sheets[activeSheet] ?? workbook.sheets[0]
  const displayed = useMemo(() => sheet.cells.map((row) => row.map((cell) => typeof cell === 'string' && cell.startsWith('=') ? evalFormula(sheet, cell) : cell)), [sheet])

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const response = await fetch('/api/promedios/cursos', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar los cursos')
        setCourses(payload.courses ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los cursos')
      }
    }
    loadCourses()
  }, [])

  const updateCell = (row: number, col: number, value: CellValue) => {
    setWorkbook((current) => ({
      ...current,
      sheets: current.sheets.map((item, index) => index === activeSheet
        ? { ...item, cells: item.cells.map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? value : c) : r) }
        : item),
    }))
  }

  const chooseCell = (row: number, col: number) => {
    setSelected({ row, col })
    setFormulaBar(String(sheet.cells[row]?.[col] ?? ''))
  }

  const addSheet = () => {
    const nextName = `Hoja ${workbook.sheets.length + 1}`
    setWorkbook((current) => ({ ...current, sheets: [...current.sheets, emptySheet(nextName)] }))
    setActiveSheet(workbook.sheets.length)
  }

  const addCourseSheet = async () => {
    if (!courseId) return setNotice('Selecciona un curso.')
    setNotice('')
    try {
      const response = await fetch(`/api/promedios/cursos/${courseId}/estudiantes?mode=${mode}&workbookId=${workbookId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo obtener la nómina')
      const students = (payload.students ?? []) as Student[]
      const course = courses.find((item) => item.id === courseId)
      const target = emptySheet((course?.name || `Hoja ${workbook.sheets.length + 1}`).slice(0, 31))
      target.cells[0][0] = 'Estudiante'
      target.cells[0][1] = 'Avance 1'
      target.cells[0][2] = 'Avance 2'
      target.cells[0][3] = 'Avance 3'
      target.cells[0][4] = '% Final'
      target.cells[0][5] = 'Nota'
      target.cells[0][6] = 'Estado'
      students.slice(0, ROWS - 1).forEach((student, index) => {
        const row = index + 1
        target.cells[row][0] = student.label
        target.cells[row][4] = `=B${row + 1}*0.3+C${row + 1}*0.3+D${row + 1}*0.4`
        target.cells[row][5] = `=NOTA(E${row + 1})`
        target.cells[row][6] = `=SI(F${row + 1}>=4;"APROBADO";"REPROBADO")`
      })
      setWorkbook((current) => ({ ...current, sheets: [...current.sheets, target] }))
      setActiveSheet(workbook.sheets.length)
      setNotice(`Hoja creada con ${students.length} estudiantes.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el curso')
    }
  }

  const save = async () => {
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const response = await fetch(`/api/promedios/${workbookId}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: new TextEncoder().encode(JSON.stringify(workbook)),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar')
      setNotice('Cambios guardados en Supabase.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100">
      <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/promedios" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">← Promedios</Link>
            <div>
              <div className="text-lg font-black text-slate-900">{title}</div>
              <div className="text-xs text-slate-500">Planilla docente ligera · cálculos en la página · guardado solo en Supabase</div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              <option value="">Curso…</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value === 'name' ? 'name' : 'alias')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              <option value="alias">Alias</option>
              <option value="name">Nombres</option>
            </select>
            <button onClick={addCourseSheet} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700">+ Hoja desde curso</button>
            <button onClick={save} disabled={saving} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            <a href={`/api/promedios/${workbookId}/download`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Descargar</a>
          </div>
        </div>
        {notice && <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">{notice}</div>}
        {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="w-16 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-center text-xs font-black text-slate-600">{letters[selected.col]}{selected.row + 1}</div>
          <input value={formulaBar} onChange={(e) => setFormulaBar(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') updateCell(selected.row, selected.col, formulaBar) }} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Valor o fórmula, ej. =PROMEDIO(B2:D2)" />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-slate-100">
            <tr><th className="h-8 w-12 border border-slate-300 bg-slate-200"></th>{letters.map((letter) => <th key={letter} className="h-8 min-w-28 border border-slate-300 px-2 text-center font-black text-slate-700">{letter}</th>)}</tr>
          </thead>
          <tbody>
            {sheet.cells.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th className="sticky left-0 z-10 w-12 border border-slate-300 bg-slate-100 text-center text-xs font-black text-slate-600">{rowIndex + 1}</th>
                {row.map((cell, colIndex) => {
                  const active = selected.row === rowIndex && selected.col === colIndex
                  return <td key={`${rowIndex}-${colIndex}`} className={`border border-slate-300 p-0 ${active ? 'ring-2 ring-inset ring-blue-500' : ''}`} onClick={() => chooseCell(rowIndex, colIndex)}>
                    <input value={active ? String(cell ?? '') : String(displayed[rowIndex]?.[colIndex] ?? '')} onFocus={() => chooseCell(rowIndex, colIndex)} onChange={(e) => { updateCell(rowIndex, colIndex, e.target.value); setFormulaBar(e.target.value) }} className="h-9 w-28 border-0 bg-transparent px-2 outline-none" />
                  </td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-100 px-4 py-2">
        {workbook.sheets.map((item, index) => <button key={`${item.name}-${index}`} onClick={() => setActiveSheet(index)} className={`rounded-lg px-3 py-2 text-xs font-black ${activeSheet === index ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>{item.name}</button>)}
        <button onClick={addSheet} className="rounded-lg border border-dashed border-slate-400 px-3 py-2 text-xs font-black text-slate-600">+ Hoja</button>
        <input ref={fileRef} type="file" className="hidden" />
      </div>
    </div>
  )
}
