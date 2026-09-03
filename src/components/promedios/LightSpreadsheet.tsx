'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

type Course = { id: string; name: string }
type Student = { id: string; label: string }
type Primitive = string | number | boolean

type CellStyle = {
  bold?: boolean
  italic?: boolean
  background?: string
  color?: string
  horizontal?: 'left' | 'center' | 'right'
  vertical?: 'top' | 'middle' | 'bottom'
  wrap?: boolean
  numberFormat?: string
}

type GridCell = {
  value: Primitive
  formula?: string
  cached?: Primitive
  style?: CellStyle
}

type MergeRange = {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

type SheetData = {
  name: string
  cells: GridCell[][]
  merges: MergeRange[]
  columnWidths: number[]
  rowHeights: number[]
}

type WorkbookData = { sheets: SheetData[] }
type Props = { workbookId: string; title: string }

type ExcelCell = {
  value: unknown
  formula?: string
  result?: unknown
  font?: { bold?: boolean; italic?: boolean; color?: { argb?: string } }
  fill?: { type?: string; pattern?: string; fgColor?: { argb?: string } }
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean }
  numFmt?: string
}

type ExcelColumn = { width?: number }
type ExcelRow = { height?: number }
type ExcelWorksheet = {
  name: string
  actualRowCount: number
  actualColumnCount: number
  model?: { merges?: string[] }
  getCell: (row: number, col: number) => ExcelCell
  getRow: (row: number) => ExcelRow
  columns: ExcelColumn[]
  mergeCells: (range: string) => void
}
type ExcelWorkbook = {
  worksheets: ExcelWorksheet[]
  addWorksheet: (name: string) => ExcelWorksheet
  xlsx: { load: (buffer: ArrayBuffer) => Promise<void>; writeBuffer: () => Promise<ArrayBuffer> }
}
type ExcelWindow = Window & { ExcelJS?: { Workbook: new () => ExcelWorkbook } }

const DEFAULT_ROWS = 40
const DEFAULT_COLS = 10
const MAX_ROWS = 800
const MAX_COLS = 100
const EXCELJS_SRC = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'

function emptyCell(): GridCell {
  return { value: '' }
}

function emptySheet(name = 'Hoja 1', rows = DEFAULT_ROWS, cols = DEFAULT_COLS): SheetData {
  return {
    name,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, emptyCell)),
    merges: [],
    columnWidths: Array.from({ length: cols }, (_, index) => index === 0 ? 24 : 14),
    rowHeights: Array.from({ length: rows }, () => 22),
  }
}

