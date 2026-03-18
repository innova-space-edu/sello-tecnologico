'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DistribuirProyecto({
  proyectoId,
  courseId,
  courseName,
  totalMiembros,
  yaDistribuido,
  copias,
}: {
  proyectoId: string
  courseId: string | null
  courseName: string | null
  totalMiembros: number
  yaDistribuido: boolean
  copias: { owner_name: string; status: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{
    ok: boolean; creados?: number; total?: number; ya_tenian?: number; mensaje?: string; error?: string
  } | null>(null)

  if (!courseId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
        ⚠️ Asigna un <strong>curso</strong> al proyecto antes de distribuirlo.
      </div>
    )
  }

  const handleDistribuir = async () => {
    setLoading(true)
    setResultado(null)
    const res = await fetch('/api/distribuir-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proyectoId }),
    })
    const data = await res.json()
    setLoading(false)
    setResultado(data)
    if (data.ok) setTimeout(() => router.refresh(), 800)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-blue-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-blue-900">📤 Distribuir al curso</h3>
        {yaDistribuido && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            ✓ Distribuido
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Cada estudiante de <strong>{courseName}</strong> recibirá su propia copia del proyecto
        con todos los datos precargados para que la complete.
      </p>

      {/* Resumen de copias existentes */}
      {copias.length > 0 && (
        <div className="mb-4">
          <button onClick={() => setOpen(v => !v)}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            {open ? '▼' : '▶'} Ver copias distribuidas ({copias.length} / {totalMiembros})
          </button>
          {open && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {copias.map((c, i) => (
                <div key={i} className="flex justify-between items-center text-xs px-3 py-1.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">🎓 {c.owner_name}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    c.status === 'Aprobado' ? 'bg-green-100 text-green-700' :
                    c.status === 'En progreso' ? 'bg-blue-100 text-blue-700' :
                    c.status === 'En revisión' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="bg-blue-50 rounded-lg p-2">
          <p className="text-lg font-bold text-blue-700">{totalMiembros}</p>
          <p className="text-xs text-blue-500">En el curso</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-lg font-bold text-green-700">{copias.length}</p>
          <p className="text-xs text-green-500">Con copia</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-2">
          <p className="text-lg font-bold text-orange-600">{Math.max(0, totalMiembros - copias.length)}</p>
          <p className="text-xs text-orange-400">Sin copia</p>
        </div>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className={`text-xs rounded-lg px-3 py-2.5 mb-3 border ${
          resultado.ok
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {resultado.ok
            ? resultado.creados === 0
              ? resultado.mensaje
              : `✅ Se crearon ${resultado.creados} copias nuevas. ${resultado.ya_tenian ? `${resultado.ya_tenian} ya tenían su copia.` : ''}`
            : `⚠️ ${resultado.error}`}
        </div>
      )}

      <button
        onClick={handleDistribuir}
        disabled={loading || totalMiembros === 0}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-40">
        {loading
          ? 'Distribuyendo...'
          : yaDistribuido
          ? '🔄 Redistribuir (nuevos estudiantes)'
          : `📤 Distribuir a ${totalMiembros} estudiantes`}
      </button>

      {yaDistribuido && (
        <p className="text-xs text-gray-400 text-center mt-2">
          Redistribuir solo crea copias para estudiantes que aún no tienen una.
        </p>
      )}
    </div>
  )
}
