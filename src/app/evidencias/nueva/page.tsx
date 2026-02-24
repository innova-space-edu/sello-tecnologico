'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

const TIPOS = ['documento', 'foto', 'video', 'enlace', 'presentación', 'código']
const ACCEPT = {
  documento: '.pdf,.doc,.docx,.txt',
  foto: 'image/*',
  video: 'video/*',
  presentación: '.ppt,.pptx,.pdf',
  código: '.py,.js,.ts,.html,.css,.json,.zip',
  enlace: '',
}

export default function NuevaEvidenciaPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [proyectos, setProyectos] = useState<any[]>([])
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'documento',
    project_id: '',
    drive_url: '',
    tags: '',
    reflexion_aprendizaje: '',
    dificultad: '',
    como_resolvi: '',
    herramienta_usada: '',
    uso_ia: '',
    evidencia_tipo: 'inicial',
  })

  useEffect(() => {
    supabase.from('projects').select('id, title').order('title')
      .then(({ data }) => setProyectos(data ?? []))
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoSeleccionado(file)

    // Preview para imágenes y videos
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreview(url)
    } else if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const tagsArray = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []

    let file_url = null
    let file_name = null
    let file_type = null
    let file_size = null

    // Subir archivo a Supabase Storage
    if (archivoSeleccionado) {
      const ext = archivoSeleccionado.name.split('.').pop()
      const path = `${user?.id}/${Date.now()}.${ext}`
      setUploadProgress(30)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidencias')
        .upload(path, archivoSeleccionado, { upsert: true })

      if (uploadError) {
        alert('Error al subir archivo: ' + uploadError.message)
        setLoading(false)
        return
      }

      setUploadProgress(70)

      const { data: urlData } = supabase.storage
        .from('evidencias')
        .getPublicUrl(path)

      file_url = urlData.publicUrl
      file_name = archivoSeleccionado.name
      file_type = archivoSeleccionado.type
      file_size = archivoSeleccionado.size
    }

    setUploadProgress(90)

    await supabase.from('evidences').insert({
      title: form.title,
      description: form.description,
      type: form.type,
      project_id: form.project_id || null,
      drive_url: form.drive_url || null,
      tags: tagsArray,
      created_by: user?.id,
      file_url,
      file_name,
      file_type,
      file_size,
      reflexion_aprendizaje: form.reflexion_aprendizaje || null,
      dificultad: form.dificultad || null,
      como_resolvi: form.como_resolvi || null,
      herramienta_usada: form.herramienta_usada || null,
      uso_ia: form.uso_ia || null,
      evidencia_tipo: form.evidencia_tipo,
    })

    setUploadProgress(100)
    router.push('/evidencias')
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-8">
          <button onClick={() => router.push('/evidencias')} className="text-blue-600 text-sm hover:underline">← Volver</button>
          <h1 className="text-2xl font-bold text-blue-900 mt-2">Nueva Evidencia</h1>
          <p className="text-gray-500 mt-1">Sube archivos, imágenes o videos como evidencia de aprendizaje</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

          {/* Sección básica */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-blue-900 mb-4">📋 Información básica</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Nombre de la evidencia"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Etapa</label>
                  <select value={form.evidencia_tipo} onChange={e => setForm({...form, evidencia_tipo: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="inicial">🟡 Inicial</option>
                    <option value="intermedia">🔵 Intermedia</option>
                    <option value="final">🟢 Final</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                  <select value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Sin proyecto</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  rows={2} placeholder="Describe brevemente esta evidencia..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
                <input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})}
                  placeholder="robótica, diseño, prototipo (separadas por coma)"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          </div>

          {/* Subida de archivo */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-blue-900 mb-4">📁 Archivo</h2>

            {/* Zona de subida */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
              {archivoSeleccionado ? (
                <div>
                  {/* Preview imagen */}
                  {preview && archivoSeleccionado.type.startsWith('image/') && (
                    <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg mb-3 object-contain" />
                  )}
                  {/* Preview video */}
                  {preview && archivoSeleccionado.type.startsWith('video/') && (
                    <video src={preview} controls className="max-h-48 mx-auto rounded-lg mb-3 w-full" />
                  )}
                  {/* Ícono para otros archivos */}
                  {!preview && (
                    <div className="text-5xl mb-3">
                      {archivoSeleccionado.name.endsWith('.pdf') ? '📄' :
                       archivoSeleccionado.name.match(/\.(ppt|pptx)$/) ? '📊' :
                       archivoSeleccionado.name.match(/\.(doc|docx)$/) ? '📝' :
                       archivoSeleccionado.name.match(/\.(py|js|ts|html)$/) ? '💻' : '📎'}
                    </div>
                  )}
                  <p className="font-medium text-gray-800 text-sm">{archivoSeleccionado.name}</p>
                  <p className="text-gray-400 text-xs mt-1">{formatSize(archivoSeleccionado.size)}</p>
                  <p className="text-blue-500 text-xs mt-2">Clic para cambiar archivo</p>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-3">☁️</div>
                  <p className="font-medium text-gray-700">Arrastra o haz clic para subir</p>
                  <p className="text-gray-400 text-xs mt-1">Imágenes, videos, PDF, documentos, código — máx. 50MB</p>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.py,.js,.ts,.html,.css,.json,.zip,.txt"
              onChange={handleFileChange}
            />

            {/* O link de Drive */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                O pega un link de Google Drive
              </label>
              <input value={form.drive_url} onChange={e => setForm({...form, drive_url: e.target.value})}
                placeholder="https://drive.google.com/..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>

          {/* Reflexión */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-blue-900 mb-1">💭 Reflexión de aprendizaje</h2>
            <p className="text-gray-400 text-xs mb-4">Opcional — para el portafolio del estudiante</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">¿Qué aprendí con esta evidencia?</label>
                <textarea value={form.reflexion_aprendizaje} onChange={e => setForm({...form, reflexion_aprendizaje: e.target.value})}
                  rows={2} placeholder="Describe tu aprendizaje..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">¿Qué fue lo más difícil?</label>
                  <textarea value={form.dificultad} onChange={e => setForm({...form, dificultad: e.target.value})}
                    rows={2} placeholder="Describe la dificultad..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">¿Cómo resolví el problema?</label>
                  <textarea value={form.como_resolvi} onChange={e => setForm({...form, como_resolvi: e.target.value})}
                    rows={2} placeholder="Describe tu solución..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Herramienta tecnológica utilizada</label>
                  <input value={form.herramienta_usada} onChange={e => setForm({...form, herramienta_usada: e.target.value})}
                    placeholder="Ej: Arduino, Scratch, Python..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">¿Usé IA? ¿Cómo y para qué?</label>
                  <input value={form.uso_ia} onChange={e => setForm({...form, uso_ia: e.target.value})}
                    placeholder="Ej: Usé ChatGPT para generar ideas..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          {loading && uploadProgress > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Subiendo archivo...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : '💾 Guardar evidencia'}
            </button>
            <button type="button" onClick={() => router.push('/evidencias')}
              className="border border-gray-300 text-gray-600 px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
