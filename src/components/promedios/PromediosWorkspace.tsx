'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type Course = { id: string; name: string; level?: string | null; year?: number | null }
type Workbook = {
  id: string
  title: string
  original_filename: string
  display_mode: 'name' | 'alias'
  created_at: string
  updated_at: string
  last_saved_at?: string | null
  courses?: { name?: string | null } | null
}

export default function PromediosWorkspace() {
  const router = useRouter()
  const [showImport, setShowImport] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [workbooks, setWorkbooks] = useState<Workbook[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadCourses = async () => {
    if (courses.length) return
    const response = await fetch('/api/promedios/cursos', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar los cursos')
    setCourses(payload.courses ?? [])
  }

  const openImport = async () => {
    setError('')
    try {
      await loadCourses()
      setShowImport(true)
      setShowSaved(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cursos')
    }
  }

  const loadSaved = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/promedios', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudieron recuperar los archivos')
      setWorkbooks(payload.workbooks ?? [])
      setShowSaved(true)
      setShowImport(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al recuperar archivos')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const form = new FormData(event.currentTarget)
      const response = await fetch('/api/promedios/import', { method: 'POST', body: form, cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar el Excel')
      router.push(`/promedios/${payload.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el Excel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700">Evaluación y avances</div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Promedios</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Trabaja con el archivo Excel dentro de la plataforma. Los libros guardados se recuperan desde Supabase solo cuando tú eliges abrirlos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={openImport} className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-800">
            + Agregar Excel
          </button>
          <button onClick={loadSaved} disabled={loading} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 hover:bg-slate-50 disabled:opacity-50">
            {loading ? 'Consultando…' : '📁 Archivos guardados'}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Privacidad</div>
          <p className="mt-2 text-sm text-slate-700">No se usa RUT para poblar hojas. Puedes trabajar con nombre o con alias seudonimizado.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Persistencia</div>
          <p className="mt-2 text-sm text-slate-700">La aplicación no usa localStorage, sessionStorage ni IndexedDB para conservar estos libros.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Excel real</div>
          <p className="mt-2 text-sm text-slate-700">El archivo sigue siendo .xlsx: fórmulas, hojas, ponderaciones y formato se mantienen en el documento.</p>
        </div>
      </div>

      {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      {showImport && (
        <form onSubmit={handleImport} className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-black text-slate-900">Agregar libro de evaluación</h2>
            <p className="mt-1 text-sm text-slate-600">Usa el archivo de rúbrica de avances u otro .xlsx. No incluyas RUT en el documento.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Nombre del seguimiento
              <input name="title" required maxLength={160} placeholder="Ej. Proyecto STEAM 4°A" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Curso asociado
              <select name="courseId" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3">
                <option value="">Sin curso fijo</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Identificación predeterminada
              <select name="displayMode" defaultValue="alias" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3">
                <option value="alias">Alias protegidos (recomendado)</option>
                <option value="name">Solo nombres</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Archivo Excel
              <input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="mt-2 block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm" />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="submit" disabled={loading} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50">{loading ? 'Guardando…' : 'Guardar y abrir'}</button>
            <button type="button" onClick={() => setShowImport(false)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {showSaved && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Archivos guardados</h2>
              <p className="text-sm text-slate-600">Selecciona un libro para volver a cargarlo desde Supabase.</p>
            </div>
            <button onClick={loadSaved} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700">Actualizar</button>
          </div>
          {workbooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Todavía no hay libros guardados.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workbooks.map((book) => (
                <button key={book.id} onClick={() => router.push(`/promedios/${book.id}`)} className="rounded-2xl border border-slate-200 p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-black text-slate-900">{book.title}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{book.courses?.name || 'Sin curso fijo'}</div>
                    </div>
                    <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">{book.display_mode === 'alias' ? 'Alias' : 'Nombres'}</span>
                  </div>
                  <div className="mt-5 text-xs text-slate-500">Última actualización: {new Date(book.updated_at).toLocaleString('es-CL')}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!showImport && !showSaved && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-5xl">🧮</div>
          <h2 className="mt-4 text-xl font-black text-slate-900">Elige cómo comenzar</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Agrega un Excel para trabajar o pulsa Archivos guardados para recuperar explícitamente uno de Supabase. No se carga ningún libro automáticamente al entrar.</p>
        </div>
      )}
    </div>
  )
}
