'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import LightSpreadsheet from '@/components/promedios/LightSpreadsheet'

type Course = { id: string; name: string }
type Student = { id: string; label: string }
type ConnectorResult = { ok?: boolean; error?: string }
type Connector = {
  callCommand: (command: () => unknown, callback?: (value: ConnectorResult | undefined) => void, isNoCalc?: boolean) => void
  disconnect?: () => void
}
type Editor = { createConnector: () => Connector; destroyEditor?: () => void }
type DocsApiWindow = Window & {
  DocsAPI?: { DocEditor: new (id: string, config: Record<string, unknown>) => Editor }
  Asc?: { scope?: Record<string, unknown> }
}
type QRCodeWindow = Window & {
  QRCode?: new (element: HTMLElement, options: { text: string; width: number; height: number; correctLevel?: number }) => unknown
}
type Props = { workbookId: string; title: string }
type FormatKind = 'fontName' | 'fontSize' | 'bold' | 'italic' | 'underline' | 'clearTextStyle' | 'fontColor' | 'fillColor' | 'align' | 'wrap' | 'merge' | 'unmerge'

const QRCODE_SRC = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'

async function ensureQRCode() {
  const browser = window as QRCodeWindow
  if (browser.QRCode) return browser.QRCode
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${QRCODE_SRC}"]`) as HTMLScriptElement | null
    if (existing) {
      if (browser.QRCode) return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar el generador QR')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = QRCODE_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el generador QR'))
    document.head.appendChild(script)
  })
  if (!browser.QRCode) throw new Error('Generador QR no disponible')
  return browser.QRCode
}

