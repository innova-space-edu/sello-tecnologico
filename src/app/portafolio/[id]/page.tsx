import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import PortfolioSections from '@/components/PortfolioSections'

const etapaColor: Record<string, string> = {
  inicial: 'bg-yellow-100 text-yellow-700',
  intermedia: 'bg-blue-100 text-blue-700',
  final: 'bg-green-100 text-green-700',
}

const etapaIcon: Record<string, string> = {
  inicial: '🟡', intermedia: '🔵', final: '🟢',
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

export default async function PortafolioEstudiantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: portafolio } = await supabase
    .from('portfolios').select('*, profiles(full_name, email, curso, rut)')
    .eq('id', id).single()

  if (!portafolio) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-8 pt-16 lg:pt-8">
        <p className="text-gray-500">Portafolio no encontrado.</p>
      </main>
    </div>
  )

  const { data: evidencias } = await supabase
    .from('evidences').select('*, projects(title)')
    .eq('created_by', portafolio.user_id)
    .order('created_at', { ascending: true })

  const { data: secciones } = await supabase
    .from('portfolio_sections')
    .select('*')
    .eq('portfolio_id', portafolio.id)
    .order('order_index', { ascending: true })

  const estudiante = portafolio.profiles
  const evInicial = evidencias?.filter(e => e.evidencia_tipo === 'inicial') ?? []
  const evIntermedia = evidencias?.filter(e => e.evidencia_tipo === 'intermedia') ?? []
  const evFinal = evidencias?.filter(e => e.evidencia_tipo === 'final') ?? []

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/portafolio" className="text-blue-600 text-sm hover:underline">← Volver</Link>
          <div className="mt-3 bg-gradient-to-r from-blue-800 to-blue-600 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-3xl font-bold shrink-0">
                {estudiante?.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">📂 {estudiante?.full_name ?? estudiante?.email}</h1>
                <p className="text-blue-200 mt-0.5">Portafolio Tecnológico · {portafolio.year}</p>
                {estudiante?.curso && <p className="text-blue-200 text-sm">{estudiante.curso}</p>}
              </div>
              <div className="flex gap-3 text-center">
                <div className="bg-white bg-opacity-10 rounded-xl px-4 py-2">
                  <div className="text-xl font-bold">{evidencias?.length ?? 0}</div>
                  <div className="text-blue-200 text-xs">Evidencias</div>
                </div>
                <div className="bg-white bg-opacity-10 rounded-xl px-4 py-2">
                  <div className="text-xl font-bold">{secciones?.length ?? 0}</div>
                  <div className="text-blue-200 text-xs">Secciones</div>
                </div>
                <div className="bg-white bg-opacity-10 rounded-xl px-4 py-2">
                  <div className="text-xl font-bold">{evFinal.length}</div>
                  <div className="text-blue-200 text-xs">Finales</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* B — Presentación */}
            {(portafolio.quien_soy || portafolio.que_interesa_aprender || portafolio.que_espero_mejorar) && (
              <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-blue-900 border-b pb-2">B. Presentación personal</h2>
                <Campo label="¿Quién soy?" value={portafolio.quien_soy} />
                <Campo label="¿Qué me interesa aprender?" value={portafolio.que_interesa_aprender} />
                <Campo label="¿Qué espero mejorar este año?" value={portafolio.que_espero_mejorar} />
              </div>
            )}

            {/* C — Evidencias */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-blue-900">C. Evidencias ({evidencias?.length ?? 0})</h2>
              </div>
              {evidencias && evidencias.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {evidencias.map(ev => (
                    <Link key={ev.id} href={`/evidencias/${ev.id}`}
                      className="flex items-start gap-4 px-6 py-4 hover:bg-blue-50 transition-colors">
                      {ev.file_url && ev.file_type?.startsWith('image/') ? (
                        <img src={ev.file_url} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl shrink-0">
                          {ev.file_type?.startsWith('video/') ? '🎥' : '📎'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{ev.title}</p>
                        <p className="text-xs text-gray-400">{ev.projects?.title ?? '—'}</p>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {ev.evidencia_tipo && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${etapaColor[ev.evidencia_tipo]}`}>
                              {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo}
                            </span>
                          )}
                        </div>
                        {ev.reflexion_aprendizaje && (
                          <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">"{ev.reflexion_aprendizaje}"</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 shrink-0">
                        {new Date(ev.created_at).toLocaleDateString('es-CL')}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">Sin evidencias aún</div>
              )}
            </div>

            {/* E — Progreso */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-blue-900 border-b pb-2 mb-4">E. Progreso en el tiempo</h2>
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                  <div className="text-2xl font-bold text-yellow-600">{evInicial.length}</div>
                  <div className="text-xs text-gray-500 mt-1">🟡 Iniciales</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">{evIntermedia.length}</div>
                  <div className="text-xs text-gray-500 mt-1">🔵 Intermedias</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{evFinal.length}</div>
                  <div className="text-xs text-gray-500 mt-1">🟢 Finales</div>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="bg-gradient-to-r from-yellow-400 via-blue-400 to-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((evidencias?.length ?? 0) / 9) * 100)}%` }} />
              </div>
            </div>

            {/* F — Reflexión final */}
            {(portafolio.lo_que_aprendi || portafolio.lo_que_mejore || portafolio.quiero_aprender || portafolio.tecnologia_ayudo) && (
              <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-blue-900 border-b pb-2">F. Reflexión final anual</h2>
                <Campo label="Lo que más aprendí" value={portafolio.lo_que_aprendi} />
                <Campo label="Lo que mejoré" value={portafolio.lo_que_mejore} />
                <Campo label="Lo que quiero aprender el próximo año" value={portafolio.quiero_aprender} />
                <Campo label="Cómo la tecnología me ayudó a aprender mejor" value={portafolio.tecnologia_ayudo} />
              </div>
            )}

            {/* Secciones personalizadas — solo lectura para el docente */}
            {secciones && secciones.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-blue-900 border-b pb-2 mb-4">➕ Secciones personalizadas</h2>
                <PortfolioSections
                  portfolioId={portafolio.id}
                  initialSections={secciones}
                  editable={false}
                />
              </div>
            )}
          </div>

          {/* Panel lateral */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-blue-900 mb-3">A. Información</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nombre</span>
                  <span className="font-medium text-gray-800 text-right max-w-32 truncate">{estudiante?.full_name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Curso</span>
                  <span className="font-medium text-gray-800">{estudiante?.curso ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">RUT</span>
                  <span className="font-medium text-gray-800">{estudiante?.rut ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Año</span>
                  <span className="font-medium text-gray-800">{portafolio.year}</span>
                </div>
                {portafolio.asignaturas?.length > 0 && (
                  <div>
                    <span className="text-gray-400 block mb-1">Asignaturas</span>
                    <span className="text-gray-700 text-xs">{portafolio.asignaturas.join(', ')}</span>
                  </div>
                )}
                {portafolio.docentes?.length > 0 && (
                  <div>
                    <span className="text-gray-400 block mb-1">Docentes</span>
                    <span className="text-gray-700 text-xs">{portafolio.docentes.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Resumen secciones */}
            {secciones && secciones.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-blue-900 mb-3">Secciones personalizadas</h3>
                <div className="space-y-1.5">
                  {secciones.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{s.type === 'texto' ? '📝' : s.type === 'alternativas' ? '☑️' : '🖼️'}</span>
                      <span className="truncate">{s.title}</span>
                    </div>
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
