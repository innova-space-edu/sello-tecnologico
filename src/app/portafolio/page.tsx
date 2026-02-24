'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const etapaColor: Record<string, string> = {
  inicial: 'bg-yellow-100 text-yellow-700',
  intermedia: 'bg-blue-100 text-blue-700',
  final: 'bg-green-100 text-green-700',
}

const etapaIcon: Record<string, string> = {
  inicial: '🟡', intermedia: '🔵', final: '🟢',
}

export default function PortafolioPage() {
  const supabase = createClient()
  const [perfil, setPerfil] = useState<any>(null)
  const [portafolio, setPortafolio] = useState<any>(null)
  const [evidencias, setEvidencias] = useState<any[]>([])
  const [proyectos, setProyectos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    quien_soy: '',
    que_interesa_aprender: '',
    que_espero_mejorar: '',
    asignaturas: '',
    docentes: '',
    reflexion_final: '',
    lo_que_aprendi: '',
    lo_que_mejore: '',
    quiero_aprender: '',
    tecnologia_ayudo: '',
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setPerfil(p)

      // Cargar o crear portafolio del año actual
      const year = new Date().getFullYear()
      let { data: port } = await supabase.from('portfolios')
        .select('*').eq('user_id', user.id).eq('year', year).single()

      if (!port) {
        const { data: nuevo } = await supabase.from('portfolios')
          .insert({ user_id: user.id, year })
          .select().single()
        port = nuevo
      }

      setPortafolio(port)
      if (port) {
        setForm({
          quien_soy: port.quien_soy ?? '',
          que_interesa_aprender: port.que_interesa_aprender ?? '',
          que_espero_mejorar: port.que_espero_mejorar ?? '',
          asignaturas: port.asignaturas?.join(', ') ?? '',
          docentes: port.docentes?.join(', ') ?? '',
          reflexion_final: port.reflexion_final ?? '',
          lo_que_aprendi: port.lo_que_aprendi ?? '',
          lo_que_mejore: port.lo_que_mejore ?? '',
          quiero_aprender: port.quiero_aprender ?? '',
          tecnologia_ayudo: port.tecnologia_ayudo ?? '',
        })
      }

      // Evidencias del estudiante
      const { data: evs } = await supabase
        .from('evidences')
        .select('*, projects(title)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: true })
      setEvidencias(evs ?? [])

      // Proyectos relacionados
      const proyIds = [...new Set((evs ?? []).map(e => e.project_id).filter(Boolean))]
      if (proyIds.length > 0) {
        const { data: proys } = await supabase
          .from('projects').select('id, title, status, tipo_proyecto')
          .in('id', proyIds)
        setProyectos(proys ?? [])
      }

      setLoading(false)
    }
    init()
  }, [])

  const handleSave = async () => {
    if (!portafolio) return
    setSaving(true)
    await supabase.from('portfolios').update({
      quien_soy: form.quien_soy,
      que_interesa_aprender: form.que_interesa_aprender,
      que_espero_mejorar: form.que_espero_mejorar,
      asignaturas: form.asignaturas ? form.asignaturas.split(',').map(s => s.trim()) : [],
      docentes: form.docentes ? form.docentes.split(',').map(s => s.trim()) : [],
      reflexion_final: form.reflexion_final,
      lo_que_aprendi: form.lo_que_aprendi,
      lo_que_mejore: form.lo_que_mejore,
      quiero_aprender: form.quiero_aprender,
      tecnologia_ayudo: form.tecnologia_ayudo,
      updated_at: new Date().toISOString(),
    }).eq('id', portafolio.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  const textareaClass = `${inputClass} resize-none`
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  const evInicial = evidencias.filter(e => e.evidencia_tipo === 'inicial')
  const evIntermedia = evidencias.filter(e => e.evidencia_tipo === 'intermedia')
  const evFinal = evidencias.filter(e => e.evidencia_tipo === 'final')

  const TABS = ['A. Información', 'B. Presentación', 'C. Evidencias', 'D. Reflexiones', 'E. Progreso', 'F. Reflexión final']

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-8 pt-16 lg:pt-8 flex items-center justify-center">
        <p className="text-gray-400">Cargando portafolio...</p>
      </main>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="mb-6 flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">📂 Portafolio Tecnológico</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {perfil?.full_name ?? perfil?.email} · Año {new Date().getFullYear()}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/portafolio/feria"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm">
              🎪 Modo Feria
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : saved ? '✅ Guardado' : '💾 Guardar'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap mb-6">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === i ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-blue-50 border border-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="max-w-3xl space-y-4">

          {/* A — Información */}
          {tab === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">A. Información del estudiante</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase mb-1">Nombre</p>
                  <p className="text-gray-800 font-medium">{perfil?.full_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase mb-1">Curso</p>
                  <p className="text-gray-800 font-medium">{perfil?.curso ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase mb-1">Año</p>
                  <p className="text-gray-800 font-medium">{new Date().getFullYear()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase mb-1">RUT</p>
                  <p className="text-gray-800 font-medium">{perfil?.rut ?? '—'}</p>
                </div>
              </div>
              <div>
                <label className={labelClass}>Asignatura(s)</label>
                <input value={form.asignaturas} onChange={e => setForm({...form, asignaturas: e.target.value})}
                  placeholder="Tecnología, Ciencias... (separadas por coma)"
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Docente(s)</label>
                <input value={form.docentes} onChange={e => setForm({...form, docentes: e.target.value})}
                  placeholder="Nombre docente 1, Nombre docente 2"
                  className={inputClass} />
              </div>
            </div>
          )}

          {/* B — Presentación personal */}
          {tab === 1 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">B. Presentación personal</h2>
              <div>
                <label className={labelClass}>¿Quién soy?</label>
                <textarea value={form.quien_soy} onChange={e => setForm({...form, quien_soy: e.target.value})}
                  rows={4} placeholder="Cuéntate: ¿quién eres?, ¿qué te gusta?, ¿cuáles son tus fortalezas?"
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>¿Qué me interesa aprender?</label>
                <textarea value={form.que_interesa_aprender} onChange={e => setForm({...form, que_interesa_aprender: e.target.value})}
                  rows={3} placeholder="¿Qué temas, habilidades o tecnologías te llaman la atención?"
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>¿Qué espero mejorar este año?</label>
                <textarea value={form.que_espero_mejorar} onChange={e => setForm({...form, que_espero_mejorar: e.target.value})}
                  rows={3} placeholder="¿En qué áreas quieres crecer o mejorar durante este año escolar?"
                  className={textareaClass} />
              </div>
            </div>
          )}

          {/* C — Evidencias seleccionadas */}
          {tab === 2 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-blue-900 border-b pb-2 mb-4">C. Evidencias seleccionadas</h2>
                <p className="text-xs text-gray-400 mb-4">Solo lo más significativo de tu aprendizaje este año</p>

                {evidencias.length > 0 ? (
                  <div className="space-y-3">
                    {evidencias.map(ev => (
                      <Link key={ev.id} href={`/evidencias/${ev.id}`}
                        className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all">
                        {/* Preview miniatura */}
                        {ev.file_url && ev.file_type?.startsWith('image/') ? (
                          <img src={ev.file_url} alt={ev.title}
                            className="w-14 h-14 object-cover rounded-lg shrink-0" />
                        ) : (
                          <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
                            {ev.file_type?.startsWith('video/') ? '🎥' :
                             ev.type === 'documento' ? '📄' :
                             ev.type === 'presentación' ? '📊' :
                             ev.type === 'código' ? '💻' : '📎'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm">{ev.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{ev.projects?.title ?? 'Sin proyecto'}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {ev.evidencia_tipo && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${etapaColor[ev.evidencia_tipo]}`}>
                                {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo}
                              </span>
                            )}
                            {ev.file_url && <span className="text-xs text-green-600">📁 Archivo subido</span>}
                            {ev.drive_url && <span className="text-xs text-blue-600">🔗 Drive</span>}
                          </div>
                          {ev.reflexion_aprendizaje && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{ev.reflexion_aprendizaje}"</p>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 shrink-0">
                          {new Date(ev.created_at).toLocaleDateString('es-CL')}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-4xl mb-3">📎</div>
                    <p className="text-sm">Aún no tienes evidencias</p>
                    <Link href="/evidencias/nueva"
                      className="inline-block mt-3 text-blue-600 text-sm hover:underline">
                      + Subir primera evidencia
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* D — Reflexión por evidencia */}
          {tab === 3 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-blue-900 border-b pb-2 mb-4">D. Reflexión por evidencia</h2>
                {evidencias.length > 0 ? (
                  <div className="space-y-5">
                    {evidencias.map(ev => (
                      <div key={ev.id} className="border border-gray-100 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                          {ev.evidencia_tipo && (
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${etapaColor[ev.evidencia_tipo]}`}>
                              {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo}
                            </span>
                          )}
                          <p className="font-semibold text-gray-800 text-sm">{ev.title}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          {ev.reflexion_aprendizaje && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-blue-500 mb-1">¿Qué aprendí?</p>
                              <p className="text-gray-700 text-xs">{ev.reflexion_aprendizaje}</p>
                            </div>
                          )}
                          {ev.dificultad && (
                            <div className="bg-orange-50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-orange-500 mb-1">¿Qué fue lo más difícil?</p>
                              <p className="text-gray-700 text-xs">{ev.dificultad}</p>
                            </div>
                          )}
                          {ev.como_resolvi && (
                            <div className="bg-green-50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-green-500 mb-1">¿Cómo resolví el problema?</p>
                              <p className="text-gray-700 text-xs">{ev.como_resolvi}</p>
                            </div>
                          )}
                          {ev.herramienta_usada && (
                            <div className="bg-purple-50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-purple-500 mb-1">Herramienta tecnológica</p>
                              <p className="text-gray-700 text-xs">💻 {ev.herramienta_usada}</p>
                            </div>
                          )}
                          {ev.uso_ia && (
                            <div className="bg-indigo-50 rounded-lg p-3 sm:col-span-2">
                              <p className="text-xs font-semibold text-indigo-500 mb-1">¿Usé IA?</p>
                              <p className="text-gray-700 text-xs">🤖 {ev.uso_ia}</p>
                            </div>
                          )}
                        </div>
                        {!ev.reflexion_aprendizaje && !ev.dificultad && !ev.como_resolvi && (
                          <Link href={`/evidencias/${ev.id}`}
                            className="text-xs text-blue-600 hover:underline">
                            + Agregar reflexión a esta evidencia
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Sube evidencias para ver sus reflexiones aquí
                  </div>
                )}
              </div>
            </div>
          )}

          {/* E — Progreso en el tiempo */}
          {tab === 4 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-blue-900 border-b pb-2 mb-6">E. Progreso en el tiempo</h2>

                {/* Línea de tiempo visual */}
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

                  {/* Inicial */}
                  <div className="relative mb-8">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-xl z-10 shrink-0">🟡</div>
                      <div>
                        <p className="font-semibold text-gray-800">Evidencia inicial</p>
                        <p className="text-xs text-gray-400">{evInicial.length} evidencia{evInicial.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {evInicial.length > 0 ? (
                      <div className="ml-16 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {evInicial.map(ev => (
                          <Link key={ev.id} href={`/evidencias/${ev.id}`}
                            className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors">
                            {ev.file_url && ev.file_type?.startsWith('image/') ? (
                              <img src={ev.file_url} className="w-10 h-10 rounded object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 bg-yellow-100 rounded flex items-center justify-center text-lg shrink-0">📎</div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{ev.title}</p>
                              <p className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleDateString('es-CL')}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-16 text-xs text-gray-400 italic">Sin evidencias iniciales aún</div>
                    )}
                  </div>

                  {/* Intermedia */}
                  <div className="relative mb-8">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl z-10 shrink-0">🔵</div>
                      <div>
                        <p className="font-semibold text-gray-800">Evidencia intermedia</p>
                        <p className="text-xs text-gray-400">{evIntermedia.length} evidencia{evIntermedia.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {evIntermedia.length > 0 ? (
                      <div className="ml-16 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {evIntermedia.map(ev => (
                          <Link key={ev.id} href={`/evidencias/${ev.id}`}
                            className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                            {ev.file_url && ev.file_type?.startsWith('image/') ? (
                              <img src={ev.file_url} className="w-10 h-10 rounded object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center text-lg shrink-0">📎</div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{ev.title}</p>
                              <p className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleDateString('es-CL')}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-16 text-xs text-gray-400 italic">Sin evidencias intermedias aún</div>
                    )}
                  </div>

                  {/* Final */}
                  <div className="relative">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-xl z-10 shrink-0">🟢</div>
                      <div>
                        <p className="font-semibold text-gray-800">Evidencia final</p>
                        <p className="text-xs text-gray-400">{evFinal.length} evidencia{evFinal.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {evFinal.length > 0 ? (
                      <div className="ml-16 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {evFinal.map(ev => (
                          <Link key={ev.id} href={`/evidencias/${ev.id}`}
                            className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                            {ev.file_url && ev.file_type?.startsWith('image/') ? (
                              <img src={ev.file_url} className="w-10 h-10 rounded object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center text-lg shrink-0">📎</div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{ev.title}</p>
                              <p className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleDateString('es-CL')}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-16 text-xs text-gray-400 italic">Sin evidencias finales aún</div>
                    )}
                  </div>
                </div>

                {/* Resumen progreso */}
                {evidencias.length > 1 && (
                  <div className="mt-8 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-5 border border-blue-100">
                    <p className="font-semibold text-gray-800 mb-3">📈 Comparación de mejoras</p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-yellow-600">{evInicial.length}</div>
                        <div className="text-xs text-gray-500">Iniciales</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{evIntermedia.length}</div>
                        <div className="text-xs text-gray-500">Intermedias</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{evFinal.length}</div>
                        <div className="text-xs text-gray-500">Finales</div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-yellow-400 via-blue-400 to-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (evidencias.length / 9) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{evidencias.length} total</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* F — Reflexión final anual */}
          {tab === 5 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">F. Reflexión final anual</h2>
              <div>
                <label className={labelClass}>Lo que más aprendí este año</label>
                <textarea value={form.lo_que_aprendi} onChange={e => setForm({...form, lo_que_aprendi: e.target.value})}
                  rows={3} placeholder="¿Cuál fue tu aprendizaje más importante de este año?"
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>Lo que mejoré</label>
                <textarea value={form.lo_que_mejore} onChange={e => setForm({...form, lo_que_mejore: e.target.value})}
                  rows={3} placeholder="¿En qué habilidades o áreas notaste más progreso?"
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>Lo que quiero aprender el próximo año</label>
                <textarea value={form.quiero_aprender} onChange={e => setForm({...form, quiero_aprender: e.target.value})}
                  rows={3} placeholder="¿Qué te gustaría explorar o aprender el próximo año escolar?"
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>Cómo la tecnología me ayudó a aprender mejor</label>
                <textarea value={form.tecnologia_ayudo} onChange={e => setForm({...form, tecnologia_ayudo: e.target.value})}
                  rows={3} placeholder="¿Qué herramientas digitales te fueron más útiles? ¿Cómo te apoyó la tecnología?"
                  className={textareaClass} />
              </div>
            </div>
          )}

          {/* Navegación */}
          <div className="flex justify-between items-center pb-8">
            <button type="button" onClick={() => setTab(t => Math.max(0, t - 1))} disabled={tab === 0}
              className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-30">
              ← Anterior
            </button>
            <span className="text-xs text-gray-400">{tab + 1} / {TABS.length}</span>
            {tab < TABS.length - 1 ? (
              <button type="button" onClick={() => setTab(t => Math.min(TABS.length - 1, t + 1))}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
                Siguiente →
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {saving ? 'Guardando...' : saved ? '✅ Guardado' : '💾 Guardar portafolio'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
