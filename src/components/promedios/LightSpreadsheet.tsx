'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Course = { id: string; name: string }
type Student = { id: string; label: string }
type CellValue = string | number

type Props = { workbookId: string; title: string }
type SheetData = { name: string; cells: CellValue[][] }
type WorkbookData = { sheets: SheetData[] }
type ExcelCell = { value: unknown; formula?: string }
type ExcelWorksheet = { name: string; actualRowCount: number; actualColumnCount: number; getCell: (row: number, col: number) => ExcelCell; getRow: (row: number) => { height?: number }; columns: Array<{ width?: number }> }
type ExcelWorkbook = { worksheets: ExcelWorksheet[]; addWorksheet: (name: string) => ExcelWorksheet; xlsx: { load: (buffer: ArrayBuffer) => Promise<void>; writeBuffer: () => Promise<ArrayBuffer> } }
type ExcelWindow = Window & { ExcelJS?: { Workbook: new () => ExcelWorkbook } }

const ROWS = 55
const COLS = 10
const letters = Array.from({ length: COLS }, (_, index) => String.fromCharCode(65 + index))
const EXCELJS_SRC = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'

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
    for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col += 1) values.push(toNumber(sheet.cells[row]?.[col]))
  }
  return values
}

function evalFormula(sheet: SheetData, raw: string): CellValue {
  if (!raw.startsWith('=')) return raw
  const expr = raw.slice(1).trim()
  const fn = expr.match(/^(SUMA|PROMEDIO|MAX|MIN|CONTAR|NOTA)\(([^)]*)\)$/i)
  if (fn) {
    const name = fn[1].toUpperCase()
    const values = rangeValues(sheet, fn[2].trim())
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
  }).replace(/,/g, '.')
  if (!/^[0-9+\-*/().\s]+$/.test(safe)) return '#ERROR'
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${safe})`)()
    return Number.isFinite(result) ? Math.round(result * 1000) / 1000 : '#ERROR'
  } catch { return '#ERROR' }
}

async function ensureExcelJS() {
  const browser = window as ExcelWindow
  if (browser.ExcelJS) return browser.ExcelJS
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${EXCELJS_SRC}"]`) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar el motor XLSX')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = EXCELJS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el motor XLSX'))
    document.head.appendChild(script)
  })
  if (!browser.ExcelJS) throw new Error('Motor XLSX no disponible')
  return browser.ExcelJS
}

function fromExcelValue(cell: ExcelCell): CellValue {
  if (cell.formula) return `=${cell.formula}`
  const value = cell.value
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'text' in value) return String((value as { text?: unknown }).text ?? '')
  return value == null ? '' : String(value)
}