async function qrDataUrl(text: string) {
  const QRCode = await ensureQRCode()
  const mount = document.createElement('div')
  mount.style.position = 'fixed'
  mount.style.left = '-10000px'
  mount.style.top = '-10000px'
  document.body.appendChild(mount)
  try {
    new QRCode(mount, { text, width: 512, height: 512 })
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    const canvas = mount.querySelector('canvas')
    if (canvas) return canvas.toDataURL('image/png')
    const image = mount.querySelector('img') as HTMLImageElement | null
    if (image?.src) return image.src
    throw new Error('No se pudo generar el QR')
  } finally {
    mount.remove()
  }
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean, 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export default function OnlyOfficeSpreadsheet({ workbookId, title }: Props) {
  const editorRef = useRef<Editor | null>(null)
  const connectorRef = useRef<Connector | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<'alias' | 'name'>('alias')
  const [sheetName, setSheetName] = useState('')
  const [adding, setAdding] = useState(false)
  const [quickBusy, setQuickBusy] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [qrText, setQrText] = useState('')
  const [fontName, setFontName] = useState('Arial')
  const [fontSize, setFontSize] = useState('11')
  const [fontColor, setFontColor] = useState('#111827')
  const [fillColor, setFillColor] = useState('#ffffff')
  const [chartType, setChartType] = useState('bar')
  const [shapeType, setShapeType] = useState('rect')

  useEffect(() => {
    let cancelled = false
    let script: HTMLScriptElement | null = null
    const boot = async () => {
      try {
        const [configResponse, courseResponse] = await Promise.all([
          fetch(`/api/promedios/${workbookId}/editor-config`, { cache: 'no-store' }),
          fetch('/api/promedios/cursos', { cache: 'no-store' }),
        ])
        const editorPayload = await configResponse.json()
        const coursePayload = await courseResponse.json()
        if (!configResponse.ok) {
          if (editorPayload.code === 'ONLYOFFICE_NOT_CONFIGURED') {
            if (!cancelled) setFallback(true)
            return
          }
          throw new Error(editorPayload.hint || editorPayload.error || 'No se pudo iniciar el editor')
        }
        if (!courseResponse.ok) throw new Error(coursePayload.error || 'No se pudieron cargar los cursos')
        if (cancelled) return
        setCourses(coursePayload.courses ?? [])

        const browser = window as DocsApiWindow
        const startEditor = () => {
          if (cancelled || !browser.DocsAPI) return
          const config = editorPayload.config as Record<string, unknown> & { events?: Record<string, unknown> }
          config.events = {
            ...(config.events ?? {}),
            onDocumentReady: () => {
              if (!editorRef.current) return
              connectorRef.current = editorRef.current.createConnector()
              setReady(true)
            },
            onError: (event: { data?: { errorDescription?: string } }) => setError(event?.data?.errorDescription || 'El editor informó un error'),
          }
          editorRef.current = new browser.DocsAPI.DocEditor('promedios-onlyoffice-editor', config)
        }

        if (browser.DocsAPI) return startEditor()
        script = document.createElement('script')
        script.src = `${String(editorPayload.documentServerUrl).replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`
        script.async = true
        script.onload = startEditor
        script.onerror = () => setError('No se pudo cargar ONLYOFFICE Document Server')
        document.head.appendChild(script)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo abrir el Excel')
      }
    }
    void boot()
    return () => {
      cancelled = true
      connectorRef.current?.disconnect?.()
      editorRef.current?.destroyEditor?.()
      if (script?.parentNode) script.parentNode.removeChild(script)
    }
  }, [workbookId])

  const runConnector = (command: () => unknown) => new Promise<void>((resolve, reject) => {
    const connector = connectorRef.current
    if (!ready || !connector) return reject(new Error('El editor aún no está listo'))
    connector.callCommand(command, (result) => result?.ok ? resolve() : reject(new Error(result?.error || 'No se pudo completar la acción')))
  })

  const applyFormat = async (kind: FormatKind, value?: string | number | boolean) => {
    setQuickBusy(true); setNotice(''); setError('')
    try {
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}; browser.Asc.scope = browser.Asc.scope ?? {}
      const color = typeof value === 'string' && value.startsWith('#') ? hexToRgb(value) : null
      browser.Asc.scope.promediosFormat = { kind, value, color }
      await runConnector(function () {
        try {
          // @ts-expect-error ONLYOFFICE runtime scope.
          const payload = Asc.scope.promediosFormat
          // @ts-expect-error ONLYOFFICE runtime scope.
          const range = Api.GetSelection()
          if (!range) return { ok: false, error: 'Selecciona una celda o rango.' }
          if (payload.kind === 'fontName') range.SetFontName(String(payload.value))
          else if (payload.kind === 'fontSize') range.SetFontSize(Number(payload.value))
          else if (payload.kind === 'bold') range.SetBold(true)
          else if (payload.kind === 'italic') range.SetItalic(true)
          else if (payload.kind === 'underline') range.SetUnderline('single')
          else if (payload.kind === 'clearTextStyle') { range.SetBold(false); range.SetItalic(false); range.SetUnderline('none') }
          // @ts-expect-error ONLYOFFICE runtime scope.
          else if (payload.kind === 'fontColor') range.SetFontColor(Api.CreateColorFromRGB(payload.color.r, payload.color.g, payload.color.b))
          // @ts-expect-error ONLYOFFICE runtime scope.
          else if (payload.kind === 'fillColor') range.SetFillColor(Api.CreateColorFromRGB(payload.color.r, payload.color.g, payload.color.b))
          else if (payload.kind === 'align') range.SetAlignHorizontal(String(payload.value))
          else if (payload.kind === 'wrap') range.SetWrap(Boolean(payload.value))
          else if (payload.kind === 'merge') range.Merge(false)
          else if (payload.kind === 'unmerge') range.UnMerge()
          return { ok: true }
        } catch (err) { return { ok: false, error: String(err) } }
      })
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo aplicar el formato') }
    finally { setQuickBusy(false) }
  }

  const addCourseSheet = async () => {
    if (!ready || !connectorRef.current) return
    if (!courseId) return setNotice('Selecciona un curso.')
    const course = courses.find((item) => item.id === courseId)
    const requestedName = (sheetName.trim() || course?.name || 'Nuevo curso').slice(0, 31)
    setAdding(true); setNotice(''); setError('')
    try {
      const response = await fetch(`/api/promedios/cursos/${courseId}/estudiantes?mode=${mode}&workbookId=${workbookId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo obtener la nómina')
      const students = (payload.students ?? []) as Student[]
      if (students.length > 40) throw new Error('La plantilla actual admite 40 estudiantes por hoja.')
      const labels = Array.from({ length: 40 }, (_, index) => students[index]?.label ?? '')
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}; browser.Asc.scope = browser.Asc.scope ?? {}
      browser.Asc.scope.promediosPayload = { sheetName: requestedName, labels }
      connectorRef.current.callCommand(function () {
        try {
          // @ts-expect-error ONLYOFFICE runtime scope.
          const payload = Asc.scope.promediosPayload
          // @ts-expect-error ONLYOFFICE runtime scope.
          if (Api.GetSheet(payload.sheetName)) return { ok: false, error: 'Ya existe una hoja con ese nombre.' }
          // @ts-expect-error ONLYOFFICE runtime scope.
          const source = Api.GetSheet('4mA') || Api.GetSheet('4mB') || Api.GetSheets()[0]
          if (!source) return { ok: false, error: 'No existe una hoja base para copiar.' }
          // @ts-expect-error ONLYOFFICE runtime scope.
          const target = Api.AddSheet(payload.sheetName)
          source.GetRange('A1:G55').Copy(target.GetRange('A1:G55'))
          for (let column = 0; column < 7; column += 1) {
            const letter = String.fromCharCode(65 + column)
            target.SetColumnWidth(column, source.GetRange(`${letter}1`).GetColumnWidth(), true)
          }
          target.GetRange('A9:A48').ClearContents(); target.GetRange('B9:D48').ClearContents()
          target.GetRange('A9:A48').SetValue(payload.labels.map((label: string) => [label]))
          target.GetRange('G9').SetFormula('=IF(F9="","",IF(F9>=4,"APROBADO","REPROBADO"))')
          target.GetRange('G9:G48').FillDown(); target.SetActive()
          return { ok: true }
        } catch (err) { return { ok: false, error: String(err) } }
      }, (result) => setNotice(result?.ok ? `Hoja “${requestedName}” creada con ${students.length} estudiantes.` : result?.error || 'No se pudo crear la hoja.'))
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo agregar la hoja') }
    finally { setAdding(false) }
  }

  const insertImage = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Selecciona un archivo de imagen.')
    if (file.size > 4 * 1024 * 1024) return setError('Usa imágenes de hasta 4 MB.')
    setQuickBusy(true); setNotice(''); setError('')
    try {
      const dataUrl = await readImage(file)
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}; browser.Asc.scope = browser.Asc.scope ?? {}
      browser.Asc.scope.promediosInsertImage = { dataUrl, widthMm: 42, heightMm: 32 }
      await runConnector(function () {
        try {
          // @ts-expect-error ONLYOFFICE runtime scope.
          const payload = Asc.scope.promediosInsertImage
          // @ts-expect-error ONLYOFFICE runtime scope.
          const sheet = Api.GetActiveSheet()
          const activeCell = sheet.GetActiveCell(); const col = Math.max(0, activeCell.GetCol() - 1); const row = Math.max(0, activeCell.GetRow() - 1)
          sheet.AddImage(payload.dataUrl, payload.widthMm * 36000, payload.heightMm * 36000, col, 0, row, 0)
          return { ok: true }
        } catch (err) { return { ok: false, error: String(err) } }
      })
      setNotice('Imagen insertada en la posición de la celda activa.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo insertar la imagen') }
    finally { setQuickBusy(false) }
  }

  const insertHyperlink = async () => {
    const url = normalizeUrl(linkUrl)
    if (!url) return setNotice('Escribe una dirección para el enlace.')
    setQuickBusy(true); setNotice(''); setError('')
    try {
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}; browser.Asc.scope = browser.Asc.scope ?? {}
      browser.Asc.scope.promediosHyperlink = { url, label: linkLabel.trim() || url }
      await runConnector(function () {
        try {
          // @ts-expect-error ONLYOFFICE runtime scope.
          const payload = Asc.scope.promediosHyperlink
          // @ts-expect-error ONLYOFFICE runtime scope.
          const sheet = Api.GetActiveSheet(); const activeCell = sheet.GetActiveCell(); const address = activeCell.GetAddress(true, true, 'xlA1', false) || 'A1'
          sheet.SetHyperlink(address, payload.url, null, payload.label, payload.label)
          return { ok: true }
        } catch (err) { return { ok: false, error: String(err) } }
      })
      setNotice('Enlace agregado a la celda activa.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo insertar el enlace') }
    finally { setQuickBusy(false) }
  }

  const insertQr = async () => {
    if (!qrText.trim()) return setNotice('Escribe el texto o enlace que contendrá el QR.')
    setQuickBusy(true); setNotice(''); setError('')
    try {
      const dataUrl = await qrDataUrl(qrText.trim())
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}; browser.Asc.scope = browser.Asc.scope ?? {}
      browser.Asc.scope.promediosQr = { dataUrl }
      await runConnector(function () {
        try {
          // @ts-expect-error ONLYOFFICE runtime scope.
          const payload = Asc.scope.promediosQr
          // @ts-expect-error ONLYOFFICE runtime scope.
          const sheet = Api.GetActiveSheet(); const activeCell = sheet.GetActiveCell(); const col = Math.max(0, activeCell.GetCol() - 1); const row = Math.max(0, activeCell.GetRow() - 1)
          sheet.AddImage(payload.dataUrl, 30 * 36000, 30 * 36000, col, 0, row, 0)
          return { ok: true }
        } catch (err) { return { ok: false, error: String(err) } }
      })
      setNotice('Código QR insertado en la hoja.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo insertar el QR') }
    finally { setQuickBusy(false) }
  }

  const insertChart = async () => {
    setQuickBusy(true); setNotice(''); setError('')
    try {
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}; browser.Asc.scope = browser.Asc.scope ?? {}; browser.Asc.scope.promediosChart = { type: chartType }
      await runConnector(function () {
        try {
          // @ts-expect-error ONLYOFFICE runtime scope.
          const payload = Asc.scope.promediosChart
          // @ts-expect-error ONLYOFFICE runtime scope.
          const sheet = Api.GetActiveSheet()
          // @ts-expect-error ONLYOFFICE runtime scope.
          const selection = Api.GetSelection()
          const address = selection.GetAddress(true, true, 'xlA1', false)
          const name = String(sheet.GetName()).replace(/'/g, "''")
          const cell = sheet.GetActiveCell(); const col = Math.max(0, cell.GetCol() - 1); const row = Math.max(0, cell.GetRow() - 1)
          sheet.AddChart(`'${name}'!${address}`, true, payload.type, 2, 150 * 36000, 85 * 36000, col, 0, row + 2, 0)
          return { ok: true }
        } catch (err) { return { ok: false, error: 'Selecciona primero una tabla de datos. ' + String(err) } }
      })
      setNotice('Gráfico creado desde el rango seleccionado.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear el gráfico') }
    finally { setQuickBusy(false) }
  }

  const insertShape = async () => {
    setQuickBusy(true); setNotice(''); setError('')
    try {
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}; browser.Asc.scope = browser.Asc.scope ?? {}; browser.Asc.scope.promediosShape = { type: shapeType }
      await runConnector(function () {
        try {
          // @ts-expect-error ONLYOFFICE runtime scope.
          const payload = Asc.scope.promediosShape
          // @ts-expect-error ONLYOFFICE runtime scope.
          const sheet = Api.GetActiveSheet(); const cell = sheet.GetActiveCell(); const col = Math.max(0, cell.GetCol() - 1); const row = Math.max(0, cell.GetRow() - 1)
          // @ts-expect-error ONLYOFFICE runtime scope.
          const fill = Api.CreateSolidFill(Api.CreateColorFromRGB(226, 232, 240))
          // @ts-expect-error ONLYOFFICE runtime scope.
          const stroke = Api.CreateStroke(0, Api.CreateNoFill())
          sheet.AddShape(payload.type, 50 * 36000, 28 * 36000, fill, stroke, col, 0, row, 0)
          return { ok: true }
        } catch (err) { return { ok: false, error: String(err) } }
      })
      setNotice('Figura insertada en la hoja.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo insertar la figura') }
    finally { setQuickBusy(false) }
  }

  const setOrientation = async (value: 'xlPortrait' | 'xlLandscape') => {
    setQuickBusy(true); setNotice(''); setError('')
    try {
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}; browser.Asc.scope = browser.Asc.scope ?? {}; browser.Asc.scope.promediosOrientation = { value }
      await runConnector(function () {
        try {
          // @ts-expect-error ONLYOFFICE runtime scope.
          const payload = Asc.scope.promediosOrientation
          // @ts-expect-error ONLYOFFICE runtime scope.
          Api.GetActiveSheet().SetPageOrientation(payload.value)
          return { ok: true }
        } catch (err) { return { ok: false, error: String(err) } }
      })
      setNotice(value === 'xlPortrait' ? 'Página en orientación vertical.' : 'Página en orientación horizontal.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cambiar la orientación') }
    finally { setQuickBusy(false) }
  }

  const setPrintGridlines = async () => {
    setQuickBusy(true); setNotice(''); setError('')
    try {
      await runConnector(function () {
        try {
          // @ts-expect-error ONLYOFFICE runtime scope.
          Api.GetActiveSheet().SetPrintGridlines(true)
          return { ok: true }
        } catch (err) { return { ok: false, error: String(err) } }
      })
      setNotice('Cuadrícula habilitada para impresión.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cambiar la impresión') }
    finally { setQuickBusy(false) }
  }

  if (fallback) return <LightSpreadsheet workbookId={workbookId} title={title} />

  const toolClass = 'rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40'
  const selectClass = 'rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none'

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100">
      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; void insertImage(file); event.target.value = '' }} />

      <div className="sticky top-0 z-30 border-b border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <Link href="/promedios" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">← Promedios</Link>
          <div className="mr-auto min-w-0"><div className="truncate text-sm font-black text-slate-900">{title}</div><div className="text-[10px] font-semibold text-slate-500">Editor de Promedios · guardado en Supabase</div></div>
          <a href={`/api/promedios/${workbookId}/download`} className={toolClass}>Descargar .xlsx</a>
        </div>

        {ready && <div className="overflow-x-auto border-t border-slate-200 bg-slate-50">
          <div className="flex min-w-max items-stretch gap-0 px-3 py-1.5">
            <div className="flex items-center gap-1 border-r border-slate-300 px-2">
              <span className="mr-1 text-[10px] font-black uppercase text-slate-500">Inicio</span>
              <select value={fontName} onChange={(e) => { setFontName(e.target.value); void applyFormat('fontName', e.target.value) }} className={`${selectClass} w-28`} disabled={quickBusy}>
                {['Arial','Calibri','Aptos','Roboto','Verdana','Tahoma','Times New Roman','Georgia'].map((font) => <option key={font}>{font}</option>)}
              </select>
              <select value={fontSize} onChange={(e) => { setFontSize(e.target.value); void applyFormat('fontSize', Number(e.target.value)) }} className={`${selectClass} w-16`} disabled={quickBusy}>
                {['8','9','10','11','12','14','16','18','20','24','28','32','36','48','72'].map((size) => <option key={size}>{size}</option>)}
              </select>
              <button className={toolClass} onClick={() => void applyFormat('bold', true)} disabled={quickBusy}>B</button>
              <button className={`${toolClass} italic`} onClick={() => void applyFormat('italic', true)} disabled={quickBusy}>I</button>
              <button className={`${toolClass} underline`} onClick={() => void applyFormat('underline', true)} disabled={quickBusy}>U</button>
              <button className={toolClass} onClick={() => void applyFormat('clearTextStyle')} disabled={quickBusy}>Normal</button>
              <label className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black text-slate-600">A<input type="color" value={fontColor} onChange={(e) => { setFontColor(e.target.value); void applyFormat('fontColor', e.target.value) }} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" /></label>
              <label className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black text-slate-600">▣<input type="color" value={fillColor} onChange={(e) => { setFillColor(e.target.value); void applyFormat('fillColor', e.target.value) }} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" /></label>
              <button className={toolClass} onClick={() => void applyFormat('align','left')} disabled={quickBusy}>≡←</button>
              <button className={toolClass} onClick={() => void applyFormat('align','center')} disabled={quickBusy}>≡</button>
              <button className={toolClass} onClick={() => void applyFormat('align','right')} disabled={quickBusy}>→≡</button>
              <button className={toolClass} onClick={() => void applyFormat('wrap',true)} disabled={quickBusy}>Ajustar</button>
              <button className={toolClass} onClick={() => void applyFormat('merge')} disabled={quickBusy}>Combinar</button>
              <button className={toolClass} onClick={() => void applyFormat('unmerge')} disabled={quickBusy}>Separar</button>
            </div>

            <div className="flex items-center gap-1 border-r border-slate-300 px-2">
              <span className="mr-1 text-[10px] font-black uppercase text-slate-500">Insertar</span>
              <button className={toolClass} onClick={() => imageInputRef.current?.click()} disabled={quickBusy}>🖼 Imagen</button>
              <select value={chartType} onChange={(e) => setChartType(e.target.value)} className={selectClass}><option value="bar">Barras</option><option value="line">Líneas</option><option value="pie">Circular</option><option value="scatter">Dispersión</option></select>
              <button className={toolClass} onClick={() => void insertChart()} disabled={quickBusy}>📊 Gráfico</button>
              <select value={shapeType} onChange={(e) => setShapeType(e.target.value)} className={selectClass}><option value="rect">Rectángulo</option><option value="ellipse">Círculo</option><option value="rightArrow">Flecha</option></select>
              <button className={toolClass} onClick={() => void insertShape()} disabled={quickBusy}>◇ Figura</button>
              <details className="relative"><summary className={`${toolClass} cursor-pointer list-none`}>🔗 Enlace</summary><div className="absolute left-0 top-11 z-50 w-72 rounded-xl border border-slate-300 bg-white p-3 shadow-xl"><input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /><input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Texto del enlace" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /><button className={`${toolClass} w-full`} onClick={() => void insertHyperlink()}>Insertar enlace</button></div></details>
              <details className="relative"><summary className={`${toolClass} cursor-pointer list-none`}>▦ QR</summary><div className="absolute left-0 top-11 z-50 w-72 rounded-xl border border-slate-300 bg-white p-3 shadow-xl"><input value={qrText} onChange={(e) => setQrText(e.target.value)} placeholder="Texto o URL" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /><button className={`${toolClass} w-full`} onClick={() => void insertQr()}>Generar e insertar QR</button></div></details>
            </div>

            <div className="flex items-center gap-1 border-r border-slate-300 px-2">
              <span className="mr-1 text-[10px] font-black uppercase text-slate-500">Diseño</span>
              <button className={toolClass} onClick={() => void setOrientation('xlPortrait')} disabled={quickBusy}>▯ Vertical</button>
              <button className={toolClass} onClick={() => void setOrientation('xlLandscape')} disabled={quickBusy}>▭ Horizontal</button>
              <button className={toolClass} onClick={() => void setPrintGridlines()} disabled={quickBusy}># Cuadrícula</button>
              <button className={toolClass} onClick={() => setNotice('Carta, Oficio, Legal, A4 y A3 se seleccionan en Diseño → Tamaño de página dentro de la barra completa de ONLYOFFICE.')}>📄 Tamaño papel</button>
            </div>

            <div className="flex items-center gap-1 px-2">
              <span className="mr-1 text-[10px] font-black uppercase text-emerald-700">Docente</span>
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); const course = courses.find((item) => item.id === e.target.value); if (course) setSheetName(course.name) }} className={`${selectClass} min-w-40`}><option value="">Curso…</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
              <select value={mode} onChange={(e) => setMode(e.target.value === 'name' ? 'name' : 'alias')} className={selectClass}><option value="alias">Alias</option><option value="name">Nombres</option></select>
              <input value={sheetName} maxLength={31} onChange={(e) => setSheetName(e.target.value)} placeholder="Nombre hoja" className="w-32 rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-semibold" />
              <button onClick={() => void addCourseSheet()} disabled={!ready || adding} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100 disabled:opacity-40">{adding ? 'Cargando…' : '+ Hoja curso'}</button>
            </div>
          </div>
        </div>}

        {notice && <div className="border-t border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-800 sm:px-6">{notice}</div>}
        {error && <div className="border-t border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-700 sm:px-6">{error}</div>}
      </div>

      {!ready && !error && <div className="flex h-16 items-center justify-center text-sm font-semibold text-slate-500">Abriendo el editor avanzado…</div>}
      <div id="promedios-onlyoffice-editor" className="min-h-[760px] flex-1 bg-white" style={{ height: 'calc(100vh - 126px)' }} />
    </div>
  )
}
