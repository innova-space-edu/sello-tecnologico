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
type Editor = {
  createConnector: () => Connector
  destroyEditor?: () => void
}
type DocsApiWindow = Window & {
  DocsAPI?: { DocEditor: new (id: string, config: Record<string, unknown>) => Editor }
  Asc?: { scope?: Record<string, unknown> }
}
type QRCodeWindow = Window & {
  QRCode?: new (element: HTMLElement, options: { text: string; width: number; height: number; correctLevel?: number }) => unknown
}

type Props = {
  workbookId: string
  title: string
}

const QRCODE_SRC = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'

async function ensureQRCode() {
  const browser = window as QRCodeWindow
  if (browser.QRCode) return browser.QRCode

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${QRCODE_SRC}"]`) as HTMLScriptElement | null
    if (existing) {
      if (browser.QRCode) {
        resolve()
        return
      }
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

export default function OnlyOfficeSpreadsheet({ workbookId, title }: Props) {
  const editorRef = useRef<Editor | null>(null)
  const connectorRef = useRef<Connector | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [error, setError] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<'alias' | 'name'>('alias')
  const [sheetName, setSheetName] = useState('')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [qrText, setQrText] = useState('')

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
            onError: (event: { data?: { errorDescription?: string } }) => {
              setError(event?.data?.errorDescription || 'El editor informó un error')
            },
          }
          editorRef.current = new browser.DocsAPI.DocEditor('promedios-onlyoffice-editor', config)
        }

        if (browser.DocsAPI) {
          startEditor()
          return
        }

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
    if (!ready || !connector) {
      reject(new Error('El editor aún no está listo'))
      return
    }
    connector.callCommand(command, (result) => {
      if (result?.ok) resolve()
      else reject(new Error(result?.error || 'No se pudo completar la acción'))
    })
  })

  const addCourseSheet = async () => {
    if (!ready || !connectorRef.current) return
    if (!courseId) {
      setNotice('Selecciona un curso.')
      return
    }
    const course = courses.find((item) => item.id === courseId)
    const requestedName = (sheetName.trim() || course?.name || 'Nuevo curso').slice(0, 31)
    setAdding(true)
    setNotice('')
    try {
      const response = await fetch(`/api/promedios/cursos/${courseId}/estudiantes?mode=${mode}&workbookId=${workbookId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo obtener la nómina')
      const students = (payload.students ?? []) as Student[]
      if (students.length > 40) throw new Error('La plantilla actual admite 40 estudiantes por hoja. Ajusta la plantilla antes de cargar este curso.')

      const labels = Array.from({ length: 40 }, (_, index) => students[index]?.label ?? '')
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}
      browser.Asc.scope = browser.Asc.scope ?? {}
      browser.Asc.scope.promediosPayload = { sheetName: requestedName, labels }

      connectorRef.current.callCommand(function () {
        try {
          // @ts-expect-error Api y Asc existen dentro del contexto aislado de ONLYOFFICE.
          const payload = Asc.scope.promediosPayload
          // @ts-expect-error Api existe dentro del contexto aislado de ONLYOFFICE.
          if (Api.GetSheet(payload.sheetName)) return { ok: false, error: 'Ya existe una hoja con ese nombre.' }
          // @ts-expect-error Api existe dentro del contexto aislado de ONLYOFFICE.
          const source = Api.GetSheet('4mA') || Api.GetSheet('4mB') || Api.GetSheets()[0]
          if (!source) return { ok: false, error: 'No existe una hoja base para copiar.' }
          // @ts-expect-error Api existe dentro del contexto aislado de ONLYOFFICE.
          const target = Api.AddSheet(payload.sheetName)
          source.GetRange('A1:G55').Copy(target.GetRange('A1:G55'))
          for (let column = 0; column < 7; column += 1) {
            const letter = String.fromCharCode(65 + column)
            target.SetColumnWidth(column, source.GetRange(`${letter}1`).GetColumnWidth(), true)
          }
          target.GetRange('A9:A48').ClearContents()
          target.GetRange('B9:D48').ClearContents()
          target.GetRange('A9:A48').SetValue(payload.labels.map((label: string) => [label]))
          target.GetRange('G9').SetFormula('=IF(F9="","",IF(F9>=4,"APROBADO","REPROBADO"))')
          target.GetRange('G9:G48').FillDown()
          target.SetActive()
          return { ok: true }
        } catch (err) {
          return { ok: false, error: String(err) }
        }
      }, (result) => {
        if (result?.ok) setNotice(`Hoja “${requestedName}” creada con ${students.length} estudiantes.`)
        else setNotice(result?.error || 'No se pudo crear la hoja.')
      })
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo agregar la hoja')
    } finally {
      setAdding(false)
    }
  }

  const insertImage = async (file?: File) => {
    if (!file) return
    setNotice('')
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Para insertar una imagen dentro de la planilla usa archivos de hasta 4 MB.')
      return
    }

    setQuickBusy(true)
    try {
      const dataUrl = await readImage(file)
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}
      browser.Asc.scope = browser.Asc.scope ?? {}
      browser.Asc.scope.promediosInsertImage = { dataUrl, widthMm: 42, heightMm: 32 }
      await runConnector(function () {
        try {
          // @ts-expect-error Api y Asc existen dentro del contexto aislado de ONLYOFFICE.
          const payload = Asc.scope.promediosInsertImage
          // @ts-expect-error Api existe dentro del contexto aislado de ONLYOFFICE.
          const sheet = Api.GetActiveSheet()
          const activeCell = sheet.GetActiveCell()
          const col = Math.max(0, activeCell.GetCol() - 1)
          const row = Math.max(0, activeCell.GetRow() - 1)
          sheet.AddImage(payload.dataUrl, payload.widthMm * 36000, payload.heightMm * 36000, col, 0, row, 0)
          return { ok: true }
        } catch (err) {
          return { ok: false, error: String(err) }
        }
      })
      setNotice('Imagen insertada en la posición de la celda activa.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo insertar la imagen')
    } finally {
      setQuickBusy(false)
    }
  }

  const insertHyperlink = async () => {
    const url = normalizeUrl(linkUrl)
    if (!url) {
      setNotice('Escribe una dirección para el enlace.')
      return
    }

    setQuickBusy(true)
    setNotice('')
    setError('')
    try {
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}
      browser.Asc.scope = browser.Asc.scope ?? {}
      browser.Asc.scope.promediosHyperlink = { url, label: linkLabel.trim() || url }
      await runConnector(function () {
        try {
          // @ts-expect-error Api y Asc existen dentro del contexto aislado de ONLYOFFICE.
          const payload = Asc.scope.promediosHyperlink
          // @ts-expect-error Api existe dentro del contexto aislado de ONLYOFFICE.
          const sheet = Api.GetActiveSheet()
          const activeCell = sheet.GetActiveCell()
          const address = activeCell.GetAddress(true, true, 'xlA1', false) || 'A1'
          sheet.SetHyperlink(address, payload.url, null, payload.label, payload.label)
          return { ok: true }
        } catch (err) {
          return { ok: false, error: String(err) }
        }
      })
      setNotice('Enlace agregado a la celda activa.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo insertar el enlace')
    } finally {
      setQuickBusy(false)
    }
  }

  const insertQr = async () => {
    const value = qrText.trim()
    if (!value) {
      setNotice('Escribe el texto o enlace que contendrá el QR.')
      return
    }

    setQuickBusy(true)
    setNotice('')
    setError('')
    try {
      const dataUrl = await qrDataUrl(value)
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}
      browser.Asc.scope = browser.Asc.scope ?? {}
      browser.Asc.scope.promediosQr = { dataUrl }
      await runConnector(function () {
        try {
          // @ts-expect-error Api y Asc existen dentro del contexto aislado de ONLYOFFICE.
          const payload = Asc.scope.promediosQr
          // @ts-expect-error Api existe dentro del contexto aislado de ONLYOFFICE.
          const sheet = Api.GetActiveSheet()
          const activeCell = sheet.GetActiveCell()
          const col = Math.max(0, activeCell.GetCol() - 1)
          const row = Math.max(0, activeCell.GetRow() - 1)
          sheet.AddImage(payload.dataUrl, 30 * 36000, 30 * 36000, col, 0, row, 0)
          return { ok: true }
        } catch (err) {
          return { ok: false, error: String(err) }
        }
      })
      setNotice('Código QR generado localmente e insertado en la celda activa.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo insertar el QR')
    } finally {
      setQuickBusy(false)
    }
  }

  const setOrientation = async (value: 'xlPortrait' | 'xlLandscape') => {
    setQuickBusy(true)
    setNotice('')
    setError('')
    try {
      const browser = window as DocsApiWindow
      browser.Asc = browser.Asc ?? {}
      browser.Asc.scope = browser.Asc.scope ?? {}
      browser.Asc.scope.promediosOrientation = { value }
      await runConnector(function () {
        try {
          // @ts-expect-error Api y Asc existen dentro del contexto aislado de ONLYOFFICE.
          const payload = Asc.scope.promediosOrientation
          // @ts-expect-error Api existe dentro del contexto aislado de ONLYOFFICE.
          Api.GetActiveSheet().SetPageOrientation(payload.value)
          return { ok: true }
        } catch (err) {
          return { ok: false, error: String(err) }
        }
      })
      setNotice(value === 'xlPortrait' ? 'Página configurada en orientación vertical.' : 'Página configurada en orientación horizontal.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la orientación')
    } finally {
      setQuickBusy(false)
    }
  }

  if (fallback) return <LightSpreadsheet workbookId={workbookId} title={title} />

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          void insertImage(file)
          event.target.value = ''
        }}
      />

      <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/promedios" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">← Promedios</Link>
            <div className="min-w-0">
              <div className="truncate text-lg font-black text-slate-900">{title}</div>
              <div className="text-xs text-slate-500">Editor avanzado · formatos, imágenes, gráficos, formas, enlaces, impresión y guardado en Supabase</div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Curso
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); const c = courses.find((item) => item.id === e.target.value); if (c) setSheetName(c.name) }} className="mt-1 block min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-800">
                <option value="">Seleccionar…</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Identificación
              <select value={mode} onChange={(e) => setMode(e.target.value === 'name' ? 'name' : 'alias')} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-800">
                <option value="alias">Alias</option>
                <option value="name">Nombres</option>
              </select>
            </label>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Hoja
              <input value={sheetName} maxLength={31} onChange={(e) => setSheetName(e.target.value)} placeholder="Nombre de hoja" className="mt-1 block w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-800" />
            </label>
            <button onClick={addCourseSheet} disabled={!ready || adding} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              {adding ? 'Cargando…' : '+ Hoja desde curso'}
            </button>
            <a href={`/api/promedios/${workbookId}/download`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Descargar .xlsx</a>
          </div>
        </div>

        {ready && <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div className="mr-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Insertar rápido</div>
          <button onClick={() => imageInputRef.current?.click()} disabled={quickBusy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">🖼 Imagen</button>
          <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://…" className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800" />
          <input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Texto del enlace" className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800" />
          <button onClick={insertHyperlink} disabled={quickBusy} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 hover:bg-blue-100 disabled:opacity-50">🔗 Enlace</button>
          <input value={qrText} onChange={(event) => setQrText(event.target.value)} placeholder="Texto o URL para QR" className="w-52 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800" />
          <button onClick={insertQr} disabled={quickBusy} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-800 hover:bg-violet-100 disabled:opacity-50">▦ QR</button>
          <select defaultValue="" disabled={quickBusy} onChange={(event) => { const value = event.target.value as 'xlPortrait' | 'xlLandscape' | ''; if (value) void setOrientation(value); event.target.value = '' }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50">
            <option value="">Orientación…</option>
            <option value="xlPortrait">Vertical</option>
            <option value="xlLandscape">Horizontal</option>
          </select>
          <span className="ml-auto text-[11px] font-semibold text-slate-500">Fuentes, tamaños, colores, bordes, gráficos, formas y tamaños de papel están en la barra completa del editor.</span>
        </div>}

        {notice && <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">{notice}</div>}
        {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
      </div>

      {!ready && !error && <div className="flex h-16 items-center justify-center text-sm font-semibold text-slate-500">Abriendo el editor avanzado…</div>}
      <div id="promedios-onlyoffice-editor" className="min-h-[760px] flex-1 bg-white" style={{ height: 'calc(100vh - 150px)' }} />
    </div>
  )
}
