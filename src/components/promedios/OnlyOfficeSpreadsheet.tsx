'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type Course = { id: string; name: string }
type Student = { id: string; label: string }
type Connector = {
  callCommand: (command: () => unknown, callback?: (value: { ok?: boolean; error?: string } | undefined) => void, isNoCalc?: boolean) => void
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

type Props = {
  workbookId: string
  title: string
}

export default function OnlyOfficeSpreadsheet({ workbookId, title }: Props) {
  const editorRef = useRef<Editor | null>(null)
  const connectorRef = useRef<Connector | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<'alias' | 'name'>('alias')
  const [sheetName, setSheetName] = useState('')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')

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
        if (!configResponse.ok) throw new Error(editorPayload.hint || editorPayload.error || 'No se pudo iniciar el editor')
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

    boot()
    return () => {
      cancelled = true
      connectorRef.current?.disconnect?.()
      editorRef.current?.destroyEditor?.()
      if (script?.parentNode) script.parentNode.removeChild(script)
    }
  }, [workbookId])

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

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100">
      <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/promedios" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">← Promedios</Link>
            <div className="min-w-0">
              <div className="truncate text-lg font-black text-slate-900">{title}</div>
              <div className="text-xs text-slate-500">Cambios guardados en Supabase mediante el editor · sin almacenamiento local de la aplicación</div>
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
        {notice && <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">{notice}</div>}
        {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
      </div>

      {!ready && !error && <div className="flex h-16 items-center justify-center text-sm font-semibold text-slate-500">Abriendo el libro de forma segura…</div>}
      <div id="promedios-onlyoffice-editor" className="min-h-[760px] flex-1 bg-white" style={{ height: 'calc(100vh - 112px)' }} />
    </div>
  )
}
