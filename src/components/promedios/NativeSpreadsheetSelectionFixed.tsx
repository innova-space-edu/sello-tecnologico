'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  buildWorkbookBuffer,
  columnLabel,
  computeCell,
  DEFAULT_COLS,
  downloadBuffer,
  emptyCell,
  emptySheet,
  formatDisplay,
  isNumeric,
  loadWorkbookFromBuffer,
  MAX_COLS,
  MAX_ROWS,
  mergeAt,
  normalizeRange,
  qrDataUrl,
  rangeAddress,
  readImage,
  toNumber,
  type CellStyle,
  type ChartKind,
  type GridCell,
  type MergeRange,
  type SheetData,
  type WorkbookData,
} from '@/components/promedios/NativeSpreadsheetCore'

type Course = { id: string; name: string }
type Student = { id: string; label: string }
type Props = { workbookId: string; title: string }
type Menu = 'Archivo' | 'Inicio' | 'Insertar' | 'Datos' | 'Diseño' | 'Vista' | 'Docente'
type Point = { row: number; col: number }
type SelectionMode = 'cells' | 'row' | 'column' | 'all'
type ClipboardData = { cells: GridCell[][]; range: MergeRange; cut: boolean }

const menus: Menu[] = ['Archivo', 'Inicio', 'Insertar', 'Datos', 'Diseño', 'Vista', 'Docente']

function renderStyle(cell: GridCell): CSSProperties {
  return {
    backgroundColor: cell.style?.background,
    color: cell.style?.color,
    fontFamily: cell.style?.fontName,
    fontSize: cell.style?.fontSize ? `${cell.style.fontSize}px` : undefined,
    fontWeight: cell.style?.bold ? 800 : undefined,
    fontStyle: cell.style?.italic ? 'italic' : undefined,
    textDecoration: cell.style?.underline ? 'underline' : undefined,
    textAlign: cell.style?.horizontal,
    whiteSpace: cell.style?.wrap ? 'normal' : 'nowrap',
    verticalAlign: cell.style?.vertical,
  }
}

function cloneCell(cell: GridCell): GridCell {
  return { ...cell, style: cell.style ? { ...cell.style } : undefined }
}

function insideRange(range: MergeRange, row: number, col: number) {
  return row >= range.startRow && row <= range.endRow && col >= range.startCol && col <= range.endCol
}

function shiftFormula(formula: string, rowDelta: number, colDelta: number) {
  return formula.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (_match, lockCol: string, letters: string, lockRow: string, rowText: string) => {
    let col = 0
    for (const char of letters) col = col * 26 + char.charCodeAt(0) - 64
    col -= 1
    const row = Number(rowText) - 1
    const nextCol = lockCol ? col : Math.max(0, col + colDelta)
    const nextRow = lockRow ? row : Math.max(0, row + rowDelta)
    return `${lockCol}${columnLabel(nextCol)}${lockRow}${nextRow + 1}`
  })
}

function cellWithShift(cell: GridCell, rowDelta: number, colDelta: number): GridCell {
  const next = cloneCell(cell)
  if (next.formula) {
    next.formula = shiftFormula(next.formula, rowDelta, colDelta)
    next.value = `=${next.formula}`
    next.cached = undefined
  } else if (typeof next.value === 'string' && next.value.startsWith('=')) {
    next.formula = shiftFormula(next.value.slice(1), rowDelta, colDelta)
    next.value = `=${next.formula}`
    next.cached = undefined
  }
  return next
}

