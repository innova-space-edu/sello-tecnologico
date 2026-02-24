'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

const etapaColor: Record<string, string> = {
  inicial: 'bg-yellow-100 text-yellow-700',
  intermedia: 'bg-blue-100 text-blue-700',
  final: 'bg-green-100 text-green-700',
}

const etapaIcon: Record<string, string> = {
  inicial: '🟡', intermedia: '🔵', final: '🟢',
}

export default function EvidenciaDetallePage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [ev, setEv] = useState<any>(null)
  const [proyecto, setProyecto] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('evidences')
        .select('*, profiles(full_name, email)')
        .eq('id', id)
        .single()
      setEv(data)
      if (data?.project_id) {
        const { data: p } = await supabase
          .from('projects').select('id, title').eq('id', data.project_id).single()
        setProyecto(p)
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta evidencia?')) return

    // Eliminar archivo del storage si existe
    if (ev?.file_url) {
      const path = ev.file_url.split('/evidencias/')[1]
      if (path) await supabase.storage.from('evidencias').remove([path])
    }

    await supabase.from('evidences').delete().eq('id', id)
    router.push('/evidencias')
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-8 pt-16 lg:pt-8 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </main>
    </div>
  )

  if (!ev) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-8 pt-16 lg:pt-8">
        <p className="text-gray-500">Evidencia no encontrada.</p>
      </main>
    </div>
  )

  const isImage = ev.file_type?.startsWith('image/')
  const isVideo = ev.file_type?.startsWith('video/')
  const isPdf = ev.file_type === 'application/pdf'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.push('/evidencias')} className="text-blue-600 text-sm hover:underline">← Volver a Evidencias</button>
          <div className="flex justify-between items-start mt-3">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">{ev.title}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {ev.evidencia_tipo && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${etapaColor[ev.evidencia_tipo]}`}>
                    {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo}
                  </span>
                )}
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{ev.type}</span>
                {proyecto && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                    🗂️ {proyecto.title}
                  </span>
                )}
              </div>
            </div>
            <button onClick={handleDelete}
              className="text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm">
              🗑️ Eliminar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-6">

            {/* Preview del archivo */}
            {ev.file_url && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-blue-900">📁 Archivo</h2>
                </div>
                <div className="p-5">
                  {isImage && (
                    <img src={ev.file_url} alt={ev.title}
                      className="w-full max-h-96 object-contain rounded-lg bg-gray-50" />
                  )}
                  {isVideo && (
                    <video src={ev.file_url} controls
                      className="w-full max-h-96 rounded-lg bg-black" />
                  )}
                  {isPdf && (
                    <iframe src={ev.file_url} className="w-full h-96 rounded-lg border border-gray-200" />
                  )}
                  {!isImage && !isVideo && !isPdf && (
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-4xl">
                        {ev.file_name?.endsWith('.pdf') ? '📄' :
                         ev.file_name?.match(/\.(ppt|pptx)$/) ? '📊' :
                         ev.file_name?.match(/\.(doc|docx)$/) ? '📝' :
                         ev.file_name?.match(/\.(py|js|ts|html)$/) ? '💻' : '📎'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{ev.file_name}</p>
                        <p className="text-xs text-gray-400">{formatSize(ev.file_size)}</p>
                      </div>
                    </div>
                  )}
                  <a href={ev.file_url} target="_blank" rel="noopener noreferrer" download
                    className="inline-flex items-center gap-2 mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                    ⬇️ Descargar archivo
                  </a>
                </div>
              </div>
            )}

            {/* Link Drive */}
            {ev.drive_url && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-semibold text-blue-900 mb-3">🔗 Google Drive</h2>
                <a href={ev.drive_url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm break-all">
                  {ev.drive_url}
                </a>
              </div>
            )}

            {/* Descripción */}
            {ev.description && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-semibold text-blue-900 mb-2">📋 Descripción</h2>
                <p className="text-gray-700 text-sm leading-relaxed">{ev.description}</p>
              </div>
            )}

            {/* Reflexión de aprendizaje */}
            {(ev.reflexion_aprendizaje || ev.dificultad || ev.como_resolvi || ev.herramienta_usada || ev.uso_ia) && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-semibold text-blue-900 mb-4">💭 Reflexión de aprendizaje</h2>
                <div className="space-y-4">
                  {ev.reflexion_aprendizaje && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">¿Qué aprendí?</p>
                      <p className="text-gray-700 text-sm leading-relaxed bg-blue-50 rounded-lg p-3">{ev.reflexion_aprendizaje}</p>
                    </div>
                  )}
                  {ev.dificultad && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">¿Qué fue lo más difícil?</p>
                      <p className="text-gray-700 text-sm leading-relaxed bg-orange-50 rounded-lg p-3">{ev.dificultad}</p>
                    </div>
                  )}
                  {ev.como_resolvi && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">¿Cómo resolví el problema?</p>
                      <p className="text-gray-700 text-sm leading-relaxed bg-green-50 rounded-lg p-3">{ev.como_resolvi}</p>
                    </div>
                  )}
                  {ev.herramienta_usada && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Herramienta tecnológica</p>
                      <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-sm px-3 py-1 rounded-full">
                        💻 {ev.herramienta_usada}
                      </span>
                    </div>
                  )}
                  {ev.uso_ia && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Uso de IA</p>
                      <p className="text-gray-700 text-sm leading-relaxed bg-indigo-50 rounded-lg p-3">🤖 {ev.uso_ia}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Columna lateral */}
          <div className="space-y-4">

            {/* Info */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-semibold text-blue-900 mb-3">ℹ️ Detalles</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tipo</span>
                  <span className="font-medium text-gray-800">{ev.type}</span>
                </div>
                {ev.evidencia_tipo && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Etapa</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${etapaColor[ev.evidencia_tipo]}`}>
                      {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo}
                    </span>
                  </div>
                )}
                {proyecto && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Proyecto</span>
                    <span className="font-medium text-blue-700 text-right max-w-32 truncate">{proyecto.title}</span>
                  </div>
                )}
                {ev.file_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Archivo</span>
                    <span className="font-medium text-gray-800 text-right max-w-32 truncate">{ev.file_name}</span>
                  </div>
                )}
                {ev.file_size && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tamaño</span>
                    <span className="font-medium text-gray-800">{formatSize(ev.file_size)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha</span>
                  <span className="font-medium text-gray-800">
                    {new Date(ev.created_at).toLocaleDateString('es-CL')}
                  </span>
                </div>
                {ev.profiles && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Creado por</span>
                    <span className="font-medium text-gray-800 text-right max-w-32 truncate">
                      {ev.profiles.full_name ?? ev.profiles.email}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {ev.tags && ev.tags.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-semibold text-blue-900 mb-3">🏷️ Etiquetas</h2>
                <div className="flex flex-wrap gap-2">
                  {ev.tags.map((tag: string) => (
                    <span key={tag} className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
