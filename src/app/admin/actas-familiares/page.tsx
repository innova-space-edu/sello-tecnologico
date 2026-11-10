"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Act = {
  folio: string
  record_type: "borrador" | "aprobacion"
  request_id: string | null
  student_name: string | null
  guardian_name: string | null
  guardian_relationship: string | null
  institution_name: string | null
  reviewer_name: string
  approved_at: string | null
  verified_method: string | null
  evidence_reference: string | null
  document_version: string | null
  authorization_status: string
  created_at: string
  notes: string | null
  revoked_at: string | null
}
type ArchiveResponse = {
  acts: Act[]; total: number; page: number; pageSize: number
  officialCount: number; draftCount: number; hasMore: boolean
}
function localDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" })
    : "—"
}

export default function ActasFamiliaresPage() {
  const [acts, setActs] = useState<Act[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [official, setOfficial] = useState(0)
  const [drafts, setDrafts] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => { setPage(0); setSearch(searchInput.trim()) }, 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page) })
    if (filter !== "all") params.set("type", filter)
    if (search) params.set("q", search)
    setLoading(true)
    setError("")
    fetch(`/api/admin/actas-familiares?${params.toString()}`, {
      credentials: "same-origin", cache: "no-store", signal: controller.signal,
    })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "No se pudo consultar el archivo")
        return result as ArchiveResponse
      })
      .then(data => {
        if (controller.signal.aborted) return
        setActs(data.acts)
        setTotal(data.total)
        setPageSize(data.pageSize)
        setOfficial(data.officialCount)
        setDrafts(data.draftCount)
        setHasMore(data.hasMore)
      })
      .catch(error => {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "No se pudo cargar el archivo")
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, filter, search])

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <nav className="flex flex-wrap gap-4 text-sm text-blue-700">
        <Link href="/admin">← Panel Admin</Link>
        <Link href="/admin/autorizaciones-familiares">Revisar autorizaciones</Link>
      </nav>
      <header className="rounded-2xl bg-blue-950 p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Archivo privado · CreaLab</p>
        <h1 className="mt-2 text-2xl font-bold">Actas de autorización familiar</h1>
        <p className="mt-3 text-sm text-blue-100">Historial consultable de todos los folios, aprobaciones, revocaciones y borradores, paginado para proteger el rendimiento. Acceso exclusivo de administración.</p>
      </header>
      <section aria-label="Resumen del archivo" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-2xl font-bold">{official}</p><p className="text-sm">Actas oficiales</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-2xl font-bold">{drafts}</p><p className="text-sm">Borradores de demostración</p></div>
        <div className="col-span-2 rounded-xl border bg-white p-4 sm:col-span-1"><p className="text-2xl font-bold">{total}</p><p className="text-sm">Resultados del filtro</p></div>
      </section>
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input aria-label="Buscar en todo el archivo" value={searchInput} onChange={event => setSearchInput(event.target.value)}
            placeholder="Buscar folio, estudiante o apoderado"
            className="w-full flex-1 rounded-lg border border-slate-300 p-3 text-sm sm:min-w-64" />
          <select aria-label="Tipo de acta" value={filter} onChange={event => { setPage(0); setFilter(event.target.value) }}
            className="rounded-lg border border-slate-300 p-3 text-sm">
            <option value="all">Todas</option>
            <option value="aprobacion">Actas oficiales</option>
            <option value="borrador">Borradores</option>
          </select>
        </div>
        <p className="mt-3 text-xs text-slate-500">La búsqueda y el tipo se aplican a todo el archivo; no solo a los registros visibles.</p>
        {loading && <p className="mt-4 text-sm" role="status">Cargando actas…</p>}
        {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
        {!loading && !error && acts.length === 0 && <p className="mt-4 text-sm text-slate-600">No existen actas que coincidan con estos filtros.</p>}
        {!loading && !error && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>Resultados {total === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">← Anterior</button>
            <button type="button" disabled={!hasMore} onClick={() => setPage(page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Siguiente →</button>
          </div>
        </div>}
        <div className="mt-4 space-y-4">
          {!loading && !error && acts.map(act =>
            <article key={act.folio} className={`rounded-xl border p-5 ${act.record_type === "borrador" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
              <div className="flex flex-wrap justify-between gap-3">
                <div><h2 className="text-lg font-bold">{act.folio}</h2>
                  <p className="mt-1 text-sm text-slate-700">{act.record_type === "borrador" ? "Creación del ejemplo: " : "Aprobación institucional: "}{localDate(act.approved_at || act.created_at)} (Chile)</p>
                </div>
                <span className={`h-fit rounded-full px-3 py-1 text-xs font-bold ${act.record_type === "borrador" ? "bg-amber-200 text-amber-950" : "bg-emerald-100 text-emerald-800"}`}>
                  {act.record_type === "borrador" ? "BORRADOR · SIN VALIDEZ" : "ACTA OFICIAL"}
                </span>
              </div>
              {act.record_type === "borrador" && <p className="mt-3 rounded-lg border border-amber-300 p-3 text-sm font-semibold text-amber-950">Documento ficticio. No existe firma ni aprobación institucional y no habilita cuentas.</p>}
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Institución</dt><dd>{act.institution_name || "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Estado actual</dt><dd>{act.authorization_status}</dd></div>
                <div><dt className="text-xs text-slate-500">Estudiante</dt><dd>{act.student_name || "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Apoderado</dt><dd>{act.guardian_name || "—"} · {act.guardian_relationship || "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Administrador revisor</dt><dd>{act.reviewer_name}</dd></div>
                <div><dt className="text-xs text-slate-500">Método de verificación</dt><dd>{act.verified_method || "No corresponde"}</dd></div>
                <div><dt className="text-xs text-slate-500">Referencia de evidencia</dt><dd className="break-all">{act.evidence_reference || "No corresponde"}</dd></div>
                <div><dt className="text-xs text-slate-500">Versión del documento</dt><dd>{act.document_version || "—"}</dd></div>
              </dl>
              {act.revoked_at && <p className="mt-3 text-xs font-semibold text-red-700">Revocada: {localDate(act.revoked_at)}. Se conserva el registro histórico.</p>}
              {act.notes && <p className="mt-3 text-xs text-amber-900">{act.notes}</p>}
            </article>
          )}
        </div>
      </section>
    </div>
  </main>
}
