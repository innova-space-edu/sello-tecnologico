import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import ComentariosSection from './ComentariosSection'

const statusColor: Record<string, string> = {
  'Borrador': 'bg-gray-100 text-gray-600',
  'En progreso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-yellow-100 text-yellow-700',
  'Aprobado': 'bg-green-100 text-green-700',
  'Cerrado': 'bg-red-100 text-red-600',
}

const etapaColor: Record<string, string> = {
  inicial: 'bg-yellow-100 text-yellow-700',
  intermedia: 'bg-blue-100 text-blue-700',
  final: 'bg-green-100 text-green-700',
}

const typeIcon: Record<string, string> = {
  'documento': '📄', 'foto': '🖼️', 'video': '🎥',
  'enlace': '🔗', 'presentación': '📊', 'código': '💻',
}

const Campo = ({ label, value }: { label: string, value?: string | null }) => {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{value}</p>
    </div>
  )
}

const Tags = ({ label, values }: { label: string, values?: string[] | null }) => {
  if (!values?.length) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map(v => (
          <span key={v} className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">{v}</span>
        ))}
      </div>
    </div>
  )
}

export default async function ProyectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: proyecto } = await supabase
    .from('projects').select('*, courses(name)').eq('id', id).single()

  const { data: evidencias } = await supabase
    .from('evidences').select('*, profiles(full_name)')
    .eq('project_id', id).order('created_at', { ascending: false })

  const { data: comentarios } = await supabase
    .from('comments').select('*, profiles(full_name, role)')
    .eq('project_id', id).order('created_at', { ascending: true })

  const { data: { user } } = await supabase.auth.getUser()

  if (!proyecto) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 pt-16 lg:pt-8">
        <p className="text-gray-500">Proyecto no encontrado.</p>
      </main>
    </div>
  )

  const secciones = [
    {
      id: 'B', titulo: 'B. Fundamentación curricular', show: !!(proyecto.objetivos_aprendizaje || proyecto.habilidades?.length || proyecto.vinculacion_pei),
      content: (
        <div className="space-y-4">
          <Campo label="Objetivos de Aprendizaje (OA)" value={proyecto.objetivos_aprendizaje} />
          <Tags label="Habilidades trabajadas" values={proyecto.habilidades} />
          <Campo label="Vinculación con el PEI y sello tecnológico" value={proyecto.vinculacion_pei} />
        </div>
      )
    },
    {
      id: 'C', titulo: 'C. Problema o desafío', show: !!(proyecto.pregunta_guia || proyecto.contexto_problema || proyecto.justificacion),
      content: (
        <div className="space-y-4">
          {proyecto.pregunta_guia && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-500 mb-1">PREGUNTA GUÍA</p>
              <p className="text-blue-800 font-medium">{proyecto.pregunta_guia}</p>
            </div>
          )}
          <Campo label="Contexto del problema" value={proyecto.contexto_problema} />
          <Campo label="Justificación" value={proyecto.justificacion} />
        </div>
      )
    },
    {
      id: 'D', titulo: 'D. Metodología', show: !!(proyecto.metodologia || proyecto.organizacion_trabajo || proyecto.herramientas_tecnologicas?.length),
      content: (
        <div className="space-y-4">
          <Campo label="Metodología utilizada" value={proyecto.metodologia} />
          <Campo label="Organización del trabajo" value={proyecto.organizacion_trabajo} />
          <Tags label="Herramientas tecnológicas" values={proyecto.herramientas_tecnologicas} />
          <Tags label="Materiales físicos" values={proyecto.herramientas_materiales} />
        </div>
      )
    },
    {
      id: 'E', titulo: 'E. Tecnología e IA', show: !!(proyecto.uso_ia?.length || proyecto.estrategia_verificacion),
      content: (
        <div className="space-y-4">
          <Tags label="Uso de IA" values={proyecto.uso_ia} />
          <Campo label="Estrategias de verificación y uso ético" value={proyecto.estrategia_verificacion} />
        </div>
      )
    },
    {
      id: 'G', titulo: 'G. Evaluación', show: !!(proyecto.instrumento_evaluacion?.length || proyecto.criterios_evaluados?.length || proyecto.autoevaluacion),
      content: (
        <div className="space-y-4">
          <Tags label="Instrumentos de evaluación" values={proyecto.instrumento_evaluacion} />
          <Tags label="Criterios evaluados" values={proyecto.criterios_evaluados} />
          <Campo label="Autoevaluación / Coevaluación" value={proyecto.autoevaluacion} />
        </div>
      )
    },
    {
      id: 'H', titulo: 'H. Reflexión final', show: !!(proyecto.aprendizajes_logrados || proyecto.dificultades || proyecto.mejoras || proyecto.impacto_comunidad),
      content: (
        <div className="space-y-4">
          <Campo label="Aprendizajes logrados" value={proyecto.aprendizajes_logrados} />
          <Campo label="Dificultades encontradas" value={proyecto.dificultades} />
          <Campo label="Mejoras para futuras versiones" value={proyecto.mejoras} />
          <Campo label="Impacto en la comunidad" value={proyecto.impacto_comunidad} />
        </div>
      )
    },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/proyectos" className="text-blue-600 text-sm hover:underline">← Volver a Proyectos</Link>
          <div className="flex justify-between items-start mt-3 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-blue-900">{proyecto.title}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[proyecto.status]}`}>
                  {proyecto.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {proyecto.courses?.name && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">📚 {proyecto.courses.name}</span>
                )}
                {proyecto.tipo_proyecto?.map((t: string) => (
                  <span key={t} className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">{t}</span>
                ))}
                {proyecto.semestre && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    {proyecto.semestre === 'anual' ? 'Anual' : `${proyecto.semestre}° Semestre`}
                  </span>
                )}
              </div>
            </div>
            <Link href={`/evidencias/nueva?proyecto=${proyecto.id}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm shrink-0">
              + Nueva evidencia
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* A — Identificación */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-blue-900 mb-4 pb-2 border-b border-gray-100">A. Identificación</h2>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                {proyecto.asignaturas?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Asignaturas</p>
                    <p className="text-gray-700">{proyecto.asignaturas.join(', ')}</p>
                  </div>
                )}
                {proyecto.docentes_responsables?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Docentes responsables</p>
                    <p className="text-gray-700">{proyecto.docentes_responsables.join(', ')}</p>
                  </div>
                )}
                {proyecto.start_date && (
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Inicio</p>
                    <p className="text-gray-700">{proyecto.start_date}</p>
                  </div>
                )}
                {proyecto.end_date && (
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Término</p>
                    <p className="text-gray-700">{proyecto.end_date}</p>
                  </div>
                )}
              </div>
              {proyecto.description && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Descripción del producto</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{proyecto.description}</p>
                </div>
              )}
            </div>

            {/* Secciones B→H dinámicas */}
            {secciones.filter(s => s.show).map(s => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-blue-900 mb-4 pb-2 border-b border-gray-100">{s.titulo}</h2>
                {s.content}
              </div>
            ))}

            {/* F — Evidencias */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-bold text-blue-900">F. Evidencias ({evidencias?.length ?? 0})</h2>
              </div>
              {evidencias && evidencias.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {evidencias.map(ev => (
                    <Link key={ev.id} href={`/evidencias/${ev.id}`}
                      className="flex items-start gap-4 px-6 py-4 hover:bg-blue-50 transition-colors">
                      <div className="text-2xl shrink-0">
                        {ev.file_type?.startsWith('image/') ? '🖼️' :
                         ev.file_type?.startsWith('video/') ? '🎥' :
                         typeIcon[ev.type] ?? '📎'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{ev.title}</p>
                        {ev.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.description}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {ev.evidencia_tipo && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${etapaColor[ev.evidencia_tipo] ?? 'bg-gray-100'}`}>
                              {ev.evidencia_tipo}
                            </span>
                          )}
                          {ev.tags?.map((t: string) => (
                            <span key={t} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                          {ev.file_url && <span className="text-xs text-green-600">📁 Archivo subido</span>}
                          {ev.drive_url && <span className="text-xs text-blue-600">🔗 Drive</span>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 text-right shrink-0">
                        <p>{ev.profiles?.full_name ?? '—'}</p>
                        <p>{new Date(ev.created_at).toLocaleDateString('es-CL')}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-gray-400">
                  <div className="text-3xl mb-2">📎</div>
                  <p>No hay evidencias aún</p>
                  <Link href={`/evidencias/nueva?proyecto=${proyecto.id}`}
                    className="inline-block mt-3 text-blue-600 text-sm hover:underline">
                    + Subir primera evidencia
                  </Link>
                </div>
              )}
            </div>

            {/* Comentarios */}
            <ComentariosSection
              proyectoId={proyecto.id}
              comentarios={comentarios ?? []}
              userId={user?.id ?? ''}
            />
          </div>

          {/* Panel lateral */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-blue-900 mb-3">Detalles</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Estado</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[proyecto.status]}`}>{proyecto.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Curso</span>
                  <span className="text-gray-700">{proyecto.courses?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Semestre</span>
                  <span className="text-gray-700">{proyecto.semestre ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Organización</span>
                  <span className="text-gray-700">{proyecto.organizacion_trabajo ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Evidencias</span>
                  <span className="text-gray-700">{evidencias?.length ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Tipo de producto */}
            {proyecto.tipo_producto?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-blue-900 mb-3">Producto final</h3>
                <div className="flex flex-wrap gap-1.5">
                  {proyecto.tipo_producto.map((t: string) => (
                    <span key={t} className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Habilidades */}
            {proyecto.habilidades?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-blue-900 mb-3">Habilidades</h3>
                <div className="flex flex-wrap gap-1.5">
                  {proyecto.habilidades.map((h: string) => (
                    <span key={h} className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">{h}</span>
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