function excelFormula(raw: string) {
  let formula = raw.replace(/^=/, '')
  formula = formula.replace(/^SUMA\(/i, 'SUM(').replace(/^PROMEDIO\(/i, 'AVERAGE(').replace(/^CONTAR\(/i, 'COUNT(').replace(/^SI\(/i, 'IF(').replace(/;/g, ',')
  if (/^NOTA\(([^)]+)\)$/i.test(formula)) {
    const ref = formula.match(/^NOTA\(([^)]+)\)$/i)?.[1] || 'A1'
    return `IF(${ref}<=60,1+(${ref}/60)*3,4+((${ref}-60)/40)*3)`
  }
  return formula
}

export default function LightSpreadsheet({ workbookId, title }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<'alias' | 'name'>('alias')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeSheet, setActiveSheet] = useState(0)
  const [workbook, setWorkbook] = useState<WorkbookData>({ sheets: [emptySheet()] })
  const [selected, setSelected] = useState({ row: 0, col: 0 })
  const [formulaBar, setFormulaBar] = useState('')

  const sheet = workbook.sheets[activeSheet] ?? workbook.sheets[0]
  const displayed = useMemo(() => sheet.cells.map((row) => row.map((cell) => typeof cell === 'string' && cell.startsWith('=') ? evalFormula(sheet, cell) : cell)), [sheet])

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        const [courseResponse, fileResponse, ExcelJS] = await Promise.all([
          fetch('/api/promedios/cursos', { cache: 'no-store' }),
          fetch(`/api/promedios/${workbookId}/download`, { cache: 'no-store' }),
          ensureExcelJS(),
        ])
        const coursePayload = await courseResponse.json()
        if (!courseResponse.ok) throw new Error(coursePayload.error || 'No se pudieron cargar los cursos')
        if (!fileResponse.ok) throw new Error('No se pudo recuperar el libro desde Supabase')
        const xlsx = new ExcelJS.Workbook()
        await xlsx.xlsx.load(await fileResponse.arrayBuffer())
        const sheets = xlsx.worksheets.map((ws) => {
          const rows = Math.max(ROWS, Math.min(200, ws.actualRowCount || ROWS))
          const cols = Math.max(COLS, Math.min(26, ws.actualColumnCount || COLS))
          const cells = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => fromExcelValue(ws.getCell(row + 1, col + 1))))
          return { name: ws.name, cells }
        })
        if (!cancelled) {
          setCourses(coursePayload.courses ?? [])
          setWorkbook({ sheets: sheets.length ? sheets : [emptySheet()] })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo abrir la planilla')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    boot()
    return () => { cancelled = true }
  }, [workbookId])

  const updateCell = (row: number, col: number, value: CellValue) => {
    setWorkbook((current) => ({ ...current, sheets: current.sheets.map((item, index) => index === activeSheet ? { ...item, cells: item.cells.map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? value : c) : r) } : item) }))
  }

  const chooseCell = (row: number, col: number) => {
    setSelected({ row, col })
    setFormulaBar(String(sheet.cells[row]?.[col] ?? ''))
  }

  const addSheet = () => {
    const next = workbook.sheets.length
    setWorkbook((current) => ({ ...current, sheets: [...current.sheets, emptySheet(`Hoja ${next + 1}`)] }))
    setActiveSheet(next)
  }

  const addCourseSheet = async () => {
    if (!courseId) return setNotice('Selecciona un curso.')
    setNotice('')
    setError('')
    try {
      const response = await fetch(`/api/promedios/cursos/${courseId}/estudiantes?mode=${mode}&workbookId=${workbookId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo obtener la nómina')
      const students = (payload.students ?? []) as Student[]
      const course = courses.find((item) => item.id === courseId)
      const target = emptySheet((course?.name || `Hoja ${workbook.sheets.length + 1}`).slice(0, 31))
      ;['Estudiante', 'Avance 1', 'Avance 2', 'Avance 3', '% Final', 'Nota', 'Estado'].forEach((label, col) => { target.cells[0][col] = label })
      students.slice(0, ROWS - 1).forEach((student, index) => {
        const row = index + 1
        target.cells[row][0] = student.label
        target.cells[row][4] = `=B${row + 1}*0.3+C${row + 1}*0.3+D${row + 1}*0.4`
        target.cells[row][5] = `=NOTA(E${row + 1})`
        target.cells[row][6] = `=SI(F${row + 1}>=4;"APROBADO";"REPROBADO")`
      })
      const next = workbook.sheets.length
      setWorkbook((current) => ({ ...current, sheets: [...current.sheets, target] }))
      setActiveSheet(next)
      setNotice(`Hoja creada con ${students.length} estudiantes.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar el curso') }
  }

  const save = async () => {
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const ExcelJS = await ensureExcelJS()
      const xlsx = new ExcelJS.Workbook()
      workbook.sheets.forEach((source) => {
        const ws = xlsx.addWorksheet(source.name.slice(0, 31) || 'Hoja')
        source.cells.forEach((row, rowIndex) => row.forEach((value, colIndex) => {
          if (value === '') return
          const cell = ws.getCell(rowIndex + 1, colIndex + 1)
          if (typeof value === 'string' && value.startsWith('=')) cell.value = { formula: excelFormula(value) }
          else cell.value = value
        }))
        ws.columns.forEach((column, index) => { column.width = index === 0 ? 24 : 14 })
        ws.getRow(1).height = 22
      })
      const buffer = await xlsx.xlsx.writeBuffer()
      const response = await fetch(`/api/promedios/${workbookId}/save`, { method: 'PUT', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: buffer })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar')
      setNotice('Cambios guardados en Supabase.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex min-h-screen min-w-0 flex-1 items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500">Abriendo planilla desde Supabase…</div>

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100">
      <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/promedios" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">← Promedios</Link>
            <div className="min-w-0"><div className="truncate text-lg font-black text-slate-900">{title}</div><div className="text-xs text-slate-500">Planilla docente ligera · cálculos locales · guardado solo en Supabase</div></div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"><option value="">Curso…</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
            <select value={mode} onChange={(e) => setMode(e.target.value === 'name' ? 'name' : 'alias')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"><option value="alias">Alias</option><option value="name">Nombres</option></select>
            <button onClick={addCourseSheet} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700">+ Hoja desde curso</button>
            <button onClick={save} disabled={saving} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            <a href={`/api/promedios/${workbookId}/download`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Descargar .xlsx</a>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">Fórmulas: SUMA, PROMEDIO, MAX, MIN, CONTAR, SI, NOTA y operaciones + − × ÷.</div>
        {notice && <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">{notice}</div>}
        {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6"><div className="flex items-center gap-2"><div className="w-16 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-center text-xs font-black text-slate-600">{letters[selected.col] || '?'}{selected.row + 1}</div><input value={formulaBar} onChange={(e) => setFormulaBar(e.target.value)} onBlur={() => updateCell(selected.row, selected.col, formulaBar)} onKeyDown={(e) => { if (e.key === 'Enter') updateCell(selected.row, selected.col, formulaBar) }} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Valor o fórmula, ej. =PROMEDIO(B2:D2)" /></div></div>

      <div className="flex-1 overflow-auto bg-white"><table className="min-w-max border-collapse text-sm"><thead className="sticky top-0 z-20 bg-slate-100"><tr><th className="h-8 w-12 border border-slate-300 bg-slate-200"></th>{sheet.cells[0].map((_, index) => <th key={index} className="h-8 min-w-28 border border-slate-300 px-2 text-center font-black text-slate-700">{index < 26 ? String.fromCharCode(65 + index) : index + 1}</th>)}</tr></thead><tbody>{sheet.cells.map((row, rowIndex) => <tr key={rowIndex}><th className="sticky left-0 z-10 w-12 border border-slate-300 bg-slate-100 text-center text-xs font-black text-slate-600">{rowIndex + 1}</th>{row.map((cell, colIndex) => { const active = selected.row === rowIndex && selected.col === colIndex; return <td key={`${rowIndex}-${colIndex}`} className={`border border-slate-300 p-0 ${active ? 'ring-2 ring-inset ring-blue-500' : ''}`} onClick={() => chooseCell(rowIndex, colIndex)}><input value={active ? String(cell ?? '') : String(displayed[rowIndex]?.[colIndex] ?? '')} onFocus={() => chooseCell(rowIndex, colIndex)} onChange={(e) => { updateCell(rowIndex, colIndex, e.target.value); setFormulaBar(e.target.value) }} className="h-9 w-28 border-0 bg-transparent px-2 outline-none" /></td> })}</tr>)}</tbody></table></div>

      <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-200 bg-slate-100 px-4 py-2">{workbook.sheets.map((item, index) => <button key={`${item.name}-${index}`} onClick={() => setActiveSheet(index)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black ${activeSheet === index ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>{item.name}</button>)}<button onClick={addSheet} className="rounded-lg border border-dashed border-slate-400 px-3 py-2 text-xs font-black text-slate-600">+ Hoja</button></div>
    </div>
  )
}
