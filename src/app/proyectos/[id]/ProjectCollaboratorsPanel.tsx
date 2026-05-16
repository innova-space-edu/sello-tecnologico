'use client'

import { useEffect, useMemo, useState } from 'react'

type Profile = {
  id: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  curso?: string | null
}

type Collaborator = {
  id: string
  user_id: string
  role: 'editor' | 'viewer'
  status: string
  profile?: Profile | null
}

export default function ProjectCollaboratorsPanel({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [owner, setOwner] = useState<Profile | null>(null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [classmates, setClassmates] = useState<Profile[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/classmates`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar la colaboración')
      setCanManage(Boolean(json.canManage))
      setOwner(json.owner ?? null)
      setCollaborators(json.collaborators ?? [])
      setClassmates(json.classmates ?? [])
    } catch (err: any) {
      setError(err.message ?? 'Error al cargar compañeros')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [projectId])

  const selectedCount = selected.length
  const allSelected = useMemo(() => classmates.length > 0 && selected.length === classmates.length, [classmates, selected])

  const toggleSelected = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  const toggleAll = () => {
    setSelected(allSelected ? [] : classmates.map(c => c.id))
  }

  const addSelected = async () => {
    if (!selected.length) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/classmates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selected, role: 'editor' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo agregar a los compañeros')
      setMessage(`✅ Se agregaron ${json.added ?? selected.length} compañero(s) al proyecto compartido.`)
      setSelected([])
      await fetchData()
    } catch (err: any) {
      setError(err.message ?? 'Error al agregar compañeros')
    } finally {
      setSaving(false)
    }
  }

  const removeCollaborator = async (userId: string, name?: string | null) => {
    if (!confirm(`¿Quitar a ${name ?? 'este usuario'} del proyecto compartido?`)) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/classmates?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo quitar al colaborador')
      setMessage('✅ Colaborador quitado del proyecto.')
      await fetchData()
    } catch (err: any) {
      setError(err.message ?? 'Error al quitar colaborador')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">👥 Equipo colaborativo</h2>
          <p className="text-sm text-gray-500 mt-1">
            Los compañeros agregados entran al mismo proyecto, editan el mismo contenido y ven los cambios sincronizados.
          </p>
        </div>
        <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full">
          {1 + collaborators.filter(c => c.status === 'accepted').length} participante(s)
        </span>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-gray-400">Cargando equipo...</div>
      ) : (
        <>
          {error && <div className="mt-4 text-sm bg-red-50 text-red-600 border border-red-100 rounded-lg p-3">{error}</div>}
          {message && <div className="mt-4 text-sm bg-green-50 text-green-700 border border-green-100 rounded-lg p-3">{message}</div>}

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm mb-3">Participantes actuales</h3>
              <div className="space-y-2">
                {owner && (
                  <div className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{owner.full_name ?? owner.email ?? 'Creador del proyecto'}</p>
                      <p className="text-xs text-gray-400">Creador/a · {owner.email ?? 'sin correo'}</p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Owner</span>
                  </div>
                )}
                {collaborators.length === 0 && (
                  <p className="text-sm text-gray-400 bg-white rounded-lg border border-dashed border-gray-200 p-3">
                    Aún no hay compañeros agregados.
                  </p>
                )}
                {collaborators.map(c => (
                  <div key={c.user_id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.profile?.full_name ?? c.profile?.email ?? 'Usuario'}</p>
                      <p className="text-xs text-gray-400 truncate">Editor/a · {c.profile?.email ?? 'sin correo'}</p>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => removeCollaborator(c.user_id, c.profile?.full_name)}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/40">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-blue-900 text-sm">Agregar compañeros del curso</h3>
                {canManage && classmates.length > 0 && (
                  <button type="button" onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
                    {allSelected ? 'Deseleccionar' : 'Seleccionar todos'}
                  </button>
                )}
              </div>

              {!canManage ? (
                <p className="text-sm text-gray-500 bg-white rounded-lg border border-gray-100 p-3">
                  Solo el creador del proyecto, docentes, coordinadores o administradores pueden agregar integrantes.
                </p>
              ) : classmates.length === 0 ? (
                <p className="text-sm text-gray-500 bg-white rounded-lg border border-gray-100 p-3">
                  No hay compañeros disponibles para agregar o el proyecto no tiene curso asignado.
                </p>
              ) : (
                <>
                  <div className="max-h-64 overflow-auto space-y-2 pr-1">
                    {classmates.map(c => (
                      <label key={c.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2 cursor-pointer hover:border-blue-200 transition-colors">
                        <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelected(c.id)} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{c.full_name ?? c.email ?? 'Usuario'}</p>
                          <p className="text-xs text-gray-400 truncate">{c.email ?? 'sin correo'} {c.curso ? `· ${c.curso}` : ''}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={saving || selectedCount === 0}
                    onClick={addSelected}
                    className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
                  >
                    {saving ? 'Agregando...' : `Agregar ${selectedCount || ''} compañero(s)`}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