function columnLabel(index: number) {
  let value = index + 1
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function parseCellRef(ref: string) {
  const match = ref.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i)
  if (!match) return null
  let col = 0
  for (const char of match[1].toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64
  return { row: Number(match[2]) - 1, col: col - 1 }
}

function parseRange(range: string): MergeRange | null {
  const [a, b = a] = range.split(':')
  const start = parseCellRef(a)
  const end = parseCellRef(b)
  if (!start || !end) return null
  return {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  }
}

function rangeAddress(merge: MergeRange) {
  return `${columnLabel(merge.startCol)}${merge.startRow + 1}:${columnLabel(merge.endCol)}${merge.endRow + 1}`
}

function mergeAt(merges: MergeRange[], row: number, col: number) {
  const merge = merges.find((item) => row >= item.startRow && row <= item.endRow && col >= item.startCol && col <= item.endCol)
  if (!merge) return null
  return { merge, master: row === merge.startRow && col === merge.startCol }
}

function toPrimitive(value: unknown): Primitive {
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toLocaleDateString('es-CL')
  if (value && typeof value === 'object') {
    const objectValue = value as { text?: unknown; richText?: Array<{ text?: unknown }>; result?: unknown }
    if (objectValue.richText) return objectValue.richText.map((item) => String(item.text ?? '')).join('')
    if ('text' in objectValue) return String(objectValue.text ?? '')
    if ('result' in objectValue) return toPrimitive(objectValue.result)
  }
  return value == null ? '' : String(value)
}

function normalizeArgb(argb?: string) {
  if (!argb) return undefined
  const clean = argb.replace(/^#/, '')
  if (clean.length === 8) return `#${clean.slice(2)}`
  if (clean.length === 6) return `#${clean}`
  return undefined
}

function fromExcelCell(cell: ExcelCell): GridCell {
  const style: CellStyle = {
    bold: cell.font?.bold,
    italic: cell.font?.italic,
    color: normalizeArgb(cell.font?.color?.argb),
    background: normalizeArgb(cell.fill?.fgColor?.argb),
    horizontal: ['left', 'center', 'right'].includes(String(cell.alignment?.horizontal)) ? cell.alignment?.horizontal as CellStyle['horizontal'] : undefined,
    vertical: ['top', 'middle', 'bottom'].includes(String(cell.alignment?.vertical)) ? cell.alignment?.vertical as CellStyle['vertical'] : undefined,
    wrap: cell.alignment?.wrapText,
    numberFormat: cell.numFmt,
  }

  if (cell.formula) {
    return {
      value: `=${cell.formula}`,
      formula: cell.formula,
      cached: cell.result == null ? undefined : toPrimitive(cell.result),
      style,
    }
  }
  return { value: toPrimitive(cell.value), style }
}

function toNumber(value: Primitive | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const text = String(value ?? '').trim()
  if (!text) return 0
  const parsed = Number(text.replace(/%$/, '').replace(',', '.'))
  if (!Number.isFinite(parsed)) return 0
  return text.endsWith('%') ? parsed / 100 : parsed
}

function isNumeric(value: Primitive | undefined) {
  if (typeof value === 'number') return true
  if (typeof value === 'boolean') return false
  const text = String(value ?? '').trim()
  return text !== '' && Number.isFinite(Number(text.replace(/%$/, '').replace(',', '.')))
}

function compareValues(left: Primitive | undefined, right: Primitive | undefined, operator: string) {
  if (isNumeric(left) && isNumeric(right)) {
    const a = toNumber(left)
    const b = toNumber(right)
    if (operator === '>=') return a >= b
    if (operator === '<=') return a <= b
    if (operator === '<>') return a !== b
    if (operator === '>') return a > b
    if (operator === '<') return a < b
    return a === b
  }

  const a = String(left ?? '')
  const b = String(right ?? '')
  if (operator === '>=') return a >= b
  if (operator === '<=') return a <= b
  if (operator === '<>') return a !== b
  if (operator === '>') return a > b
  if (operator === '<') return a < b
  return a === b
}

function notaChile(percent: number, exigencia = 60) {
  const p = Math.max(0, Math.min(100, percent))
  const e = Math.max(1, Math.min(99, exigencia))
  const grade = p <= e ? 1 + (p / e) * 3 : 4 + ((p - e) / (100 - e)) * 3
  return Math.max(1, Math.min(7, Math.round(grade * 10) / 10))
}

function splitArgs(input: string) {
  const args: string[] = []
  let current = ''
  let depth = 0
  let quote = ''
  const separator = input.includes(';') ? ';' : ','

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if ((char === '"' || char === "'") && input[index - 1] !== '\\') {
      if (!quote) quote = char
      else if (quote === char) quote = ''
      current += char
      continue
    }
    if (!quote) {
      if (char === '(') depth += 1
      if (char === ')') depth -= 1
      if (depth === 0 && char === separator) {
        args.push(current.trim())
        current = ''
        continue
      }
    }
    current += char
  }
  args.push(current.trim())
  return args
}

function rangeValues(sheet: SheetData, token: string, visited: Set<string>) {
  const parsed = parseRange(token.replace(/\$/g, ''))
  if (!parsed) return []
  const values: Primitive[] = []
  for (let row = parsed.startRow; row <= parsed.endRow; row += 1) {
    for (let col = parsed.startCol; col <= parsed.endCol; col += 1) {
      values.push(computeCell(sheet, row, col, new Set(visited)))
    }
  }
  return values
}

function evaluateCondition(sheet: SheetData, expression: string, visited: Set<string>) {
  const match = expression.match(/^(.*?)(>=|<=|<>|=|>|<)(.*)$/)
  if (!match) return Boolean(evaluateExpression(sheet, expression, visited))
  const left = evaluateExpression(sheet, match[1].trim(), new Set(visited))
  const right = evaluateExpression(sheet, match[3].trim(), new Set(visited))
  return compareValues(left, right, match[2])
}

function evaluateArithmetic(sheet: SheetData, expression: string, visited: Set<string>): Primitive | undefined {
  const safe = expression
    .replace(/\$?([A-Z]+)\$?(\d+)/gi, (match) => {
      const ref = parseCellRef(match)
      if (!ref) return '0'
      return String(toNumber(computeCell(sheet, ref.row, ref.col, new Set(visited))))
    })
    .replace(/(\d+(?:[.,]\d+)?)%/g, '($1/100)')
    .replace(/,/g, '.')

  if (!/^[0-9+\-*/().\s]+$/.test(safe)) return undefined
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${safe})`)()
    return Number.isFinite(result) ? Math.round(result * 10000) / 10000 : undefined
  } catch {
    return undefined
  }
}

function evaluateExpression(sheet: SheetData, raw: string, visited: Set<string>): Primitive | undefined {
  const expression = raw.trim()
  if (!expression) return ''
  if ((expression.startsWith('"') && expression.endsWith('"')) || (expression.startsWith("'") && expression.endsWith("'"))) return expression.slice(1, -1)
  if (/^-?\d+(?:[.,]\d+)?%?$/.test(expression)) return toNumber(expression)

  const ref = parseCellRef(expression)
  if (ref) return computeCell(sheet, ref.row, ref.col, new Set(visited))

  const call = expression.match(/^([A-ZÁÉÍÓÚ.]+)\((.*)\)$/i)
  if (call) {
    const name = call[1].toUpperCase()
    const args = splitArgs(call[2])

    if (name === 'SI' || name === 'IF') {
      if (args.length < 2) return undefined
      const condition = evaluateCondition(sheet, args[0], new Set(visited))
      return evaluateExpression(sheet, condition ? args[1] : (args[2] ?? '""'), new Set(visited))
    }
    if (name === 'SI.ERROR' || name === 'IFERROR') {
      const result = evaluateExpression(sheet, args[0] ?? '', new Set(visited))
      return result === undefined ? evaluateExpression(sheet, args[1] ?? '""', new Set(visited)) : result
    }
    if (name === 'Y' || name === 'AND') return args.every((arg) => evaluateCondition(sheet, arg, new Set(visited)))
    if (name === 'O' || name === 'OR') return args.some((arg) => evaluateCondition(sheet, arg, new Set(visited)))
    if (name === 'NOTA') return notaChile(toNumber(evaluateExpression(sheet, args[0] ?? '0', new Set(visited))))

    if (name === 'REDONDEAR' || name === 'ROUND') {
      const value = toNumber(evaluateExpression(sheet, args[0] ?? '0', new Set(visited)))
      const digits = Math.max(0, Math.min(8, Math.round(toNumber(evaluateExpression(sheet, args[1] ?? '0', new Set(visited))))))
      const factor = 10 ** digits
      return Math.round(value * factor) / factor
    }

    if (name === 'SUMAPRODUCTO' || name === 'SUMPRODUCT') {
      const ranges = args.map((arg) => rangeValues(sheet, arg, visited))
      if (!ranges.length || ranges.some((range) => range.length !== ranges[0].length)) return undefined
      return ranges[0].reduce((sum, _, index) => sum + ranges.reduce((product, range) => product * toNumber(range[index]), 1), 0)
    }

    if (name === 'CONTAR.SI' || name === 'COUNTIF') {
      const values = rangeValues(sheet, args[0] ?? '', visited)
      const criterion = String(evaluateExpression(sheet, args[1] ?? '""', new Set(visited)) ?? '')
      const criterionMatch = criterion.match(/^(>=|<=|<>|=|>|<)?\s*(.*)$/)
      const operator = criterionMatch?.[1] || '='
      const target = criterionMatch?.[2] ?? criterion
      return values.filter((value) => compareValues(value, target, operator)).length
    }

    const values = args
      .flatMap((arg) => arg.includes(':') ? rangeValues(sheet, arg, visited) : [evaluateExpression(sheet, arg, new Set(visited))])
      .filter((value): value is Primitive => value !== undefined)
    const numbers = values.filter(isNumeric).map(toNumber)

    if (name === 'SUMA' || name === 'SUM') return numbers.reduce((sum, value) => sum + value, 0)
    if (name === 'PROMEDIO' || name === 'AVERAGE') return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0
    if (name === 'MAX') return numbers.length ? Math.max(...numbers) : 0
    if (name === 'MIN') return numbers.length ? Math.min(...numbers) : 0
    if (name === 'CONTAR' || name === 'COUNT') return numbers.length
    if (name === 'CONTARA' || name === 'COUNTA') return values.filter((value) => String(value ?? '').trim() !== '').length
    if (name === 'ABS') return Math.abs(toNumber(values[0]))
    return undefined
  }

  return evaluateArithmetic(sheet, expression, visited)
}

function computeCell(sheet: SheetData, row: number, col: number, visited = new Set<string>()): Primitive {
  const key = `${row}:${col}`
  if (visited.has(key)) return '#CICLO'
  visited.add(key)

  const cell = sheet.cells[row]?.[col]
  if (!cell) return ''
  if (!cell.formula && !(typeof cell.value === 'string' && cell.value.startsWith('='))) return cell.value

  const formula = cell.formula || String(cell.value).slice(1)
  const calculated = evaluateExpression(sheet, formula, visited)
  if (calculated !== undefined) return calculated
  if (cell.cached !== undefined) return cell.cached
  return `=${formula}`
}

function formatDisplay(cell: GridCell, computed: Primitive) {
  if (typeof computed === 'number' && cell.style?.numberFormat?.includes('%')) return `${Math.round(computed * 10000) / 100}%`
  return String(computed ?? '')
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

function excelFormula(raw: string) {
  let formula = raw.replace(/^=/, '')
  formula = formula
    .replace(/\bSUMA\(/gi, 'SUM(')
    .replace(/\bPROMEDIO\(/gi, 'AVERAGE(')
    .replace(/\bCONTAR\.SI\(/gi, 'COUNTIF(')
    .replace(/\bCONTARA\(/gi, 'COUNTA(')
    .replace(/\bCONTAR\(/gi, 'COUNT(')
    .replace(/\bSUMAPRODUCTO\(/gi, 'SUMPRODUCT(')
    .replace(/\bREDONDEAR\(/gi, 'ROUND(')
    .replace(/\bSI\.ERROR\(/gi, 'IFERROR(')
    .replace(/\bSI\(/gi, 'IF(')
    .replace(/\bY\(/gi, 'AND(')
    .replace(/\bO\(/gi, 'OR(')
    .replace(/;/g, ',')

  if (/^NOTA\(([^)]+)\)$/i.test(formula)) {
    const ref = formula.match(/^NOTA\(([^)]+)\)$/i)?.[1] || 'A1'
    return `IF(${ref}<=60,1+(${ref}/60)*3,4+((${ref}-60)/40)*3)`
  }
  return formula
}

function applyExcelStyle(cell: ExcelCell, style?: CellStyle) {
  if (!style) return
  if (style.bold || style.italic || style.color) {
    cell.font = {
      bold: style.bold,
      italic: style.italic,
      color: style.color ? { argb: `FF${style.color.replace('#', '').toUpperCase()}` } : undefined,
    }
  }
  if (style.background) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${style.background.replace('#', '').toUpperCase()}` },
    }
  }
  if (style.horizontal || style.vertical || style.wrap) {
    cell.alignment = {
      horizontal: style.horizontal,
      vertical: style.vertical,
      wrapText: style.wrap,
    }
  }
  if (style.numberFormat) cell.numFmt = style.numberFormat
}

