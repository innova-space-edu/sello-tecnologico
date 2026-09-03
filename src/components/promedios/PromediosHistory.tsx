'use client'

import { useState } from 'react'

type Version = {
  id: string
  version_no: number
  created_at: string
  profiles?: { full_name?: string | null } | null
}

export default function PromediosHistory({ workbookId }: { workbookId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [versions, setVersions] = useState<Version[]>([])
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/promedios/${workbookId}/versions`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el historial')
      setVersions(payload.versions ?? [])
      setOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial')
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const restore = async (version: Version) => {
    if (!confirm(`¿Restaurar la versión ${version.version_no}? La versión actual se respaldará antes de restaurar.`)) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/promedios/${workbookId}/versions/${version.id}/restore`, {
        method: 'POST',
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo restaurar la versión')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restaurar la versión')
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={load} disabled={loading} className="fixed bottom-5 right-5 z-[80] rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-xl hover:bg-slate-800 disabled:opacity-60">
        {loading && !open ? 'Cargando…' : '🕘 Historial'}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={() => setOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">Historial de versiones</h2>
                <p className="mt-1 text-xs text-slate-500">Copias anteriores almacenadas en el bucket privado de Supabase.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-xl text-slate-500 hover:bg-slate-100">×</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
              {versions.length === 0 && !error ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aún no hay versiones anteriores. Se crearán al guardar cambios desde el editor.</div>
              ) : (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                      <div>
                        <div className="font-black text-slate-900">Versión {version.version_no}</div>
                        <div className="mt-1 text-xs text-slate-500">{new Date(version.created_at).toLocaleString('es-CL')} · {version.profiles?.full_name || 'Usuario autorizado'}</div>
                      </div>
                      <button onClick={() => restore(version)} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Restaurar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