export default function NativeSpreadsheetSelectionFixed({ workbookId, title }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const clipboardRef = useRef<ClipboardData | null>(null)
  const formatClipboardRef = useRef<Array<Array<CellStyle | undefined>> | null>(null)
  const dragRef = useRef<{ active: boolean; mode: SelectionMode }>({ active: false, mode: 'cells' })

  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<'alias' | 'name'>('alias')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)
  const [activeSheet, setActiveSheet] = useState(0)
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null)
  const [anchor, setAnchor] = useState<Point>({ row: 0, col: 0 })
  const [focusCell, setFocusCell] = useState<Point>({ row: 0, col: 0 })
  const [activeCell, setActiveCell] = useState<Point>({ row: 0, col: 0 })
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('cells')
  const [formulaBar, setFormulaBar] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [activeMenu, setActiveMenu] = useState<Menu>('Inicio')
  const [fontName, setFontName] = useState('Arial')
  const [fontSize, setFontSize] = useState('11')
  const [fontColor, setFontColor] = useState('#111827')
  const [fillColor, setFillColor] = useState('#ffffff')
  const [zoom, setZoom] = useState(100)
  const [linkUrl, setLinkUrl] = useState('')
  const [qrText, setQrText] = useState('')
  const [chartKind, setChartKind] = useState<ChartKind>('bar')
  const [showChartPanel, setShowChartPanel] = useState(false)

  const sheet = workbook?.sheets[activeSheet] ?? null
  const selection = normalizeRange(anchor, focusCell)
  const selectionRows = selection.endRow - selection.startRow + 1
  const selectionCols = selection.endCol - selection.startCol + 1
  const selectionCount = selectionRows * selectionCols
  const multiSelection = selectionCount > 1

  const displayed = useMemo(() => {
    if (!sheet) return []
    return sheet.cells.map((row, rowIndex) => row.map((cell, colIndex) => formatDisplay(cell, computeCell(sheet, rowIndex, colIndex))))
  }, [sheet])

  const chartData = useMemo(() => {
    if (!sheet?.charts.length) return []
    const chart = sheet.charts[sheet.charts.length - 1]
    const result: Array<{ name: string; value: number }> = []
    const valueCol = chart.range.endCol > chart.range.startCol ? chart.range.endCol : chart.range.startCol
    for (let row = chart.range.startRow; row <= chart.range.endRow; row += 1) {
      const label = computeCell(sheet, row, chart.range.startCol)
      const value = computeCell(sheet, row, valueCol)
      if (isNumeric(value)) result.push({ name: String(label || row + 1), value: toNumber(value) })
    }
    return result
  }, [sheet])

  useEffect(() => {
    const stopDrag = () => { dragRef.current.active = false }
    window.addEventListener('mouseup', stopDrag)
    window.addEventListener('blur', stopDrag)
    return () => {
      window.removeEventListener('mouseup', stopDrag)
      window.removeEventListener('blur', stopDrag)
    }
  }, [])

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

  const mutateSheet = (mutator: (target: SheetData) => SheetData) => {
    setWorkbook((current) => current ? {
      ...current,
      sheets: current.sheets.map((item, index) => index === activeSheet ? mutator(item) : item),
    } : current)
  }

  const syncFormulaBar = (row: number, col: number) => {
    const cell = sheet?.cells[row]?.[col]
    setFormulaBar(cell?.formula ? `=${cell.formula}` : String(cell?.value ?? ''))
  }

  const resetSelection = (point: Point = { row: 0, col: 0 }) => {
    dragRef.current.active = false
    setSelectionMode('cells')
    setAnchor(point)
    setFocusCell(point)
    setActiveCell(point)
    syncFormulaBar(point.row, point.col)
  }

  const beginCellSelection = (row: number, col: number, extend: boolean) => {
    if (!sheet) return
    const point = { row, col }
    const canExtend = extend && selectionMode === 'cells'
    if (!canExtend) setAnchor(point)
    setFocusCell(point)
    setActiveCell(point)
    setSelectionMode('cells')
    syncFormulaBar(row, col)
    dragRef.current = { active: true, mode: 'cells' }
  }

  const extendCellSelection = (row: number, col: number) => {
    if (!dragRef.current.active || dragRef.current.mode !== 'cells') return
    setFocusCell({ row, col })
  }

  const beginRowSelection = (row: number) => {
    if (!sheet) return
    const lastCol = Math.max(0, (sheet.cells[0]?.length ?? 1) - 1)
    setSelectionMode('row')
    setAnchor({ row, col: 0 })
    setFocusCell({ row, col: lastCol })
    setActiveCell({ row, col: 0 })
    syncFormulaBar(row, 0)
    dragRef.current = { active: true, mode: 'row' }
  }

  const extendRowSelection = (row: number) => {
    if (!sheet || !dragRef.current.active || dragRef.current.mode !== 'row') return
    const lastCol = Math.max(0, (sheet.cells[0]?.length ?? 1) - 1)
    setFocusCell({ row, col: lastCol })
  }

  const beginColumnSelection = (col: number) => {
    if (!sheet) return
    const lastRow = Math.max(0, sheet.cells.length - 1)
    setSelectionMode('column')
    setAnchor({ row: 0, col })
    setFocusCell({ row: lastRow, col })
    setActiveCell({ row: 0, col })
    syncFormulaBar(0, col)
    dragRef.current = { active: true, mode: 'column' }
  }

  const extendColumnSelection = (col: number) => {
    if (!sheet || !dragRef.current.active || dragRef.current.mode !== 'column') return
    const lastRow = Math.max(0, sheet.cells.length - 1)
    setFocusCell({ row: lastRow, col })
  }

  const selectAll = () => {
    if (!sheet) return
    dragRef.current.active = false
    const lastRow = Math.max(0, sheet.cells.length - 1)
    const lastCol = Math.max(0, (sheet.cells[0]?.length ?? 1) - 1)
    setSelectionMode('all')
    setAnchor({ row: 0, col: 0 })
    setFocusCell({ row: lastRow, col: lastCol })
    setActiveCell({ row: 0, col: 0 })
    syncFormulaBar(0, 0)
  }

  const updateCell = (row: number, col: number, value: string) => {
    mutateSheet((target) => ({
      ...target,
      cells: target.cells.map((sourceRow, rowIndex) => rowIndex === row ? sourceRow.map((sourceCell, colIndex) => colIndex === col ? {
        ...sourceCell,
        value,
        formula: value.startsWith('=') ? value.slice(1) : undefined,
        cached: undefined,
      } : sourceCell) : sourceRow),
    }))
  }

  const applyStyle = (patch: Partial<CellStyle>) => {
    mutateSheet((target) => ({
      ...target,
      cells: target.cells.map((row, rowIndex) => row.map((cell, colIndex) => insideRange(selection, rowIndex, colIndex) ? {
        ...cell,
        style: { ...cell.style, ...patch },
      } : cell)),
    }))
  }

  const toggleStyle = (key: 'bold' | 'italic' | 'underline' | 'wrap' | 'border') => {
    const current = Boolean(sheet?.cells[selection.startRow]?.[selection.startCol]?.style?.[key])
    applyStyle({ [key]: !current })
  }

  const clearContents = () => {
    mutateSheet((target) => ({
      ...target,
      cells: target.cells.map((row, rowIndex) => row.map((cell, colIndex) => insideRange(selection, rowIndex, colIndex) ? {
        ...cell,
        value: '', formula: undefined, cached: undefined, hyperlink: undefined, image: undefined,
      } : cell)),
    }))
    setFormulaBar('')
    setNotice(`Contenido eliminado de ${rangeAddress(selection)}.`)
  }

  const clearFormats = () => {
    mutateSheet((target) => ({
      ...target,
      cells: target.cells.map((row, rowIndex) => row.map((cell, colIndex) => insideRange(selection, rowIndex, colIndex) ? { ...cell, style: undefined } : cell)),
    }))
    setNotice(`Formato eliminado de ${rangeAddress(selection)}.`)
  }

  const clearAll = () => {
    mutateSheet((target) => ({
      ...target,
      cells: target.cells.map((row, rowIndex) => row.map((cell, colIndex) => insideRange(selection, rowIndex, colIndex) ? emptyCell() : cell)),
      merges: target.merges.filter((merge) => !(merge.startRow <= selection.endRow && merge.endRow >= selection.startRow && merge.startCol <= selection.endCol && merge.endCol >= selection.startCol)),
    }))
    setFormulaBar('')
    setNotice(`Celdas limpiadas en ${rangeAddress(selection)}.`)
  }

  const copySelection = (cut = false) => {
    if (!sheet) return
    const cells = sheet.cells.slice(selection.startRow, selection.endRow + 1).map((row) => row.slice(selection.startCol, selection.endCol + 1).map(cloneCell))
    clipboardRef.current = { cells, range: selection, cut }
    const text = cells.map((row) => row.map((cell) => String(cell.value ?? '')).join('\t')).join('\n')
    void navigator.clipboard?.writeText(text).catch(() => undefined)
    setNotice(`${cut ? 'Cortado' : 'Copiado'} ${rangeAddress(selection)} (${selectionCount} celdas).`)
  }

  const pasteSelection = () => {
    const clip = clipboardRef.current
    if (!clip || !sheet) return setNotice('Primero copia o corta un rango dentro de Promedios.')
    const destination = { row: selection.startRow, col: selection.startCol }
    mutateSheet((target) => {
      let cells = target.cells.map((row) => row.map(cloneCell))
      if (clip.cut) cells = cells.map((row, rowIndex) => row.map((cell, colIndex) => insideRange(clip.range, rowIndex, colIndex) ? emptyCell() : cell))
      clip.cells.forEach((row, sourceRowOffset) => row.forEach((cell, sourceColOffset) => {
        const targetRow = destination.row + sourceRowOffset
        const targetCol = destination.col + sourceColOffset
        if (!cells[targetRow]?.[targetCol]) return
        const sourceRow = clip.range.startRow + sourceRowOffset
        const sourceCol = clip.range.startCol + sourceColOffset
        cells[targetRow][targetCol] = cellWithShift(cell, targetRow - sourceRow, targetCol - sourceCol)
      }))
      return { ...target, cells }
    })
    if (clip.cut) clipboardRef.current = null
    const end = {
      row: Math.min(sheet.cells.length - 1, destination.row + clip.cells.length - 1),
      col: Math.min((sheet.cells[0]?.length ?? 1) - 1, destination.col + (clip.cells[0]?.length ?? 1) - 1),
    }
    setSelectionMode('cells')
    setAnchor(destination)
    setFocusCell(end)
    setActiveCell(destination)
    setNotice('Rango pegado. Las fórmulas relativas fueron ajustadas.')
  }

  const copyFormat = () => {
    if (!sheet) return
    formatClipboardRef.current = sheet.cells.slice(selection.startRow, selection.endRow + 1).map((row) => row.slice(selection.startCol, selection.endCol + 1).map((cell) => cell.style ? { ...cell.style } : undefined))
    setNotice(`Formato copiado desde ${rangeAddress(selection)}.`)
  }

  const pasteFormat = () => {
    const formats = formatClipboardRef.current
    if (!formats?.length) return setNotice('Primero usa Copiar formato.')
    mutateSheet((target) => ({
      ...target,
      cells: target.cells.map((row, rowIndex) => row.map((cell, colIndex) => {
        if (!insideRange(selection, rowIndex, colIndex)) return cell
        const sourceRow = (rowIndex - selection.startRow) % formats.length
        const sourceCol = (colIndex - selection.startCol) % (formats[sourceRow]?.length || 1)
        return { ...cell, style: formats[sourceRow]?.[sourceCol] ? { ...formats[sourceRow][sourceCol] } : undefined }
      })),
    }))
    setNotice('Formato aplicado a la selección.')
  }

  const fillDown = () => {
    if (!sheet || selectionRows < 2) return setNotice('Selecciona al menos dos filas.')
    mutateSheet((target) => ({
      ...target,
      cells: target.cells.map((row) => row.map(cloneCell)).map((row, rowIndex) => {
        if (rowIndex <= selection.startRow || rowIndex > selection.endRow) return row
        for (let col = selection.startCol; col <= selection.endCol; col += 1) {
          const source = target.cells[selection.startRow]?.[col]
          if (source) row[col] = cellWithShift(source, rowIndex - selection.startRow, 0)
        }
        return row
      }),
    }))
    setNotice('Relleno hacia abajo aplicado.')
  }

  const fillRight = () => {
    if (!sheet || selectionCols < 2) return setNotice('Selecciona al menos dos columnas.')
    mutateSheet((target) => ({
      ...target,
      cells: target.cells.map((row, rowIndex) => row.map((cell, colIndex) => {
        if (rowIndex < selection.startRow || rowIndex > selection.endRow || colIndex <= selection.startCol || colIndex > selection.endCol) return cloneCell(cell)
        const source = target.cells[rowIndex]?.[selection.startCol]
        return source ? cellWithShift(source, 0, colIndex - selection.startCol) : cloneCell(cell)
      })),
    }))
    setNotice('Relleno hacia la derecha aplicado.')
  }

  const mergeSelection = () => {
    if (!multiSelection) return setNotice('Selecciona dos o más celdas para combinar.')
    if (selectionMode === 'row' || selectionMode === 'column' || selectionMode === 'all') return setNotice('Para combinar, selecciona un rango de celdas; no una fila o columna completa.')
    mutateSheet((target) => ({
      ...target,
      merges: [
        ...target.merges.filter((merge) => !(merge.startRow <= selection.endRow && merge.endRow >= selection.startRow && merge.startCol <= selection.endCol && merge.endCol >= selection.startCol)),
        selection,
      ],
    }))
    setNotice(`Celdas combinadas: ${rangeAddress(selection)}.`)
  }

  const unmergeSelection = () => {
    mutateSheet((target) => ({
      ...target,
      merges: target.merges.filter((merge) => !(merge.startRow <= selection.endRow && merge.endRow >= selection.startRow && merge.startCol <= selection.endCol && merge.endCol >= selection.startCol)),
    }))
    setNotice('Combinaciones eliminadas dentro del rango.')
  }

  const createBlank = () => {
    const next = { sheets: [emptySheet()] }
    setWorkbook(next)
    setActiveSheet(0)
    setAnchor({ row: 0, col: 0 })
    setFocusCell({ row: 0, col: 0 })
    setActiveCell({ row: 0, col: 0 })
    setSelectionMode('cells')
    setFormulaBar('')
    setSourceName('Planilla nueva')
    setError('')
    setNotice('Planilla creada. Se guardará solo cuando presiones Guardar.')
  }

  const addSheet = () => {
    if (!workbook) return createBlank()
    const next = workbook.sheets.length
    setWorkbook((current) => current ? { ...current, sheets: [...current.sheets, emptySheet(`Hoja ${next + 1}`)] } : current)
    setActiveSheet(next)
    setAnchor({ row: 0, col: 0 })
    setFocusCell({ row: 0, col: 0 })
    setActiveCell({ row: 0, col: 0 })
    setSelectionMode('cells')
    setFormulaBar('')
  }

  const addRow = () => mutateSheet((target) => target.cells.length >= MAX_ROWS ? target : ({
    ...target,
    cells: [...target.cells, Array.from({ length: target.cells[0]?.length || DEFAULT_COLS }, emptyCell)],
    rowHeights: [...target.rowHeights, 22],
  }))

  const addColumn = () => mutateSheet((target) => target.cells[0]?.length >= MAX_COLS ? target : ({
    ...target,
    cells: target.cells.map((row) => [...row, emptyCell()]),
    columnWidths: [...target.columnWidths, 14],
  }))

  const loadBuffer = async (buffer: ArrayBuffer, label: string) => {
    setOpening(true); setError(''); setNotice('')
    try {
      const next = await loadWorkbookFromBuffer(buffer)
      setWorkbook(next)
      setActiveSheet(0)
      setAnchor({ row: 0, col: 0 })
      setFocusCell({ row: 0, col: 0 })
      setActiveCell({ row: 0, col: 0 })
      setSelectionMode('cells')
      setFormulaBar('')
      setSourceName(label)
      setNotice(`${next.sheets.length} hoja${next.sheets.length === 1 ? '' : 's'} cargada${next.sheets.length === 1 ? '' : 's'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el Excel')
    } finally { setOpening(false) }
  }

  const uploadLocal = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) return setError('Selecciona un archivo .xlsx')
    await loadBuffer(await file.arrayBuffer(), file.name)
  }

  const openSaved = async () => {
    setOpening(true); setError('')
    try {
      const response = await fetch(`/api/promedios/${workbookId}/download`, { cache: 'no-store' })
      if (!response.ok) throw new Error('No se pudo recuperar el archivo guardado desde Supabase')
      await loadBuffer(await response.arrayBuffer(), 'Archivo guardado en Supabase')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo guardado') }
    finally { setOpening(false) }
  }

  const save = async () => {
    if (!workbook) return
    setSaving(true); setError(''); setNotice('')
    try {
      const buffer = await buildWorkbookBuffer(workbook)
      const response = await fetch(`/api/promedios/${workbookId}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: buffer,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar')
      setNotice('Cambios guardados en Supabase.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar') }
    finally { setSaving(false) }
  }

  const downloadCurrent = async () => {
    if (!workbook) return
    try {
      const buffer = await buildWorkbookBuffer(workbook)
      downloadBuffer(buffer, `${title || 'Promedios'}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo descargar el archivo') }
  }

  const exportPdf = () => {
    if (!sheet) return
    const doc = new jsPDF({ orientation: sheet.orientation })
    doc.setFontSize(14)
    doc.text(`${title} — ${sheet.name}`, 14, 16)
    const nonEmptyRows = displayed.filter((row) => row.some((value) => String(value).trim() !== ''))
    autoTable(doc, { startY: 22, body: nonEmptyRows.map((row) => row.map((value) => String(value))), styles: { fontSize: 7 } })
    doc.save(`${title}-${sheet.name}.pdf`)
  }

  const addCourseSheet = async () => {
    if (!courseId) return setNotice('Selecciona un curso.')
    setError(''); setNotice('')
    try {
      const response = await fetch(`/api/promedios/cursos/${courseId}/estudiantes?mode=${mode}&workbookId=${workbookId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo obtener la nómina')
      const students = (payload.students ?? []) as Student[]
      const course = courses.find((item) => item.id === courseId)
      const currentCount = workbook?.sheets.length ?? 0
      const target = emptySheet((course?.name || `Hoja ${currentCount + 1}`).slice(0, 31), Math.max(40, students.length + 1), DEFAULT_COLS)
      ;['Estudiante', 'Avance 1', 'Avance 2', 'Avance 3', '% Final', 'Nota', 'Estado'].forEach((label, col) => {
        target.cells[0][col] = { value: label, style: { bold: true, background: '#F1F5F9', horizontal: 'center', border: true } }
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
      setAnchor({ row: 0, col: 0 })
      setFocusCell({ row: 0, col: 0 })
      setActiveCell({ row: 0, col: 0 })
      setSelectionMode('cells')
      setFormulaBar('')
      setNotice(`Hoja “${target.name}” creada con ${students.length} estudiantes.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar el curso') }
  }

  const insertImage = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Selecciona una imagen válida.')
    if (file.size > 2 * 1024 * 1024) return setError('Usa imágenes de hasta 2 MB.')
    try {
      const image = await readImage(file)
      mutateSheet((target) => ({
        ...target,
        cells: target.cells.map((row, rowIndex) => row.map((cell, colIndex) => rowIndex === selection.startRow && colIndex === selection.startCol ? { ...cell, image } : cell)),
      }))
      setNotice('Imagen insertada en la primera celda del rango.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo insertar la imagen') }
  }

  const insertLink = () => {
    const value = linkUrl.trim()
    if (!value) return setNotice('Escribe una URL.')
    const url = /^(https?:\/\/|mailto:|tel:)/i.test(value) ? value : `https://${value}`
    mutateSheet((target) => ({
      ...target,
      cells: target.cells.map((row, rowIndex) => row.map((cell, colIndex) => insideRange(selection, rowIndex, colIndex) ? { ...cell, hyperlink: url, value: cell.value || url } : cell)),
    }))
    setNotice(`Enlace aplicado a ${selectionCount} celda${selectionCount === 1 ? '' : 's'}.`)
  }

  const insertQr = async () => {
    if (!qrText.trim()) return setNotice('Escribe el contenido del QR.')
    try {
      const image = await qrDataUrl(qrText.trim())
      mutateSheet((target) => ({
        ...target,
        cells: target.cells.map((row, rowIndex) => row.map((cell, colIndex) => rowIndex === selection.startRow && colIndex === selection.startCol ? { ...cell, image, value: cell.value || 'QR' } : cell)),
      }))
      setNotice('QR generado en la primera celda del rango.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo generar el QR') }
  }

  const addChart = () => {
    if (!sheet) return
    mutateSheet((target) => ({
      ...target,
      charts: [...target.charts, { id: `${Date.now()}`, kind: chartKind, title: `Gráfico ${target.charts.length + 1}`, range: selection }],
    }))
    setShowChartPanel(true)
    setNotice('Gráfico creado desde el rango seleccionado.')
  }

  const moveAfterEdit = (row: number, col: number, direction: 'down' | 'right' | 'left') => {
    if (!sheet) return
    const next = direction === 'down'
      ? { row: Math.min(sheet.cells.length - 1, row + 1), col }
      : direction === 'right'
        ? { row, col: Math.min((sheet.cells[0]?.length ?? 1) - 1, col + 1) }
        : { row, col: Math.max(0, col - 1) }
    setSelectionMode('cells')
    setAnchor(next)
    setFocusCell(next)
    setActiveCell(next)
    syncFormulaBar(next.row, next.col)
  }

  const selectionLabel = selectionMode === 'row'
    ? selectionRows === 1 ? `Fila ${selection.startRow + 1}` : `Filas ${selection.startRow + 1}:${selection.endRow + 1}`
    : selectionMode === 'column'
      ? selectionCols === 1 ? `Columna ${columnLabel(selection.startCol)}` : `Columnas ${columnLabel(selection.startCol)}:${columnLabel(selection.endCol)}`
      : selectionMode === 'all'
        ? 'Toda la hoja'
        : rangeAddress(selection)

  const toolClass = 'rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40'
  const selectClass = 'rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none'
  const contextClass = 'rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:bg-blue-50'

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100">
      <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; void uploadLocal(file); event.target.value = '' }} />
      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; void insertImage(file); event.target.value = '' }} />

      <div className="sticky top-0 z-30 border-b border-slate-300 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-2 sm:px-6">
          <Link href="/promedios" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">← Promedios</Link>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-slate-900">{title}</div><div className="text-[10px] font-semibold text-slate-500">Editor nativo · selección corregida · Supabase</div></div>
          <span className="hidden text-[10px] font-semibold text-slate-500 md:inline">{sourceName || 'Sin archivo abierto'}</span>
        </div>

        <div className="flex overflow-x-auto border-t border-slate-200 px-4 sm:px-6">
          {menus.map((menu) => <button key={menu} onClick={() => setActiveMenu(menu)} className={`border-b-2 px-3 py-2 text-xs font-black ${activeMenu === menu ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>{menu}</button>)}
        </div>

        <div className="min-h-14 overflow-x-auto border-t border-slate-200 bg-slate-50 px-3 py-2"><div className="flex min-w-max items-center gap-1">
          {activeMenu === 'Archivo' && <><button className={toolClass} onClick={() => fileInputRef.current?.click()} disabled={opening}>↑ Abrir Excel</button><button className={toolClass} onClick={() => void openSaved()} disabled={opening}>📁 Archivos guardados</button><button className={toolClass} onClick={createBlank}>+ Planilla</button><button className={toolClass} onClick={() => void save()} disabled={!workbook || saving}>{saving ? 'Guardando…' : 'Guardar en Supabase'}</button><button className={toolClass} onClick={() => void downloadCurrent()} disabled={!workbook}>Descargar .xlsx</button><button className={toolClass} onClick={exportPdf} disabled={!sheet}>PDF</button></>}

          {activeMenu === 'Inicio' && <>
            <button className={toolClass} onClick={() => copySelection(false)} disabled={!sheet}>Copiar</button><button className={toolClass} onClick={() => copySelection(true)} disabled={!sheet}>Cortar</button><button className={toolClass} onClick={pasteSelection} disabled={!sheet}>Pegar</button><button className={toolClass} onClick={copyFormat} disabled={!sheet}>🖌 Copiar formato</button><button className={toolClass} onClick={pasteFormat} disabled={!sheet}>Aplicar formato</button>
            <span className="mx-1 h-8 border-l border-slate-300" />
            <select value={fontName} onChange={(event) => { setFontName(event.target.value); applyStyle({ fontName: event.target.value }) }} className={`${selectClass} w-28`}>{['Arial','Calibri','Aptos','Roboto','Verdana','Tahoma','Times New Roman','Georgia'].map((font) => <option key={font}>{font}</option>)}</select>
            <select value={fontSize} onChange={(event) => { setFontSize(event.target.value); applyStyle({ fontSize: Number(event.target.value) }) }} className={`${selectClass} w-16`}>{['8','9','10','11','12','14','16','18','20','24','28','32','36','48','72'].map((size) => <option key={size}>{size}</option>)}</select>
            <button className={toolClass} onClick={() => toggleStyle('bold')}><b>B</b></button><button className={`${toolClass} italic`} onClick={() => toggleStyle('italic')}>I</button><button className={`${toolClass} underline`} onClick={() => toggleStyle('underline')}>U</button><button className={toolClass} onClick={() => applyStyle({ bold: false, italic: false, underline: false })}>Normal</button>
            <label className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black">A<input type="color" value={fontColor} onChange={(event) => { setFontColor(event.target.value); applyStyle({ color: event.target.value }) }} className="h-7 w-8" /></label><label className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black">▣<input type="color" value={fillColor} onChange={(event) => { setFillColor(event.target.value); applyStyle({ background: event.target.value }) }} className="h-7 w-8" /></label>
            <button className={toolClass} onClick={() => toggleStyle('border')}>Bordes</button><button className={toolClass} onClick={() => applyStyle({ horizontal: 'left' })}>≡←</button><button className={toolClass} onClick={() => applyStyle({ horizontal: 'center' })}>≡</button><button className={toolClass} onClick={() => applyStyle({ horizontal: 'right' })}>→≡</button><button className={toolClass} onClick={() => applyStyle({ vertical: 'top' })}>↑</button><button className={toolClass} onClick={() => applyStyle({ vertical: 'middle' })}>↕</button><button className={toolClass} onClick={() => applyStyle({ vertical: 'bottom' })}>↓</button><button className={toolClass} onClick={() => toggleStyle('wrap')}>Ajustar</button><button className={toolClass} onClick={mergeSelection}>Combinar</button><button className={toolClass} onClick={unmergeSelection}>Separar</button>
          </>}

          {activeMenu === 'Insertar' && <><button className={toolClass} onClick={() => imageInputRef.current?.click()} disabled={!sheet}>🖼 Imagen</button><details className="relative"><summary className={`${toolClass} cursor-pointer list-none`}>🔗 Enlace</summary><div className="absolute left-0 top-11 z-50 w-72 rounded-xl border border-slate-300 bg-white p-3 shadow-xl"><input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://…" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /><button className={`${toolClass} w-full`} onClick={insertLink}>Aplicar al rango</button></div></details><details className="relative"><summary className={`${toolClass} cursor-pointer list-none`}>▦ QR</summary><div className="absolute left-0 top-11 z-50 w-72 rounded-xl border border-slate-300 bg-white p-3 shadow-xl"><input value={qrText} onChange={(event) => setQrText(event.target.value)} placeholder="Texto o URL" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /><button className={`${toolClass} w-full`} onClick={() => void insertQr()}>Generar QR</button></div></details><select value={chartKind} onChange={(event) => setChartKind(event.target.value as ChartKind)} className={selectClass}><option value="bar">Barras</option><option value="line">Líneas</option><option value="pie">Circular</option></select><button className={toolClass} onClick={addChart} disabled={!sheet}>📊 Gráfico del rango</button></>}

          {activeMenu === 'Datos' && <><button className={toolClass} onClick={addRow} disabled={!sheet}>+ Fila</button><button className={toolClass} onClick={addColumn} disabled={!sheet}>+ Columna</button><button className={toolClass} onClick={() => applyStyle({ numberFormat: '0%' })} disabled={!sheet}>%</button><button className={toolClass} onClick={() => applyStyle({ numberFormat: '0.0' })} disabled={!sheet}>0.0</button><button className={toolClass} onClick={fillDown} disabled={!sheet}>↓ Rellenar</button><button className={toolClass} onClick={fillRight} disabled={!sheet}>→ Rellenar</button><button className={toolClass} onClick={clearContents} disabled={!sheet}>Borrar contenido</button><button className={toolClass} onClick={clearFormats} disabled={!sheet}>Borrar formato</button><button className={toolClass} onClick={clearAll} disabled={!sheet}>Limpiar todo</button></>}

          {activeMenu === 'Diseño' && <><button className={toolClass} onClick={() => mutateSheet((target) => ({ ...target, orientation: 'portrait' }))} disabled={!sheet}>▯ Vertical</button><button className={toolClass} onClick={() => mutateSheet((target) => ({ ...target, orientation: 'landscape' }))} disabled={!sheet}>▭ Horizontal</button><button className={toolClass} onClick={() => mutateSheet((target) => ({ ...target, showGridlines: !target.showGridlines }))} disabled={!sheet}># Cuadrícula</button></>}

          {activeMenu === 'Vista' && <><button className={toolClass} onClick={() => setZoom((value) => Math.max(60, value - 10))}>−</button><span className="w-16 text-center text-xs font-black text-slate-700">{zoom}%</span><button className={toolClass} onClick={() => setZoom((value) => Math.min(160, value + 10))}>+</button><button className={toolClass} onClick={() => setZoom(100)}>100%</button><button className={toolClass} onClick={() => setShowChartPanel((value) => !value)} disabled={!sheet?.charts.length}>{showChartPanel ? 'Ocultar gráficos' : 'Mostrar gráficos'}</button></>}

          {activeMenu === 'Docente' && <><select value={courseId} onChange={(event) => setCourseId(event.target.value)} className={`${selectClass} min-w-44`}><option value="">Curso…</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select><select value={mode} onChange={(event) => setMode(event.target.value === 'name' ? 'name' : 'alias')} className={selectClass}><option value="alias">Alias</option><option value="name">Nombres</option></select><button className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100" onClick={() => void addCourseSheet()}>+ Hoja desde curso</button><span className="ml-2 text-[10px] font-semibold text-slate-500">Sin RUT: alias o nombre según autorización.</span></>}
        </div></div>

        {notice && <div className="border-t border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-800 sm:px-6">{notice}</div>}
        {error && <div className="border-t border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-700 sm:px-6">{error}</div>}
      </div>

      {!workbook ? <div className="flex flex-1 items-center justify-center p-6"><div className="w-full max-w-2xl rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><div className="text-5xl">📊</div><h2 className="mt-4 text-2xl font-black text-slate-900">Promedios</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Editor propio del Sello Tecnológico con selección estable de celdas, filas y columnas.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={() => fileInputRef.current?.click()} className="rounded-2xl bg-blue-700 px-6 py-3 text-sm font-black text-white">↑ Abrir Excel</button><button onClick={() => void openSaved()} className="rounded-2xl border border-slate-300 px-6 py-3 text-sm font-black text-slate-700">📁 Archivos guardados</button><button onClick={createBlank} className="rounded-2xl border border-slate-300 px-6 py-3 text-sm font-black text-slate-700">+ Crear vacía</button></div></div></div> : sheet ? <>
        <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2"><div className="min-w-32 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-center text-xs font-black text-slate-600">{selectionLabel}</div><span className="rounded bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">{selectionCount} celda{selectionCount === 1 ? '' : 's'}</span><span className="text-xs font-black text-slate-500">fx</span><input value={formulaBar} onChange={(event) => setFormulaBar(event.target.value)} onBlur={() => { if (!multiSelection && selectionMode === 'cells') updateCell(activeCell.row, activeCell.col, formulaBar) }} onKeyDown={(event) => { if (event.key === 'Enter' && !multiSelection && selectionMode === 'cells') { updateCell(activeCell.row, activeCell.col, formulaBar); event.currentTarget.blur() } }} disabled={multiSelection || selectionMode !== 'cells'} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400" placeholder={multiSelection ? 'Varias celdas seleccionadas: usa las herramientas de rango' : 'Valor o fórmula, ej. =PROMEDIO(B2:D2)'} /></div>
          <div className="mt-1 text-[10px] text-slate-500">Arrastra sobre celdas · Shift + clic extiende solo rangos de celdas · arrastra números para varias filas · arrastra letras para varias columnas.</div>
        </div>

        {multiSelection && <div className="sticky top-[126px] z-20 flex items-center gap-1 overflow-x-auto border-b border-blue-200 bg-blue-50 px-3 py-2 shadow-sm"><span className="mr-2 whitespace-nowrap text-[11px] font-black text-blue-800">{selectionLabel} · {selectionRows}×{selectionCols}</span><button className={contextClass} onClick={() => copySelection(false)}>Copiar</button><button className={contextClass} onClick={() => copySelection(true)}>Cortar</button><button className={contextClass} onClick={pasteSelection}>Pegar</button><button className={contextClass} onClick={() => toggleStyle('bold')}>Negrita</button><button className={contextClass} onClick={() => applyStyle({ horizontal: 'center' })}>Centrar</button><button className={contextClass} onClick={() => toggleStyle('border')}>Bordes</button><button className={contextClass} onClick={mergeSelection}>Combinar</button><button className={contextClass} onClick={fillDown}>↓ Rellenar</button><button className={contextClass} onClick={fillRight}>→ Rellenar</button><button className={contextClass} onClick={copyFormat}>Copiar formato</button><button className={contextClass} onClick={pasteFormat}>Aplicar formato</button><button className={contextClass} onClick={clearContents}>Borrar contenido</button><button className={contextClass} onClick={clearFormats}>Borrar formato</button></div>}

        <div className="flex-1 overflow-auto bg-white"><div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${10000 / zoom}%` }}><table className="min-w-max border-collapse text-sm select-none" onMouseLeave={() => { if (!dragRef.current.active) dragRef.current.mode = 'cells' }}>
          <thead className="sticky top-0 z-20 bg-slate-100"><tr><th onMouseDown={(event) => { if (event.button !== 0) return; event.preventDefault(); selectAll() }} className={`h-8 w-12 cursor-pointer border border-slate-300 text-[10px] font-black ${selectionMode === 'all' ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-600 hover:bg-blue-100'}`}>▣</th>{sheet.cells[0].map((_, index) => {
            const columnSelected = (selectionMode === 'column' || selectionMode === 'all') && selection.startCol <= index && index <= selection.endCol
            return <th key={index} onMouseDown={(event) => { if (event.button !== 0) return; event.preventDefault(); beginColumnSelection(index) }} onMouseEnter={() => extendColumnSelection(index)} className={`h-8 cursor-pointer border border-slate-300 px-2 text-center font-black ${columnSelected ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} style={{ minWidth: `${Math.max(72, sheet.columnWidths[index] * 7)}px` }}>{columnLabel(index)}</th>
          })}</tr></thead>
          <tbody>{sheet.cells.map((row, rowIndex) => {
            const rowSelected = (selectionMode === 'row' || selectionMode === 'all') && selection.startRow <= rowIndex && rowIndex <= selection.endRow
            return <tr key={rowIndex} style={{ height: `${sheet.rowHeights[rowIndex]}px` }}><th onMouseDown={(event) => { if (event.button !== 0) return; event.preventDefault(); beginRowSelection(rowIndex) }} onMouseEnter={() => extendRowSelection(rowIndex)} className={`sticky left-0 z-10 w-12 cursor-pointer border border-slate-300 text-center text-xs font-black ${rowSelected ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{rowIndex + 1}</th>{row.map((cell, colIndex) => {
              const mergeInfo = mergeAt(sheet.merges, rowIndex, colIndex)
              if (mergeInfo && (rowIndex !== mergeInfo.startRow || colIndex !== mergeInfo.startCol)) return null
              const inSelection = insideRange(selection, rowIndex, colIndex)
              const active = activeCell.row === rowIndex && activeCell.col === colIndex && selectionMode === 'cells'
              const colSpan = mergeInfo ? mergeInfo.endCol - mergeInfo.startCol + 1 : 1
              const rowSpan = mergeInfo ? mergeInfo.endRow - mergeInfo.startRow + 1 : 1
              const width = mergeInfo ? sheet.columnWidths.slice(mergeInfo.startCol, mergeInfo.endCol + 1).reduce((sum, value) => sum + value * 7, 0) : Math.max(72, sheet.columnWidths[colIndex] * 7)
              return <td key={`${rowIndex}-${colIndex}`} colSpan={colSpan} rowSpan={rowSpan} onMouseDown={(event) => { if (event.button !== 0) return; beginCellSelection(rowIndex, colIndex, event.shiftKey) }} onMouseEnter={() => extendCellSelection(rowIndex, colIndex)} className={`${sheet.showGridlines || cell.style?.border ? 'border border-slate-300' : 'border border-transparent'} relative p-0 ${inSelection ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-400' : ''} ${active ? 'ring-2 ring-inset ring-blue-700' : ''}`} style={{ minWidth: `${width}px`, ...renderStyle(cell) }}>
                {cell.image && <img src={cell.image} alt="Insertado" className="pointer-events-none absolute inset-1 z-10 max-h-20 max-w-32 rounded object-contain opacity-90" />}
                <input value={displayed[rowIndex]?.[colIndex] ?? ''} onFocus={() => { if (!multiSelection && selectionMode === 'cells' && active) syncFormulaBar(rowIndex, colIndex) }} onChange={(event) => { if (multiSelection || !active) return; updateCell(rowIndex, colIndex, event.target.value); setFormulaBar(event.target.value) }} onKeyDown={(event) => { if (!active) return; if (event.key === 'Enter') { event.preventDefault(); moveAfterEdit(rowIndex, colIndex, 'down') } else if (event.key === 'Tab') { event.preventDefault(); moveAfterEdit(rowIndex, colIndex, event.shiftKey ? 'left' : 'right') } }} readOnly={multiSelection || !active} draggable={false} className="h-full min-h-9 w-full border-0 bg-transparent px-2 outline-none" style={{ ...renderStyle(cell), minWidth: `${width}px`, paddingTop: cell.image ? '58px' : undefined }} />
                {cell.hyperlink && <a href={cell.hyperlink} target="_blank" rel="noreferrer" className="absolute bottom-0 right-1 z-20 text-[9px] font-bold text-blue-700 underline">abrir</a>}
              </td>
            })}</tr>
          })}</tbody>
        </table></div></div>

        {showChartPanel && sheet.charts.length > 0 && <div className="border-t border-slate-200 bg-white p-4"><div className="mb-2 flex items-center justify-between"><div className="text-xs font-black text-slate-700">{sheet.charts[sheet.charts.length - 1].title}</div><button className={toolClass} onClick={() => mutateSheet((target) => ({ ...target, charts: target.charts.slice(0, -1) }))}>Eliminar gráfico</button></div><div className="h-64 w-full">{chartData.length ? <ResponsiveContainer width="100%" height="100%">{sheet.charts[sheet.charts.length - 1].kind === 'line' ? <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" /></LineChart> : sheet.charts[sheet.charts.length - 1].kind === 'pie' ? <PieChart><Tooltip /><Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} label /></PieChart> : <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" /></BarChart>}</ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-500">Selecciona un rango con valores numéricos.</div>}</div></div>}

        <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-200 bg-slate-100 px-4 py-2">{workbook.sheets.map((item, index) => <button key={`${item.name}-${index}`} onClick={() => { setActiveSheet(index); setAnchor({ row: 0, col: 0 }); setFocusCell({ row: 0, col: 0 }); setActiveCell({ row: 0, col: 0 }); setSelectionMode('cells'); setFormulaBar('') }} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black ${activeSheet === index ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>{item.name}</button>)}<button onClick={addSheet} className="rounded-lg border border-dashed border-slate-400 px-3 py-2 text-xs font-black text-slate-600">+ Hoja</button></div>
      </> : null}
    </div>
  )
}