function renderStyle(cell: GridCell): CSSProperties {
  return {
    backgroundColor: cell.style?.background,
    color: cell.style?.color,
    fontWeight: cell.style?.bold ? 800 : undefined,
    fontStyle: cell.style?.italic ? 'italic' : undefined,
    textAlign: cell.style?.horizontal,
    whiteSpace: cell.style?.wrap ? 'normal' : 'nowrap',
    verticalAlign: cell.style?.vertical,
  }
}

export default function LightSpreadsheet({ workbookId, title }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<'alias' | 'name'>('alias')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)
  const [activeSheet, setActiveSheet] = useState(0)
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null)
  const [selected, setSelected] = useState({ row: 0, col: 0 })
  const [formulaBar, setFormulaBar] = useState('')
  const [sourceName, setSourceName] = useState('')

  const sheet = workbook?.sheets[activeSheet] ?? null
  const displayed = useMemo(() => {
    if (!sheet) return []
    return sheet.cells.map((row, rowIndex) => row.map((cell, colIndex) => formatDisplay(cell, computeCell(sheet, rowIndex, colIndex))))
  }, [sheet])

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
    void loadCourses()
  }, [])

  const loadBuffer = async (buffer: ArrayBuffer, label: string) => {
    setOpening(true)
    setError('')
    setNotice('')
    try {
      const ExcelJS = await ensureExcelJS()
      const xlsx = new ExcelJS.Workbook()
      await xlsx.xlsx.load(buffer)

      const sheets: SheetData[] = xlsx.worksheets.map((ws, sheetIndex) => {
        const merges = (ws.model?.merges ?? []).map(parseRange).filter((item): item is MergeRange => Boolean(item))
        const mergedLastRow = merges.reduce((max, item) => Math.max(max, item.endRow + 1), 0)
        const mergedLastCol = merges.reduce((max, item) => Math.max(max, item.endCol + 1), 0)
        const rows = Math.max(DEFAULT_ROWS, Math.min(MAX_ROWS, Math.max(ws.actualRowCount || 0, mergedLastRow)))
        const cols = Math.max(DEFAULT_COLS, Math.min(MAX_COLS, Math.max(ws.actualColumnCount || 0, mergedLastCol)))

        const cells = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => {
          const mergeInfo = mergeAt(merges, row, col)
          if (mergeInfo && !mergeInfo.master) return emptyCell()
          return fromExcelCell(ws.getCell(row + 1, col + 1))
        }))
        const columnWidths = Array.from({ length: cols }, (_, col) => Math.max(8, Math.min(50, ws.columns[col]?.width ?? (col === 0 ? 24 : 14))))
        const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(18, Math.min(120, ws.getRow(row + 1).height ?? 22)))

        return {
          name: ws.name || `Hoja ${sheetIndex + 1}`,
          cells,
          merges,
          columnWidths,
          rowHeights,
        }
      })

      setWorkbook({ sheets: sheets.length ? sheets : [emptySheet()] })
      setActiveSheet(0)
      setSelected({ row: 0, col: 0 })
      setFormulaBar('')
      setSourceName(label)
      setNotice(`${sheets.length || 1} hoja${sheets.length === 1 ? '' : 's'} cargada${sheets.length === 1 ? '' : 's'} por separado. Cada pestaña conserva su propio contenido.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el Excel')
    } finally {
      setOpening(false)
    }
  }

  const uploadLocal = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Selecciona un archivo .xlsx')
      return
    }
    await loadBuffer(await file.arrayBuffer(), file.name)
  }

  const openSaved = async () => {
    setOpening(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/promedios/${workbookId}/download`, { cache: 'no-store' })
      if (!response.ok) throw new Error('No se pudo recuperar el archivo guardado desde Supabase')
      const buffer = await response.arrayBuffer()
      setOpening(false)
      await loadBuffer(buffer, 'Archivo guardado en Supabase')
    } catch (err) {
      setOpening(false)
      setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo guardado')
    }
  }

  const updateCell = (row: number, col: number, value: Primitive) => {
    if (!workbook) return
    setWorkbook((current) => {
      if (!current) return current
      return {
        ...current,
        sheets: current.sheets.map((item, index) => index === activeSheet ? {
          ...item,
          cells: item.cells.map((sourceRow, rowIndex) => rowIndex === row ? sourceRow.map((sourceCell, colIndex) => colIndex === col ? {
            ...sourceCell,
            value,
            formula: typeof value === 'string' && value.startsWith('=') ? value.slice(1) : undefined,
            cached: undefined,
          } : sourceCell) : sourceRow),
        } : item),
      }
    })
  }

  const chooseCell = (row: number, col: number) => {
    if (!sheet) return
    setSelected({ row, col })
    const cell = sheet.cells[row]?.[col]
    setFormulaBar(cell?.formula ? `=${cell.formula}` : String(cell?.value ?? ''))
  }

  const createBlank = () => {
    setWorkbook({ sheets: [emptySheet()] })
    setActiveSheet(0)
    setSelected({ row: 0, col: 0 })
    setFormulaBar('')
    setSourceName('Planilla nueva')
    setError('')
    setNotice('Planilla vacía creada. Nada se guardará hasta que presiones Guardar.')
  }

  const addSheet = () => {
    if (!workbook) {
      createBlank()
      return
    }
    const next = workbook.sheets.length
    setWorkbook((current) => current ? { ...current, sheets: [...current.sheets, emptySheet(`Hoja ${next + 1}`)] } : current)
    setActiveSheet(next)
  }

  const addCourseSheet = async () => {
    if (!courseId) {
      setNotice('Selecciona un curso.')
      return
    }
    setNotice('')
    setError('')
    try {
      const response = await fetch(`/api/promedios/cursos/${courseId}/estudiantes?mode=${mode}&workbookId=${workbookId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo obtener la nómina')
      const students = (payload.students ?? []) as Student[]
      const course = courses.find((item) => item.id === courseId)
      const currentCount = workbook?.sheets.length ?? 0
      const target = emptySheet((course?.name || `Hoja ${currentCount + 1}`).slice(0, 31), Math.max(DEFAULT_ROWS, students.length + 1), DEFAULT_COLS)

      ;['Estudiante', 'Avance 1', 'Avance 2', 'Avance 3', '% Final', 'Nota', 'Estado'].forEach((label, col) => {
        target.cells[0][col] = { value: label, style: { bold: true, background: '#F1F5F9', horizontal: 'center' } }
      })
      students.forEach((student, index) => {
        const row = index + 1
        target.cells[row][0] = { value: student.label }
        target.cells[row][4] = { value: `=B${row + 1}*0.3+C${row + 1}*0.3+D${row + 1}*0.4`, formula: `B${row + 1}*0.3+C${row + 1}*0.3+D${row + 1}*0.4` }
        target.cells[row][5] = { value: `=NOTA(E${row + 1})`, formula: `NOTA(E${row + 1})` }
        target.cells[row][6] = { value: `=SI(F${row + 1}>=4;"APROBADO";"REPROBADO")`, formula: `SI(F${row + 1}>=4;"APROBADO";"REPROBADO")` }
      })

      setWorkbook((current) => current ? { ...current, sheets: [...current.sheets, target] } : { sheets: [target] })
      setActiveSheet(currentCount)
      setSourceName((current) => current || 'Planilla de curso')
      setNotice(`Hoja “${target.name}” creada con ${students.length} estudiantes.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el curso')
    }
  }

  const save = async () => {
    if (!workbook) return
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const ExcelJS = await ensureExcelJS()
      const xlsx = new ExcelJS.Workbook()

      workbook.sheets.forEach((source, sheetIndex) => {
        const safeName = (source.name || `Hoja ${sheetIndex + 1}`).replace(/[\\/?*:[\]]/g, '-').slice(0, 31)
        const ws = xlsx.addWorksheet(safeName || `Hoja ${sheetIndex + 1}`)

        source.cells.forEach((row, rowIndex) => row.forEach((gridCell, colIndex) => {
          if (gridCell.value === '' && !gridCell.formula && !gridCell.style) return
          const cell = ws.getCell(rowIndex + 1, colIndex + 1)
          if (gridCell.formula || (typeof gridCell.value === 'string' && gridCell.value.startsWith('='))) {
            const formula = excelFormula(gridCell.formula || String(gridCell.value).slice(1))
            cell.value = gridCell.cached === undefined ? { formula } : { formula, result: gridCell.cached }
          } else {
            cell.value = gridCell.value
          }
          applyExcelStyle(cell, gridCell.style)
        }))

        source.columnWidths.forEach((width, index) => {
          if (ws.columns[index]) ws.columns[index].width = width
        })
        source.rowHeights.forEach((height, index) => {
          ws.getRow(index + 1).height = height
        })
        source.merges.forEach((merge) => ws.mergeCells(rangeAddress(merge)))
      })

      const buffer = await xlsx.xlsx.writeBuffer()
      const response = await fetch(`/api/promedios/${workbookId}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: buffer,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar')
      setNotice('Cambios guardados en Supabase. La copia de trabajo permanece solo en memoria mientras esta página está abierta.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          void uploadLocal(file)
          event.target.value = ''
        }}
      />

      <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/promedios" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">← Promedios</Link>
            <div className="min-w-0">
              <div className="truncate text-lg font-black text-slate-900">{title}</div>
              <div className="text-xs text-slate-500">Editor de notas · cada hoja se mantiene separada · guardado solo en Supabase</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={opening} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50">
              {opening ? 'Abriendo…' : '↑ Subir Excel'}
            </button>
            <button onClick={openSaved} disabled={opening} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">📁 Abrir guardado</button>
            <button onClick={createBlank} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">+ Planilla vacía</button>
            {workbook && <>
              <button onClick={save} disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
              <a href={`/api/promedios/${workbookId}/download`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Descargar .xlsx</a>
            </>}
          </div>
        </div>

        {workbook && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              <option value="">Curso…</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value === 'name' ? 'name' : 'alias')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              <option value="alias">Alias</option>
              <option value="name">Nombres</option>
            </select>
            <button onClick={addCourseSheet} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 hover:bg-emerald-100">+ Hoja desde curso</button>
            <span className="ml-auto text-xs font-semibold text-slate-500">{sourceName || 'Libro en memoria'} · {workbook.sheets.length} hoja{workbook.sheets.length === 1 ? '' : 's'}</span>
          </div>
        )}

        {notice && <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">{notice}</div>}
        {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
      </div>

      {!workbook ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-2xl rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">📊</div>
            <h2 className="mt-4 text-2xl font-black text-slate-900">La planilla comienza vacía</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Sube un Excel para cargar cada hoja como una pestaña independiente. Se respetan las celdas combinadas y la página no conserva una copia local al cerrarse.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="rounded-2xl bg-blue-700 px-6 py-3 text-sm font-black text-white hover:bg-blue-800">↑ Subir Excel</button>
              <button onClick={openSaved} className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">📁 Abrir desde Supabase</button>
              <button onClick={createBlank} className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">+ Crear vacía</button>
            </div>
          </div>
        </div>
      ) : sheet ? (
        <>
          <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="w-20 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-center text-xs font-black text-slate-600">{columnLabel(selected.col)}{selected.row + 1}</div>
              <input
                value={formulaBar}
                onChange={(e) => setFormulaBar(e.target.value)}
                onBlur={() => updateCell(selected.row, selected.col, formulaBar)}
                onKeyDown={(e) => { if (e.key === 'Enter') updateCell(selected.row, selected.col, formulaBar) }}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Valor o fórmula, ej. =PROMEDIO(B2:D2)"
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Básicas: SUMA, PROMEDIO, MAX, MIN, CONTAR, CONTAR.SI, SUMAPRODUCTO, SI, REDONDEAR, NOTA y operaciones aritméticas.</div>
          </div>

          <div className="flex-1 overflow-auto bg-white">
            <table className="border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 48 }} />
                {sheet.columnWidths.map((width, index) => <col key={index} style={{ width: Math.max(64, width * 7 + 12) }} />)}
              </colgroup>
              <thead className="sticky top-0 z-20 bg-slate-100">
                <tr>
                  <th className="h-8 border border-slate-300 bg-slate-200"></th>
                  {sheet.columnWidths.map((_, index) => <th key={index} className="h-8 border border-slate-300 px-2 text-center font-black text-slate-700">{columnLabel(index)}</th>)}
                </tr>
              </thead>
              <tbody>
                {sheet.cells.map((row, rowIndex) => (
                  <tr key={rowIndex} style={{ height: sheet.rowHeights[rowIndex] }}>
                    <th className="sticky left-0 z-10 w-12 border border-slate-300 bg-slate-100 text-center text-xs font-black text-slate-600">{rowIndex + 1}</th>
                    {row.map((cell, colIndex) => {
                      const mergeInfo = mergeAt(sheet.merges, rowIndex, colIndex)
                      if (mergeInfo && !mergeInfo.master) return null
                      const active = selected.row === rowIndex && selected.col === colIndex
                      const rowSpan = mergeInfo ? mergeInfo.merge.endRow - mergeInfo.merge.startRow + 1 : undefined
                      const colSpan = mergeInfo ? mergeInfo.merge.endCol - mergeInfo.merge.startCol + 1 : undefined
                      const style = renderStyle(cell)

                      return (
                        <td
                          key={`${rowIndex}-${colIndex}`}
                          rowSpan={rowSpan}
                          colSpan={colSpan}
                          className={`border border-slate-300 p-0 ${active ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                          onClick={() => chooseCell(rowIndex, colIndex)}
                          style={style}
                        >
                          <input
                            value={active ? (cell.formula ? `=${cell.formula}` : String(cell.value ?? '')) : (displayed[rowIndex]?.[colIndex] ?? '')}
                            onFocus={() => chooseCell(rowIndex, colIndex)}
                            onChange={(e) => { updateCell(rowIndex, colIndex, e.target.value); setFormulaBar(e.target.value) }}
                            className="h-full min-h-9 w-full border-0 bg-transparent px-2 outline-none"
                            style={{ ...style, minWidth: mergeInfo ? undefined : 70 }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-200 bg-slate-100 px-4 py-2">
            {workbook.sheets.map((item, index) => (
              <button
                key={`${item.name}-${index}`}
                onClick={() => { setActiveSheet(index); setSelected({ row: 0, col: 0 }); setFormulaBar('') }}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-black ${activeSheet === index ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70'}`}
              >
                {item.name}
              </button>
            ))}
            <button onClick={addSheet} className="rounded-lg border border-dashed border-slate-400 px-3 py-2 text-xs font-black text-slate-600">+ Hoja</button>
          </div>
        </>
      ) : null}
    </div>
  )
}
