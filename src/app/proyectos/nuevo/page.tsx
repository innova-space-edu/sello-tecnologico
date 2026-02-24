'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const TABS = ['A. Identificación', 'B. Curricular', 'C. Problema', 'D. Metodología', 'E. Tecnología', 'F. Producto', 'G. Evaluación', 'H. Reflexión']

export default function NuevoProyectoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(0)
  const [cursos, setCursos] = useState<any[]>([])

  const [form, setForm] = useState({
    // A
    title: '', year: new Date().getFullYear().toString(),
    semestre: '1', asignaturas: '', docentes_responsables: '',
    tipo_proyecto: [] as string[], status: 'Borrador',
    course_id: '', start_date: '', end_date: '',
    // B
    objetivos_aprendizaje: '', habilidades: [] as string[],
    vinculacion_pei: '',
    // C
    pregunta_guia: '', contexto_problema: '', justificacion: '',
    // D
    metodologia: '', organizacion_trabajo: 'Grupal',
    herramientas_tecnologicas: '', herramientas_materiales: '',
    // E
    uso_ia: [] as string[], estrategia_verificacion: '',
    // F
    tipo_producto: [] as string[], description: '',
    // G
    instrumento_evaluacion: [] as string[], criterios_evaluados: [] as string[], autoevaluacion: '',
    // H
    aprendizajes_logrados: '', dificultades: '', mejoras: '', impacto_comunidad: '',
  })

  useEffect(() => {
    supabase.from('courses').select('id, name').order('name').then(({ data }) => setCursos(data ?? []))
  }, [])

  const toggleArray = (field: string, value: string) => {
    const arr = (form as any)[field] as string[]
    setForm({ ...form, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] })
  }

  const CheckBox = ({ field, value, label }: { field: string, value: string, label?: string }) => {
    const arr = (form as any)[field] as string[]
    return (
      <label className="flex items-center gap-2 cursor-pointer group">
        <div onClick={() => toggleArray(field, value)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${arr.includes(value) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
          {arr.includes(value) && <span className="text-white text-xs">✓</span>}
        </div>
        <span className="text-sm text-gray-700">{label ?? value}</span>
      </label>
    )
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"
  const textareaClass = `${inputClass} resize-none`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('projects').insert({
      title: form.title,
      description: form.description,
      status: form.status,
      type: form.tipo_proyecto.join(', ') || 'Proyecto',
      course_id: form.course_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      owner_id: user?.id,
      // Campos ficha
      semestre: form.semestre,
      asignaturas: form.asignaturas ? form.asignaturas.split(',').map(s => s.trim()) : [],
      docentes_responsables: form.docentes_responsables ? form.docentes_responsables.split(',').map(s => s.trim()) : [],
      tipo_proyecto: form.tipo_proyecto,
      objetivos_aprendizaje: form.objetivos_aprendizaje,
      habilidades: form.habilidades,
      vinculacion_pei: form.vinculacion_pei,
      pregunta_guia: form.pregunta_guia,
      contexto_problema: form.contexto_problema,
      justificacion: form.justificacion,
      metodologia: form.metodologia,
      organizacion_trabajo: form.organizacion_trabajo,
      herramientas_tecnologicas: form.herramientas_tecnologicas ? form.herramientas_tecnologicas.split(',').map(s => s.trim()) : [],
      herramientas_materiales: form.herramientas_materiales ? form.herramientas_materiales.split(',').map(s => s.trim()) : [],
      uso_ia: form.uso_ia,
      estrategia_verificacion: form.estrategia_verificacion,
      tipo_producto: form.tipo_producto,
      instrumento_evaluacion: form.instrumento_evaluacion,
      criterios_evaluados: form.criterios_evaluados,
      autoevaluacion: form.autoevaluacion,
      aprendizajes_logrados: form.aprendizajes_logrados,
      dificultades: form.dificultades,
      mejoras: form.mejoras,
      impacto_comunidad: form.impacto_comunidad,
    })

    if (!error) router.push('/proyectos')
    else { alert('Error: ' + error.message); setLoading(false) }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <button onClick={() => router.push('/proyectos')} className="text-blue-600 text-sm hover:underline">← Volver</button>
          <h1 className="text-2xl font-bold text-blue-900 mt-2">Nueva Ficha de Proyecto Tecnológico</h1>
          <p className="text-gray-500 mt-1 text-sm">Completa la ficha por secciones — puedes navegar entre ellas</p>
        </div>

        {/* Tabs navegación */}
        <div className="flex gap-1 flex-wrap mb-6">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === i ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-blue-50 border border-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">

          {/* A — Identificación */}
          {tab === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">A. Identificación del proyecto</h2>
              <div>
                <label className={labelClass}>Nombre del proyecto *</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Ej: Prototipo de robot recolector de basura"
                  className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Año</label>
                  <input value={form.year} onChange={e => setForm({...form, year: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Semestre</label>
                  <select value={form.semestre} onChange={e => setForm({...form, semestre: e.target.value})} className={inputClass}>
                    <option value="1">1° Semestre</option>
                    <option value="2">2° Semestre</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Curso(s)</label>
                <select value={form.course_id} onChange={e => setForm({...form, course_id: e.target.value})} className={inputClass}>
                  <option value="">Sin curso asignado</option>
                  {cursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Asignatura(s) involucrada(s)</label>
                <input value={form.asignaturas} onChange={e => setForm({...form, asignaturas: e.target.value})}
                  placeholder="Tecnología, Ciencias, Matemáticas (separadas por coma)"
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Docente(s) responsables</label>
                <input value={form.docentes_responsables} onChange={e => setForm({...form, docentes_responsables: e.target.value})}
                  placeholder="Nombre docente 1, Nombre docente 2"
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Tipo de proyecto</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {['ABP','STEAM','Investigación','Prototipo','Comunitario','Otro'].map(v => (
                    <CheckBox key={v} field="tipo_proyecto" value={v} />
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputClass}>
                  {['Borrador','En progreso','En revisión','Aprobado','Cerrado'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Fecha inicio</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Fecha término</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {/* B — Curricular */}
          {tab === 1 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">B. Fundamentación curricular (MINEDUC)</h2>
              <div>
                <label className={labelClass}>Objetivos de Aprendizaje (OA)</label>
                <textarea value={form.objetivos_aprendizaje} onChange={e => setForm({...form, objetivos_aprendizaje: e.target.value})}
                  rows={4} placeholder="Copiar textual desde las Bases Curriculares MINEDUC..."
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>Habilidades trabajadas</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {['Pensamiento crítico','Resolución de problemas','Trabajo colaborativo','Comunicación','Uso de tecnologías'].map(v => (
                    <CheckBox key={v} field="habilidades" value={v} />
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Vinculación con el PEI y sello tecnológico</label>
                <textarea value={form.vinculacion_pei} onChange={e => setForm({...form, vinculacion_pei: e.target.value})}
                  rows={3} placeholder="¿Cómo se conecta con el proyecto educativo institucional?"
                  className={textareaClass} />
              </div>
            </div>
          )}

          {/* C — Problema */}
          {tab === 2 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">C. Problema o desafío</h2>
              <div>
                <label className={labelClass}>Pregunta guía del proyecto</label>
                <input value={form.pregunta_guia} onChange={e => setForm({...form, pregunta_guia: e.target.value})}
                  placeholder="¿Cómo podemos...? ¿Qué pasaría si...?"
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contexto del problema</label>
                <div className="grid grid-cols-3 gap-2 mb-2 mt-1">
                  {['Local','Escolar','Comunitario'].map(v => (
                    <CheckBox key={v} field="contexto_problema" value={v} />
                  ))}
                </div>
                <textarea value={form.contexto_problema} onChange={e => setForm({...form, contexto_problema: e.target.value})}
                  rows={3} placeholder="Describe el contexto y alcance del problema..."
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>Justificación del proyecto</label>
                <textarea value={form.justificacion} onChange={e => setForm({...form, justificacion: e.target.value})}
                  rows={3} placeholder="¿Por qué es importante resolver este problema?"
                  className={textareaClass} />
              </div>
            </div>
          )}

          {/* D — Metodología */}
          {tab === 3 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">D. Metodología de trabajo</h2>
              <div>
                <label className={labelClass}>Metodología utilizada</label>
                <select value={form.metodologia} onChange={e => setForm({...form, metodologia: e.target.value})} className={inputClass}>
                  <option value="">Seleccionar...</option>
                  <option>ABP (Aprendizaje Basado en Proyectos)</option>
                  <option>Indagación científica</option>
                  <option>Diseño centrado en el usuario</option>
                  <option>Design Thinking</option>
                  <option>STEAM</option>
                  <option>Otra</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Etapas del proyecto</label>
                <div className="space-y-2 mt-1">
                  {['1. Investigación','2. Diseño','3. Desarrollo','4. Evaluación','5. Cierre'].map(v => (
                    <div key={v} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg text-sm text-gray-700">
                      <span className="text-blue-500">▶</span> {v}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Organización del trabajo</label>
                <div className="flex gap-4 mt-1">
                  {['Individual','Grupal','Mixto'].map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="org" value={v}
                        checked={form.organizacion_trabajo === v}
                        onChange={() => setForm({...form, organizacion_trabajo: v})} />
                      <span className="text-sm text-gray-700">{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Herramientas tecnológicas</label>
                <input value={form.herramientas_tecnologicas} onChange={e => setForm({...form, herramientas_tecnologicas: e.target.value})}
                  placeholder="Arduino, Scratch, Python, Canva... (separadas por coma)"
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Materiales físicos</label>
                <input value={form.herramientas_materiales} onChange={e => setForm({...form, herramientas_materiales: e.target.value})}
                  placeholder="Cartón, impresora 3D, cables... (separados por coma)"
                  className={inputClass} />
              </div>
            </div>
          )}

          {/* E — Tecnología e IA */}
          {tab === 4 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">E. Uso de tecnología e IA</h2>
              <div>
                <label className={labelClass}>Uso de IA en el proyecto</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {['No se utilizó','Apoyo conceptual','Generación de ideas','Análisis / retroalimentación'].map(v => (
                    <CheckBox key={v} field="uso_ia" value={v} />
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Estrategias de verificación y uso ético de IA</label>
                <textarea value={form.estrategia_verificacion} onChange={e => setForm({...form, estrategia_verificacion: e.target.value})}
                  rows={3} placeholder="¿Cómo verificaron la información generada por IA? ¿Qué criterios éticos aplicaron?"
                  className={textareaClass} />
              </div>
            </div>
          )}

          {/* F — Producto final */}
          {tab === 5 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">F. Producto final</h2>
              <div>
                <label className={labelClass}>Tipo de producto</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {['Prototipo','Informe','App / programa','Video','Presentación','Otro'].map(v => (
                    <CheckBox key={v} field="tipo_producto" value={v} />
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Descripción del producto final</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  rows={4} placeholder="Describe el producto o resultado final del proyecto..."
                  className={textareaClass} />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700 font-medium">📎 Evidencias adjuntas</p>
                <p className="text-xs text-blue-500 mt-1">Las evidencias (fotos, videos, documentos, código) se suben desde la sección Evidencias y se vinculan a este proyecto.</p>
              </div>
            </div>
          )}

          {/* G — Evaluación */}
          {tab === 6 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">G. Evaluación</h2>
              <div>
                <label className={labelClass}>Instrumento(s) de evaluación</label>
                <div className="flex gap-4 mt-2">
                  {['Rúbrica','Lista de cotejo','Autoevaluación','Coevaluación'].map(v => (
                    <CheckBox key={v} field="instrumento_evaluacion" value={v} />
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Criterios evaluados</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {['Proceso','Producto','Trabajo en equipo','Presentación','Creatividad','Innovación'].map(v => (
                    <CheckBox key={v} field="criterios_evaluados" value={v} />
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Autoevaluación / Coevaluación</label>
                <textarea value={form.autoevaluacion} onChange={e => setForm({...form, autoevaluacion: e.target.value})}
                  rows={3} placeholder="Describe cómo se realizó la autoevaluación o coevaluación..."
                  className={textareaClass} />
              </div>
            </div>
          )}

          {/* H — Reflexión */}
          {tab === 7 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-blue-900 border-b pb-2">H. Reflexión final</h2>
              <div>
                <label className={labelClass}>Aprendizajes logrados</label>
                <textarea value={form.aprendizajes_logrados} onChange={e => setForm({...form, aprendizajes_logrados: e.target.value})}
                  rows={3} placeholder="¿Qué aprendieron los estudiantes con este proyecto?"
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>Dificultades encontradas</label>
                <textarea value={form.dificultades} onChange={e => setForm({...form, dificultades: e.target.value})}
                  rows={3} placeholder="¿Qué obstáculos o desafíos surgieron durante el proyecto?"
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>Mejoras para futuras versiones</label>
                <textarea value={form.mejoras} onChange={e => setForm({...form, mejoras: e.target.value})}
                  rows={3} placeholder="¿Qué harían diferente en una próxima versión del proyecto?"
                  className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>Impacto en la comunidad (si aplica)</label>
                <textarea value={form.impacto_comunidad} onChange={e => setForm({...form, impacto_comunidad: e.target.value})}
                  rows={3} placeholder="¿Qué impacto tuvo o podría tener en la comunidad escolar o local?"
                  className={textareaClass} />
              </div>
            </div>
          )}

          {/* Navegación entre tabs */}
          <div className="flex justify-between items-center pb-8">
            <button type="button"
              onClick={() => setTab(t => Math.max(0, t - 1))}
              disabled={tab === 0}
              className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-30">
              ← Anterior
            </button>

            <span className="text-xs text-gray-400">{tab + 1} / {TABS.length}</span>

            {tab < TABS.length - 1 ? (
              <button type="button"
                onClick={() => setTab(t => Math.min(TABS.length - 1, t + 1))}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
                Siguiente →
              </button>
            ) : (
              <button type="submit" disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {loading ? 'Guardando...' : '💾 Crear proyecto'}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}
