'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function InvitarProyectoCurso({
  cursoId,
  cursoNombre,
}: {
  cursoId: string
  cursoNombre: string
}) {
  const supabase = createClient()
  const [abierto, setAbierto] = useState(false)
  const [proyectos, setProyectos] = useState<any[]>([])
  const [proyectoId, setProyectoId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProyectos, setLoadingProyectos] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; enviados?: number; copias_nuevas?: number; error?: string } | null>(null)

  // Cargar proyectos del curso al abrir el modal
  useEffect(() => {
    if (!abierto) return
    setLoadingProyectos(true)
    supabase
      .from('projects')
      .select('id, title, status, es_plantilla')
      .eq('course_id', cursoId)
      .eq('es_copia_distribuida', false)  // solo plantillas/originales
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProyectos(data ?? [])
        setLoadingProyectos(false)
      })
  }, [abierto])

  const handleEnviar = async () => {
    if (!proyectoId) return
    setLoading(true)
    setResultado(null)

    const res = await fetch('/api/invitar-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursoId, proyectoId }),
    })
    const data = await res.json()
    setLoading(false)
    setResultado(data)
  }

  const cerrar = () => {
    setAbierto(false)
    setProyectoId('')
    setResultado(null)
  }

  return (
    <>
      {/* Botón en la tarjeta del curso */}
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setAbierto(true) }}
        className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
        title="Enviar invitación de proyecto al curso">
        📨 Invitar
      </button>

      {/* Modal */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={cerrar}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-blue-900">📨 Enviar invitación de proyecto</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Curso: <span className="font-semibold text-gray-700">{cursoNombre}</span>
                </p>
              </div>
              <button onClick={cerrar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            {!resultado ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Selecciona el proyecto que quieres enviar. Cada estudiante del curso recibirá:
                </p>
                <ul className="text-xs text-gray-500 space-y-1 mb-5 pl-4">
                  <li>✅ Su propia copia del proyecto precargada</li>
                  <li>✅ Un mensaje directo con el link a su copia</li>
                  <li>✅ Acceso inmediato para completarla</li>
                </ul>

                {/* Selector de proyecto */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Proyecto a enviar</label>
                  {loadingProyectos ? (
                    <p className="text-xs text-gray-400 animate-pulse py-2">Cargando proyectos...</p>
                  ) : proyectos.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                      ⚠️ No hay proyectos asignados a este curso. Crea uno primero desde{' '}
                      <a href="/proyectos/nuevo" className="underline font-medium">Nuevo proyecto</a>.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {proyectos.map(p => (
                        <label key={p.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            proyectoId === p.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}>
                          <input
                            type="radio"
                            name="proyecto"
                            value={p.id}
                            checked={proyectoId === p.id}
                            onChange={() => setProyectoId(p.id)}
                            className="accent-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                p.status === 'Aprobado' ? 'bg-green-100 text-green-700' :
                                p.status === 'En progreso' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>{p.status}</span>
                              {p.es_plantilla && (
                                <span className="text-xs text-purple-600">📋 Ya distribuido</span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex gap-3 mt-5">
                  <button onClick={cerrar}
                    className="flex-1 border border-gray-300 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={handleEnviar}
                    disabled={!proyectoId || loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40">
                    {loading ? 'Enviando...' : '📨 Enviar al curso'}
                  </button>
                </div>
              </>
            ) : (
              /* Pantalla de resultado */
              <div className="text-center py-4">
                {resultado.ok ? (
                  <>
                    <div className="text-5xl mb-4">🎉</div>
                    <h3 className="text-lg font-bold text-green-700 mb-2">¡Invitación enviada!</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-semibold text-blue-700">{resultado.enviados}</span> estudiantes recibieron el mensaje
                    </p>
                    {(resultado.copias_nuevas ?? 0) > 0 && (
                      <p className="text-xs text-gray-400">
                        {resultado.copias_nuevas} copias nuevas del proyecto creadas
                      </p>
                    )}
                    <button onClick={cerrar}
                      className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                      Cerrar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-4xl mb-3">⚠️</div>
                    <p className="text-sm text-red-600 font-medium mb-1">Error al enviar</p>
                    <p className="text-xs text-gray-500 mb-4">{resultado.error}</p>
                    <button onClick={() => setResultado(null)}
                      className="w-full border border-gray-300 text-gray-600 text-sm py-2 rounded-xl hover:bg-gray-50">
                      Volver a intentar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
