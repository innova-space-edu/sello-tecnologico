'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const typeIcon: Record<string, string> = {
  'documento': '📄', 'foto': '🖼️', 'video': '🎥',
  'enlace': '🔗', 'presentación': '📊', 'código': '💻',
}

const etapaColor: Record<string, string> = {
  inicial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  intermedia: 'bg-blue-100 text-blue-700 border-blue-200',
  final: 'bg-green-100 text-green-700 border-green-200',
}
const etapaIcon: Record<string, string> = {
  inicial: '🟡', intermedia: '🔵', final: '🟢',
}

function formatSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{value}</p>
    </div>
  )
}

export default function EvidenciaDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [ev, setEv] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [rol, setRol] = useState('')
  const [imgError, setImgError] = useState(false)
  const [videoError, setVideoError] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRol(perfil?.role ?? '')
      setUserId(user.id)

      const { data } = await supabase
        .from('evidences')
        .select(`
          *,
          projects(id, title, courses(name), project_groups(id, group_name)),
          profiles!evidences_created_by_fkey(id, full_name, email, curso, rut)
        `)
        .eq('id', id)
        .single()

      setEv(data)
      setLoading(false)
    }
    init()
  }, [id])

  const handleDelete = async () => {
    if (!ev) return
    if (!confirm(`¿Eliminar la evidencia "${ev.title}"?`)) return
    await supabase.from('evidences').delete().eq('id', ev.id)
    router.push('/evidencias')
  }

  const handleDownload = async () => {
    if (!ev?.file_url) return
    try {
      const response = await fetch(ev.file_url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = ev.file_name || 'archivo'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(ev.file_url, '_blank')
    }
  }

  const esAdmin = ['admin', 'docente', 'coordinador'].includes(rol)
  const esPropietario = ev?.created_by === userId

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-8 pt-16 lg:pt-8 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Cargando evidencia...</p>
      </main>
    </div>
  )

  if (!ev) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-8 pt-16 lg:pt-8">
        <p className="text-gray-500">Evidencia no encontrada.</p>
        <Link href="/evidencias" className="text-blue-600 text-sm hover:underline mt-2 inline-block">← Volver a evidencias</Link>
      </main>
    </div>
  )

  const isImage = ev.file_type?.startsWith('image/')
  const isVideo = ev.file_type?.startsWith('video/')
  const isPDF = ev.file_type === 'application/pdf' || ev.file_name?.endsWith('.pdf')
  const proyecto = ev.projects
  const uploader = ev.profiles
  const curso = proyecto?.courses?.name
  const grupo = proyecto?.project_groups?.group_name

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6">
          <Link href="/evidencias" className="text-blue-600 hover:underline">← Evidencias</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-500 truncate">{ev.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">

          {/* ── Columna principal ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Header de la evidencia */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="text-4xl">{typeIcon[ev.type] ?? '📎'}</div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-800">{ev.title}</h1>
                    {ev.description && (
                      <p className="text-sm text-gray-500 mt-1">{ev.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ev.evidencia_tipo && (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${etapaColor[ev.evidencia_tipo] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo.charAt(0).toUpperCase() + ev.evidencia_tipo.slice(1)}
                        </span>
                      )}
                      <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        {ev.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        📅 {new Date(ev.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    {ev.tags && ev.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ev.tags.map((tag: string) => (
                          <span key={tag} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 shrink-0">
                  {(esPropietario || esAdmin) && (
                    <Link href={`/evidencias/${ev.id}/editar`}
                      className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors font-medium">
                      ✏️ Editar
                    </Link>
                  )}
                  {(esPropietario || esAdmin) && (
                    <button onClick={handleDelete}
                      className="text-sm bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors font-medium">
                      🗑️ Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Visor de archivo ── */}
            {ev.file_url && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-blue-900">📁 Archivo adjunto</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                      ⬇️ Descargar
                    </button>
                    <a
                      href={ev.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                      🔗 Abrir
                    </a>
                  </div>
                </div>

                <div className="p-4">
                  {/* Imagen */}
                  {isImage && !imgError && (
                    <div className="flex items-center justify-center bg-gray-50 rounded-xl p-4 min-h-48">
                      <img
                        src={ev.file_url}
                        alt={ev.title}
                        className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                        onError={() => setImgError(true)}
                      />
                    </div>
                  )}
                  {isImage && imgError && (
                    <div className="bg-red-50 rounded-xl p-6 text-center">
                      <div className="text-4xl mb-2">🖼️</div>
                      <p className="text-sm text-red-500 font-medium">No se pudo cargar la imagen</p>
                      <a href={ev.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block">Abrir en nueva pestaña</a>
                    </div>
                  )}

                  {/* Video */}
                  {isVideo && !videoError && (
                    <video
                      src={ev.file_url}
                      controls
                      className="w-full max-h-[60vh] rounded-xl bg-black"
                      onError={() => setVideoError(true)}
                    />
                  )}
                  {isVideo && videoError && (
                    <div className="bg-gray-50 rounded-xl p-6 text-center">
                      <div className="text-4xl mb-2">🎥</div>
                      <p className="text-sm text-gray-500 font-medium">No se pudo reproducir el video</p>
                      <a href={ev.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block">Abrir en nueva pestaña</a>
                    </div>
                  )}

                  {/* PDF embed */}
                  {isPDF && (
                    <div className="rounded-xl overflow-hidden border border-gray-200">
                      <iframe
                        src={ev.file_url}
                        className="w-full h-[70vh]"
                        title={ev.title}
                      />
                    </div>
                  )}

                  {/* Otros archivos */}
                  {!isImage && !isVideo && !isPDF && (
                    <div className="bg-gray-50 rounded-xl p-8 text-center">
                      <div className="text-5xl mb-3">
                        {ev.file_name?.match(/\.(ppt|pptx)$/) ? '📊' :
                         ev.file_name?.match(/\.(doc|docx)$/) ? '📝' :
                         ev.file_name?.match(/\.(py|js|ts|html|css|json)$/) ? '💻' :
                         ev.file_name?.match(/\.zip$/) ? '🗜️' : '📎'}
                      </div>
                      <p className="font-semibold text-gray-700">{ev.file_name}</p>
                      {ev.file_size && <p className="text-xs text-gray-400 mt-1">{formatSize(ev.file_size)}</p>}
                      <p className="text-xs text-gray-400 mt-3">Vista previa no disponible para este tipo de archivo</p>
                    </div>
                  )}

                  {/* Nombre y tamaño del archivo */}
                  {(ev.file_name || ev.file_size) && (
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-400 px-1">
                      <span>📄 {ev.file_name}</span>
                      {ev.file_size > 0 && <span>· {formatSize(ev.file_size)}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Link de Drive */}
            {ev.drive_url && (
              <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-3">
                <div className="text-2xl">🔗</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Enlace de Google Drive</p>
                  <a href={ev.drive_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline break-all">{ev.drive_url}</a>
                </div>
                <a href={ev.drive_url} target="_blank" rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0">
                  Abrir ↗
                </a>
              </div>
            )}

            {/* Reflexión de aprendizaje */}
            {(ev.reflexion_aprendizaje || ev.dificultad || ev.como_resolvi || ev.herramienta_usada || ev.uso_ia) && (
              <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-blue-900 border-b pb-2 mb-4">💭 Reflexión de aprendizaje</h2>
                <Campo label="¿Qué aprendí con esta evidencia?" value={ev.reflexion_aprendizaje} />
                <Campo label="¿Qué fue lo más difícil?" value={ev.dificultad} />
                <Campo label="¿Cómo resolví el problema?" value={ev.como_resolvi} />
                <Campo label="Herramienta tecnológica utilizada" value={ev.herramienta_usada} />
                <Campo label="Uso de IA" value={ev.uso_ia} />
              </div>
            )}
          </div>

          {/* ── Panel lateral ── */}
          <div className="space-y-4">

            {/* Quién subió */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-blue-900 mb-3 text-sm uppercase tracking-wide">👤 Subido por</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-base shrink-0">
                  {uploader?.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">{uploader?.full_name ?? uploader?.email ?? 'Desconocido'}</p>
                  {uploader?.curso && <p className="text-xs text-gray-400">{uploader.curso}</p>}
                  {uploader?.rut && <p className="text-xs text-gray-400">RUT: {uploader.rut}</p>}
                </div>
              </div>
            </div>

            {/* Proyecto y grupo */}
            {proyecto && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-blue-900 mb-3 text-sm uppercase tracking-wide">📌 Proyecto</h3>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-xs text-gray-400">Proyecto</p>
                    <Link href={`/proyectos/${proyecto.id}`}
                      className="text-sm font-semibold text-blue-700 hover:underline">
                      {proyecto.title}
                    </Link>
                  </div>
                  {curso && (
                    <div>
                      <p className="text-xs text-gray-400">Curso</p>
                      <p className="text-sm font-medium text-gray-700">📚 {curso}</p>
                    </div>
                  )}
                  {grupo && (
                    <div>
                      <p className="text-xs text-gray-400">Grupo</p>
                      <p className="text-sm font-medium text-gray-700">👥 {grupo}</p>
                    </div>
                  )}
                  {!curso && !grupo && (
                    <p className="text-xs text-gray-400 italic">Sin curso ni grupo asignado</p>
                  )}
                </div>
              </div>
            )}

            {/* Metadatos */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-blue-900 mb-3 text-sm uppercase tracking-wide">📋 Detalles</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tipo</span>
                  <span className="font-medium text-gray-700">{ev.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Etapa</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${etapaColor[ev.evidencia_tipo] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Creada</span>
                  <span className="font-medium text-gray-700 text-xs">
                    {new Date(ev.created_at).toLocaleDateString('es-CL')}
                  </span>
                </div>
                {ev.file_size > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tamaño</span>
                    <span className="font-medium text-gray-700">{formatSize(ev.file_size)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {ev.tags && ev.tags.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-blue-900 mb-3 text-sm uppercase tracking-wide">🏷️ Etiquetas</h3>
                <div className="flex flex-wrap gap-1.5">
                  {ev.tags.map((tag: string) => (
                    <span key={tag} className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">{tag}</span>
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
