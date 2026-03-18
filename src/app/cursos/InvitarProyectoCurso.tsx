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
  const [resultado, setResultado] = useState<{
    ok: boolean; enviados?: number; ya_invitados?: number; mensaje?: string; error?: string
  } | null>(null)

  useEffect(() => {
    if (!abierto) return
    setLoadingProyectos(true)
    setProyectoId('')
    setResultado(null)

    // Cargar TODOS los proyectos (no filtrar por course_id — el admin puede enviar cualquier proyecto)
    supabase
      .from('projects')
      .select('id, title, status, courses(name)')
      .eq('es_copia_distribuida', false)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          // Si falla el filtro (columna no existe), cargar todos sin filtro
          supabase.from('projects')
            .select('id, title, status, courses(name)')
            .order('created_at', { ascending: false })
            .then(({ data: d2 }) => { setProyectos(d2 ?? []); setLoadingProyectos(false) })
        } else {
          setProyectos(data ?? [])
          setLoadingProyectos(false)
        }
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
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setAbierto(true) }}
        className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
        title="Enviar invitación de proyecto al curso">
        📨 Invitar
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={cerrar}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-blue-900">📨 Enviar invitación de proyecto</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Curso: <span className="font-semibold text-gray-700">{cursoNombre}</span>
                </p>
              </div>
              <button onClick={cerrar} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4">✕</button>
            </div>

            {!resultado ? (
              <>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-xs text-blue-700 space-y-1">
                  <p>✅ Cada estudiante recibirá un <strong>mensaje con un link</strong> para aceptar</p>
                  <p>✅ Al aceptar, se crea <strong>su propio proyecto</strong> con los datos precargados</p>
                  <p>✅ Puede editarlo y completarlo a su ritmo</p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecciona el proyecto a enviar
                  </label>

                  {loadingProyectos ? (
                    <p className="text-xs text-gray-400 animate-pulse py-3 text-center">Cargando proyectos...</p>
                  ) : proyectos.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                      <p className="text-sm text-yellow-700 font-medium mb-1">No hay proyectos creados aún</p>
                      <a href="/proyectos/nuevo"
                        className="inline-block mt-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors">
                        + Crear proyecto ahora
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {proyectos.map(p => (
                        <label key={p.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            proyectoId === p.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300 bg-white'
                          }`}>
                          <input
                            type="radio" name="proyecto" value={p.id}
                            checked={proyectoId === p.id}
                            onChange={() => setProyectoId(p.id)}
                            className="accent-blue-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {p.courses?.name && (
                                <span className="text-xs text-gray-400">{p.courses.name}</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                p.status === 'Aprobado' ? 'bg-green-100 text-green-700' :
                                p.status === 'En progreso' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>{p.status}</span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={cerrar}
                    className="flex-1 border border-gray-300 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleEnviar}
                    disabled={!proyectoId || loading || proyectos.length === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40">
                    {loading ? 'Enviando...' : '📨 Enviar invitación'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                {resultado.ok ? (
                  <>
                    <div className="text-5xl mb-3">{resultado.enviados === 0 ? '✅' : '🎉'}</div>
                    <h3 className="text-base font-bold text-green-700 mb-2">
                      {resultado.enviados === 0 ? 'Sin cambios' : '¡Invitaciones enviadas!'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {resultado.enviados === 0
                        ? resultado.mensaje
                        : <><span className="font-semibold text-blue-700">{resultado.enviados}</span> estudiantes recibieron la invitación</>}
                    </p>
                    {(resultado.ya_invitados ?? 0) > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{resultado.ya_invitados} ya tenían invitación activa</p>
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
                      Volver
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
