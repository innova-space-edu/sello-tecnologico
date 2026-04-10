'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'

const TABS = [
  'A. Identificación',
  'B. Curricular',
  'C. Investigación',
  'D. Metodología',
  'E. STEAM',
  'F. Diseño',
  'G. Evaluación',
  'H. Reflexión',
]

// ─── Tipos para etapas de metodología ─────────────────────────────────────────
interface EtapaBase {
  activa: boolean
  completada: boolean
  descripcion: string
  num_sesiones: string
  duracion_sesion: string
  fecha_inicio: string
  fecha_fin: string
  responsable: string
  evidencias_esperadas: string
  observaciones: string
  estado: string
}
interface EtapaInvestigacion extends EtapaBase {
  pregunta_especifica: string
  fuentes: string[]
  tecnicas_recoleccion: string[]
  hallazgos: string
}
interface EtapaDiseno extends EtapaBase {
  tipo_diseno: string[]
  criterios_diseno: string
  herramientas_diseno: string[]
  revision_diseno: string
}
interface EtapaDesarrollo extends EtapaBase {
  tipo_desarrollo: string[]
  hitos: string
  roles_equipo: string
  pruebas: string
  obstaculos: string
}
interface EtapaEvaluacion extends EtapaBase {
  tipo_evaluacion: string[]
  criterios_evaluacion: string
  instrumento: string[]
  resultados: string
  retroalimentacion: string
}
interface EtapaCierre extends EtapaBase {
  tipo_presentacion: string[]
  entregables: string
  difusion: string
  reflexion_equipo: string
  lecciones: string
  continuidad: string
}
interface EtapasMetodologia {
  investigacion: EtapaInvestigacion
  diseno: EtapaDiseno
  desarrollo: EtapaDesarrollo
  evaluacion: EtapaEvaluacion
  cierre: EtapaCierre
}

const etapaBaseVacia = (): EtapaBase => ({
  activa: false, completada: false, descripcion: '', num_sesiones: '',
  duracion_sesion: '', fecha_inicio: '', fecha_fin: '', responsable: '',
  evidencias_esperadas: '', observaciones: '', estado: 'Pendiente',
})

const etapasIniciales = (): EtapasMetodologia => ({
  investigacion: { ...etapaBaseVacia(), pregunta_especifica: '', fuentes: [], tecnicas_recoleccion: [], hallazgos: '' },
  diseno: { ...etapaBaseVacia(), tipo_diseno: [], criterios_diseno: '', herramientas_diseno: [], revision_diseno: '' },
  desarrollo: { ...etapaBaseVacia(), tipo_desarrollo: [], hitos: '', roles_equipo: '', pruebas: '', obstaculos: '' },
  evaluacion: { ...etapaBaseVacia(), tipo_evaluacion: [], criterios_evaluacion: '', instrumento: [], resultados: '', retroalimentacion: '' },
  cierre: { ...etapaBaseVacia(), tipo_presentacion: [], entregables: '', difusion: '', reflexion_equipo: '', lecciones: '', continuidad: '' },
})

// ─── Componente para listas editables dinámicas ────────────────────────────────
function ListaEditable({
  items, onChange, placeholder, label,
}: { items: string[]; onChange: (v: string[]) => void; placeholder?: string; label?: string }) {
  const add = () => onChange([...items, ''])
  const update = (i: number, val: string) => { const a = [...items]; a[i] = val; onChange(a) }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={item} onChange={e => update(i, e.target.value)}
            placeholder={placeholder ?? `Ítem ${i + 1}`}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button type="button" onClick={() => remove(i)}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 w-8 h-8 rounded-lg transition-colors flex items-center justify-center text-lg font-bold shrink-0">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
        + Agregar {label ?? 'ítem'}
      </button>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function EditarProyectoPage() {
  const router = useRouter()
  const params = useParams()
  const proyectoId = params.id as string
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [loadingDatos, setLoadingDatos] = useState(true)
  const [tab, setTab] = useState(0)
  const [cursos, setCursos] = useState<any[]>([])
  const [noAutorizado, setNoAutorizado] = useState(false)
  const [proyectoTitulo, setProyectoTitulo] = useState('')
  const [etapas, setEtapas] = useState<EtapasMetodologia>(etapasIniciales())
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [draftTime, setDraftTime] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const userIdRef = useRef<string | null>(null)

  const [form, setFormRaw] = useState({
    // A
    title: '', year: new Date().getFullYear().toString(),
    semestre: '1', asignaturas: '', docentes_responsables: '',
    tipo_proyecto: [] as string[], status: 'Borrador',
    course_id: '', start_date: '', end_date: '',
    integrantes_roles: [] as string[],
    // B
    objetivos_aprendizaje: '', habilidades: [] as string[],
    vinculacion_pei: '', indicador_oa: '',
    // C
    pregunta_guia: '', contexto_problema: '', justificacion: '',
    problema_detectado: '', evidencia_problema: '',
    preguntas_investigacion: [] as string[], hipotesis: '',
    // D
    metodologia: '', organizacion_trabajo: 'Grupal',
    herramientas_tecnologicas: '', herramientas_materiales: '',
    // E
    steam_ciencia: '', steam_tecnologia: '', steam_ingenieria: '',
    steam_arte: '', steam_matematica: '',
    uso_ia: [] as string[], estrategia_verificacion: '',
    // F
    objetivo_general: '', objetivos_especificos: [] as string[],
    solucion_propuesta: '', boceto_descripcion: '', boceto_url: '',
    tipo_producto: [] as string[], description: '',
    // G
    instrumento_evaluacion: [] as string[], criterios_evaluados: [] as string[], autoevaluacion: '',
    // H
    aprendizajes_logrados: '', dificultades: '', mejoras: '', impacto_comunidad: '',
    fuentes_consultadas: [] as string[],
  })

  useEffect(() => {
    supabase.from('courses').select('id, name').order('name').then(({ data }) => setCursos(data ?? []))

    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      userIdRef.current = user.id

      // Restaurar borrador si existe
      try {
        const draftKey = `project-draft-edit-${proyectoId}-${user.id}`
        const saved = localStorage.getItem(draftKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.updated_at) setDraftTime(parsed.updated_at)
          // se restaurará después de cargar datos — ver abajo
        }
      } catch { /* ignorar */ }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const esAdmin = ['admin', 'docente', 'coordinador'].includes(perfil?.role ?? '')

      const { data: p, error } = await supabase.from('projects').select('*').eq('id', proyectoId).single()
      if (error || !p) { router.push('/proyectos'); return }

      if (p.owner_id !== user.id && !esAdmin) {
        setNoAutorizado(true); setLoadingDatos(false); return
      }

      setProyectoTitulo(p.title ?? '')
      setForm({
        // A
        title: p.title ?? '',
        year: p.year ?? new Date().getFullYear().toString(),
        semestre: p.semestre ?? '1',
        asignaturas: Array.isArray(p.asignaturas) ? p.asignaturas.join(', ') : (p.asignaturas ?? ''),
        docentes_responsables: Array.isArray(p.docentes_responsables) ? p.docentes_responsables.join(', ') : (p.docentes_responsables ?? ''),
        tipo_proyecto: p.tipo_proyecto ?? [],
        status: p.status ?? 'Borrador',
        course_id: p.course_id ?? '',
        start_date: p.start_date ?? '',
        end_date: p.end_date ?? '',
        integrantes_roles: Array.isArray(p.integrantes_roles) ? p.integrantes_roles : [],
        // B
        objetivos_aprendizaje: p.objetivos_aprendizaje ?? '',
        habilidades: p.habilidades ?? [],
        vinculacion_pei: p.vinculacion_pei ?? '',
        indicador_oa: p.indicador_oa ?? '',
        // C
        pregunta_guia: p.pregunta_guia ?? '',
        contexto_problema: p.contexto_problema ?? '',
        justificacion: p.justificacion ?? '',
        problema_detectado: p.problema_detectado ?? '',
        evidencia_problema: p.evidencia_problema ?? '',
        preguntas_investigacion: Array.isArray(p.preguntas_investigacion) ? p.preguntas_investigacion : [],
        hipotesis: p.hipotesis ?? '',
        // D
        metodologia: p.metodologia ?? '',
        organizacion_trabajo: p.organizacion_trabajo ?? 'Grupal',
        herramientas_tecnologicas: Array.isArray(p.herramientas_tecnologicas) ? p.herramientas_tecnologicas.join(', ') : (p.herramientas_tecnologicas ?? ''),
        herramientas_materiales: Array.isArray(p.herramientas_materiales) ? p.herramientas_materiales.join(', ') : (p.herramientas_materiales ?? ''),
        // E
        steam_ciencia: p.steam_ciencia ?? '',
        steam_tecnologia: p.steam_tecnologia ?? '',
        steam_ingenieria: p.steam_ingenieria ?? '',
        steam_arte: p.steam_arte ?? '',
        steam_matematica: p.steam_matematica ?? '',
        uso_ia: p.uso_ia ?? [],
        estrategia_verificacion: p.estrategia_verificacion ?? '',
        // F
        objetivo_general: p.objetivo_general ?? '',
        objetivos_especificos: Array.isArray(p.objetivos_especificos) ? p.objetivos_especificos : [],
        solucion_propuesta: p.solucion_propuesta ?? '',
        boceto_descripcion: p.boceto_descripcion ?? '',
        boceto_url: p.boceto_url ?? '',
        tipo_producto: p.tipo_producto ?? [],
        description: p.description ?? '',
        // G
        instrumento_evaluacion: p.instrumento_evaluacion ?? [],
        criterios_evaluados: p.criterios_evaluados ?? [],
        autoevaluacion: p.autoevaluacion ?? '',
        // H
        aprendizajes_logrados: p.aprendizajes_logrados ?? '',
        dificultades: p.dificultades ?? '',
        mejoras: p.mejoras ?? '',
        impacto_comunidad: p.impacto_comunidad ?? '',
        fuentes_consultadas: Array.isArray(p.fuentes_consultadas) ? p.fuentes_consultadas : [],
      })

      if (p.etapas_metodologia && typeof p.etapas_metodologia === 'object' && Object.keys(p.etapas_metodologia).length > 0) {
        setEtapas(prev => ({ ...prev, ...p.etapas_metodologia }))
      }
      setLoadingDatos(false)

      // Restaurar borrador por encima de los datos cargados (si el usuario tenía cambios)
      try {
        const draftKey = `project-draft-edit-${proyectoId}-${user.id}`
        const saved = localStorage.getItem(draftKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.form) setFormRaw(parsed.form)
          if (parsed.etapas) setEtapas(prev => ({ ...prev, ...parsed.etapas }))
          if (parsed.tab !== undefined) setTab(parsed.tab)
        }
      } catch { /* ignorar */ }
    }
    cargar()
  }, [proyectoId])

  // setForm wrapper que activa hasChanges
  const setForm = useCallback((val: any) => { setFormRaw(val); setHasChanges(true) }, [])

  // Autosave en localStorage
  useEffect(() => {
    if (!hasChanges || loadingDatos) return
    const timer = setTimeout(() => {
      if (!userIdRef.current) return
      try {
        const draftKey = `project-draft-edit-${proyectoId}-${userIdRef.current}`
        const now = new Date().toISOString()
        localStorage.setItem(draftKey, JSON.stringify({ form, etapas, tab, updated_at: now }))
        setDraftTime(now)
        setDraftStatus('saved')
      } catch { setDraftStatus('error') }
    }, 1500)
    return () => clearTimeout(timer)
  }, [form, etapas, tab, hasChanges, loadingDatos])

  // Aviso al salir si hay cambios sin guardar
  useEffect(() => {
    if (!hasChanges) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  const saveDraft = () => {
    if (!userIdRef.current) return
    try {
      const draftKey = `project-draft-edit-${proyectoId}-${userIdRef.current}`
      const now = new Date().toISOString()
      localStorage.setItem(draftKey, JSON.stringify({ form, etapas, tab, updated_at: now }))
      setDraftTime(now)
      setDraftStatus('saved')
      alert('📝 Borrador guardado localmente')
    } catch { alert('Error al guardar borrador') }
  }

  const clearDraft = () => {
    if (userIdRef.current) {
      try { localStorage.removeItem(`project-draft-edit-${proyectoId}-${userIdRef.current}`) } catch { /* ignore */ }
    }
  }

  const formatDraftTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  const toggleArray = (field: string, value: string) => {
    const arr = (form as any)[field] as string[]
    setForm({ ...form, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] })
  }
  const toggleEtapaArray = (etapa: keyof EtapasMetodologia, field: string, value: string) => {
    const arr = ((etapas[etapa] as any)[field] as string[]) ?? []
    setEtapas({ ...etapas, [etapa]: { ...etapas[etapa], [field]: arr.includes(value) ? arr.filter((v: string) => v !== value) : [...arr, value] } })
  }
  const updateEtapa = (etapa: keyof EtapasMetodologia, field: string, value: any) => {
    setEtapas({ ...etapas, [etapa]: { ...etapas[etapa], [field]: value } })
  }
  const toggleEtapaAbierta = (etapa: keyof EtapasMetodologia) => {
    setEtapas({ ...etapas, [etapa]: { ...etapas[etapa], activa: !etapas[etapa].activa } })
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"
  const textareaClass = `${inputClass} resize-none`
  const subLabelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4"

  const CheckBox = ({ field, value, label }: { field: string; value: string; label?: string }) => {
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

  const EtapaCheckBox = ({ etapa, field, value }: { etapa: keyof EtapasMetodologia; field: string; value: string }) => {
    const arr = ((etapas[etapa] as any)[field] as string[]) ?? []
    return (
      <label className="flex items-center gap-2 cursor-pointer group">
        <div onClick={() => toggleEtapaArray(etapa, field, value)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${arr.includes(value) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
          {arr.includes(value) && <span className="text-white text-xs">✓</span>}
        </div>
        <span className="text-sm text-gray-700">{value}</span>
      </label>
    )
  }

  const CamposComunes = ({ etapa, color }: { etapa: keyof EtapasMetodologia; color: string }) => {
    const e = etapas[etapa] as EtapaBase
    return (
      <>
        <div className="mt-4">
          <label className={labelClass}>Descripción general de la etapa</label>
          <textarea value={e.descripcion} onChange={ev => updateEtapa(etapa, 'descripcion', ev.target.value)}
            rows={3} placeholder="¿Qué actividades se realizarán en esta etapa?" className={textareaClass} />
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 p-3 bg-${color}-50 rounded-lg border border-${color}-100`}>
          <div>
            <label className={labelClass}>N° de sesiones</label>
            <input type="number" min="1" value={e.num_sesiones} onChange={ev => updateEtapa(etapa, 'num_sesiones', ev.target.value)} placeholder="Ej: 3" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Minutos por sesión</label>
            <input type="number" min="1" value={e.duracion_sesion} onChange={ev => updateEtapa(etapa, 'duracion_sesion', ev.target.value)} placeholder="Ej: 90" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <select value={e.estado} onChange={ev => updateEtapa(etapa, 'estado', ev.target.value)} className={inputClass}>
              {['Pendiente', 'En progreso', 'Completada', 'Postergada'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className={labelClass}>Fecha inicio</label>
            <input type="date" value={e.fecha_inicio} onChange={ev => updateEtapa(etapa, 'fecha_inicio', ev.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Fecha término estimada</label>
            <input type="date" value={e.fecha_fin} onChange={ev => updateEtapa(etapa, 'fecha_fin', ev.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>Responsable(s) de la etapa</label>
          <input value={e.responsable} onChange={ev => updateEtapa(etapa, 'responsable', ev.target.value)} placeholder="Ej: Grupo completo / Nombre del docente guía" className={inputClass} />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Evidencias esperadas</label>
          <input value={e.evidencias_esperadas} onChange={ev => updateEtapa(etapa, 'evidencias_esperadas', ev.target.value)} placeholder="Ej: Informe de investigación, fotos del proceso, boceto digital..." className={inputClass} />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Observaciones / Notas adicionales</label>
          <textarea value={e.observaciones} onChange={ev => updateEtapa(etapa, 'observaciones', ev.target.value)} rows={2} placeholder="Cualquier nota relevante para esta etapa..." className={textareaClass} />
        </div>
      </>
    )
  }

  const estadoBadge = (estado: string) => {
    const colores: Record<string, string> = {
      'Pendiente': 'bg-gray-100 text-gray-500', 'En progreso': 'bg-blue-100 text-blue-700',
      'Completada': 'bg-green-100 text-green-700', 'Postergada': 'bg-orange-100 text-orange-600',
    }
    return colores[estado] ?? 'bg-gray-100 text-gray-500'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) { alert('Tu sesión expiró. Recarga la página.'); setLoading(false); return }

    const { error } = await supabase.from('projects').update({
      // Campos originales
      title: form.title, description: form.description, status: form.status,
      type: form.tipo_proyecto.join(', ') || 'Proyecto',
      course_id: form.course_id || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      semestre: form.semestre,
      asignaturas: form.asignaturas ? form.asignaturas.split(',').map(s => s.trim()) : [],
      docentes_responsables: form.docentes_responsables ? form.docentes_responsables.split(',').map(s => s.trim()) : [],
      tipo_proyecto: form.tipo_proyecto,
      objetivos_aprendizaje: form.objetivos_aprendizaje,
      habilidades: form.habilidades, vinculacion_pei: form.vinculacion_pei,
      pregunta_guia: form.pregunta_guia, contexto_problema: form.contexto_problema,
      justificacion: form.justificacion, metodologia: form.metodologia,
      organizacion_trabajo: form.organizacion_trabajo,
      herramientas_tecnologicas: form.herramientas_tecnologicas ? form.herramientas_tecnologicas.split(',').map(s => s.trim()) : [],
      herramientas_materiales: form.herramientas_materiales ? form.herramientas_materiales.split(',').map(s => s.trim()) : [],
      etapas_metodologia: etapas,
      uso_ia: form.uso_ia, estrategia_verificacion: form.estrategia_verificacion,
      tipo_producto: form.tipo_producto,
      instrumento_evaluacion: form.instrumento_evaluacion,
      criterios_evaluados: form.criterios_evaluados, autoevaluacion: form.autoevaluacion,
      aprendizajes_logrados: form.aprendizajes_logrados, dificultades: form.dificultades,
      mejoras: form.mejoras, impacto_comunidad: form.impacto_comunidad,
      updated_at: new Date().toISOString(),
      // Campos nuevos
      integrantes_roles: form.integrantes_roles.filter(Boolean),
      indicador_oa: form.indicador_oa,
      problema_detectado: form.problema_detectado,
      evidencia_problema: form.evidencia_problema,
      preguntas_investigacion: form.preguntas_investigacion.filter(Boolean),
      hipotesis: form.hipotesis,
      steam_ciencia: form.steam_ciencia,
      steam_tecnologia: form.steam_tecnologia,
      steam_ingenieria: form.steam_ingenieria,
      steam_arte: form.steam_arte,
      steam_matematica: form.steam_matematica,
      objetivo_general: form.objetivo_general,
      objetivos_especificos: form.objetivos_especificos.filter(Boolean),
      solucion_propuesta: form.solucion_propuesta,
      boceto_descripcion: form.boceto_descripcion,
      boceto_url: form.boceto_url,
      fuentes_consultadas: form.fuentes_consultadas.filter(Boolean),
    }).eq('id', proyectoId)

    if (!error) {
      clearDraft()
      setHasChanges(false)
      router.push(`/proyectos/${proyectoId}`)
    } else {
      console.error('Error al guardar:', error)
      alert(`No se pudo guardar.\n\nDetalle: ${error.message}`)
      setLoading(false)
    }
  }

  const estadoBadge2 = estadoBadge

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        {loadingDatos && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">📂</div>
              <p className="text-gray-400 text-sm">Cargando proyecto...</p>
            </div>
          </div>
        )}
        {noAutorizado && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="text-5xl">🔒</div>
            <p className="text-gray-600 font-medium">No tienes permiso para editar este proyecto</p>
            <button onClick={() => router.push('/proyectos')} className="text-blue-600 text-sm hover:underline">← Volver a proyectos</button>
          </div>
        )}
        {!loadingDatos && !noAutorizado && (
          <>
            <div className="mb-6">
              <button onClick={() => router.push(`/proyectos/${proyectoId}`)} className="text-blue-600 text-sm hover:underline">← Volver al proyecto</button>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
                <div>
                  <h1 className="text-2xl font-bold text-blue-900">Editar: {proyectoTitulo}</h1>
                  <p className="text-gray-500 mt-1 text-sm">Solo tú puedes editar tu copia — los cambios no afectan a otros usuarios</p>
                </div>
                <div className="flex items-center gap-3">
                  {draftTime && (
                    <span className="text-xs text-gray-400">
                      {draftStatus === 'saving' ? '🔄 Guardando...' : `✅ Borrador: ${formatDraftTime(draftTime)}`}
                    </span>
                  )}
                  <button type="button" onClick={saveDraft}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                    📝 Guardar borrador
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs navegación */}
            <div className="flex gap-1 flex-wrap mb-6">
              {TABS.map((t, i) => (
                <button key={i} onClick={() => { setTab(i); setHasChanges(true) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === i ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-blue-50 border border-gray-200'}`}>
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">

              {/* ── A — Identificación ───────────────────────────────────────── */}
              {tab === 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                  <h2 className="font-bold text-blue-900 border-b pb-2">A. Identificación del proyecto</h2>
                  <div>
                    <label className={labelClass}>Nombre del proyecto *</label>
                    <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="Ej: Prototipo de robot recolector de basura" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Año</label>
                      <input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Semestre</label>
                      <select value={form.semestre} onChange={e => setForm({ ...form, semestre: e.target.value })} className={inputClass}>
                        <option value="1">1° Semestre</option>
                        <option value="2">2° Semestre</option>
                        <option value="anual">Anual</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Curso(s)</label>
                    <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })} className={inputClass}>
                      <option value="">Sin curso asignado</option>
                      {cursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Asignatura(s) involucrada(s)</label>
                    <input value={form.asignaturas} onChange={e => setForm({ ...form, asignaturas: e.target.value })}
                      placeholder="Tecnología, Ciencias, Matemáticas (separadas por coma)" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Docente(s) responsables</label>
                    <input value={form.docentes_responsables} onChange={e => setForm({ ...form, docentes_responsables: e.target.value })}
                      placeholder="Nombre docente 1, Nombre docente 2" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Tipo de proyecto</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                      {['ABP', 'STEAM', 'Investigación', 'Prototipo', 'Comunitario', 'Otro'].map(v => (
                        <CheckBox key={v} field="tipo_proyecto" value={v} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Estado</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>
                      {['Borrador', 'En progreso', 'En revisión', 'Aprobado', 'Cerrado'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Fecha inicio</label>
                      <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Fecha término</label>
                      <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Integrantes del equipo y sus roles</label>
                    <p className="text-xs text-gray-400 mb-2">Ej: "María González — Investigadora", "Pedro Soto — Diseñador"</p>
                    <ListaEditable
                      items={form.integrantes_roles}
                      onChange={v => setForm({ ...form, integrantes_roles: v })}
                      placeholder="Nombre — Rol (ej: Investigador/a, Diseñador/a)"
                      label="integrante"
                    />
                  </div>
                </div>
              )}

              {/* ── B — Curricular ───────────────────────────────────────────── */}
              {tab === 1 && (
                <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                  <h2 className="font-bold text-blue-900 border-b pb-2">B. Fundamentación curricular (MINEDUC)</h2>
                  <div>
                    <label className={labelClass}>Objetivos de Aprendizaje (OA)</label>
                    <textarea value={form.objetivos_aprendizaje} onChange={e => setForm({ ...form, objetivos_aprendizaje: e.target.value })}
                      rows={4} placeholder="Copiar textual desde las Bases Curriculares MINEDUC..." className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Indicador de evaluación trabajado</label>
                    <textarea value={form.indicador_oa} onChange={e => setForm({ ...form, indicador_oa: e.target.value })}
                      rows={2} placeholder="Ej: Analizan efectos perjudiciales relacionados con el uso de recursos energéticos y materiales." className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Habilidades trabajadas</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {['Pensamiento crítico', 'Resolución de problemas', 'Trabajo colaborativo', 'Comunicación', 'Uso de tecnologías'].map(v => (
                        <CheckBox key={v} field="habilidades" value={v} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Vinculación con el PEI y sello tecnológico</label>
                    <textarea value={form.vinculacion_pei} onChange={e => setForm({ ...form, vinculacion_pei: e.target.value })}
                      rows={3} placeholder="¿Cómo se conecta con el proyecto educativo institucional?" className={textareaClass} />
                  </div>
                </div>
              )}

              {/* ── C — Investigación ────────────────────────────────────────── */}
              {tab === 2 && (
                <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                  <h2 className="font-bold text-blue-900 border-b pb-2">C. Investigación y problema</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Problema detectado</label>
                      <textarea value={form.problema_detectado} onChange={e => setForm({ ...form, problema_detectado: e.target.value })}
                        rows={3} placeholder="¿Qué pasa exactamente? Descríbelo de forma concreta." className={textareaClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Evidencia del problema</label>
                      <textarea value={form.evidencia_problema} onChange={e => setForm({ ...form, evidencia_problema: e.target.value })}
                        rows={3} placeholder="¿Cómo saben que ese problema existe? (observación, medición, encuesta...)" className={textareaClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Pregunta guía del proyecto</label>
                    <input value={form.pregunta_guia} onChange={e => setForm({ ...form, pregunta_guia: e.target.value })}
                      placeholder="¿Cómo podemos...? ¿Qué pasaría si...?" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Preguntas de investigación</label>
                    <p className="text-xs text-gray-400 mb-2">Agrega las preguntas específicas que guían la investigación del proyecto.</p>
                    <ListaEditable
                      items={form.preguntas_investigacion}
                      onChange={v => setForm({ ...form, preguntas_investigacion: v })}
                      placeholder="¿Cuál es la causa de...? ¿Qué ocurre cuando...?"
                      label="pregunta"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Contexto del problema</label>
                    <div className="grid grid-cols-3 gap-2 mb-2 mt-1">
                      {['Local', 'Escolar', 'Comunitario'].map(v => (
                        <CheckBox key={v} field="contexto_problema" value={v} />
                      ))}
                    </div>
                    <textarea value={form.contexto_problema} onChange={e => setForm({ ...form, contexto_problema: e.target.value })}
                      rows={3} placeholder="Describe el contexto y alcance del problema..." className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Justificación del proyecto</label>
                    <textarea value={form.justificacion} onChange={e => setForm({ ...form, justificacion: e.target.value })}
                      rows={3} placeholder="¿Por qué es importante resolver este problema?" className={textareaClass} />
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <label className="block text-sm font-medium text-indigo-800 mb-1">💡 Hipótesis del proyecto</label>
                    <textarea value={form.hipotesis} onChange={e => setForm({ ...form, hipotesis: e.target.value })}
                      rows={2} placeholder="Si se implementa [solución], entonces [resultado esperado] porque [razón]."
                      className="w-full border border-indigo-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-white" />
                  </div>
                </div>
              )}

              {/* ── D — Metodología ── INTACTO ────────────────────────────────── */}
              {tab === 3 && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                    <h2 className="font-bold text-blue-900 border-b pb-2">D. Metodología de trabajo</h2>
                    <div>
                      <label className={labelClass}>Metodología utilizada</label>
                      <select value={form.metodologia} onChange={e => setForm({ ...form, metodologia: e.target.value })} className={inputClass}>
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
                      <label className={labelClass}>Organización del trabajo</label>
                      <div className="flex gap-4 mt-1">
                        {['Individual', 'Grupal', 'Mixto'].map(v => (
                          <label key={v} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="org" value={v} checked={form.organizacion_trabajo === v}
                              onChange={() => setForm({ ...form, organizacion_trabajo: v })} />
                            <span className="text-sm text-gray-700">{v}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Herramientas tecnológicas</label>
                      <input value={form.herramientas_tecnologicas} onChange={e => setForm({ ...form, herramientas_tecnologicas: e.target.value })}
                        placeholder="Arduino, Scratch, Python, Canva... (separadas por coma)" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Materiales físicos</label>
                      <input value={form.herramientas_materiales} onChange={e => setForm({ ...form, herramientas_materiales: e.target.value })}
                        placeholder="Cartón, impresora 3D, cables... (separados por coma)" className={inputClass} />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-bold text-blue-900 border-b pb-2 mb-4">Etapas del proyecto</h3>
                    <p className="text-xs text-gray-500 mb-4">Haz clic en cada etapa para expandirla y completar su planificación detallada.</p>
                    <div className="space-y-3">

                      {/* 1. INVESTIGACIÓN */}
                      <div className="border border-blue-200 rounded-xl overflow-hidden">
                        <button type="button" onClick={() => toggleEtapaAbierta('investigacion')}
                          className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">🔍</span>
                            <div>
                              <span className="font-semibold text-blue-900 text-sm">1. Investigación</span>
                              <p className="text-xs text-blue-600 mt-0.5">Búsqueda y análisis de información relevante</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge(etapas.investigacion.estado)}`}>{etapas.investigacion.estado}</span>
                            <span className="text-blue-500 text-lg">{etapas.investigacion.activa ? '▼' : '▶'}</span>
                          </div>
                        </button>
                        {etapas.investigacion.activa && (
                          <div className="p-5 border-t border-blue-100 space-y-1 bg-white">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 mb-3">
                              <strong>📌 Objetivo de esta etapa:</strong> Recopilar, organizar y analizar información sobre el problema o fenómeno a trabajar.
                            </div>
                            <div>
                              <label className={labelClass}>Pregunta de investigación específica</label>
                              <input value={etapas.investigacion.pregunta_especifica} onChange={e => updateEtapa('investigacion', 'pregunta_especifica', e.target.value)}
                                placeholder="¿Cuál es la pregunta concreta que guiará la búsqueda de información?" className={inputClass} />
                            </div>
                            <div className="mt-4">
                              <p className={subLabelClass}>Fuentes de información</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {['Web / Internet', 'Libros y textos', 'Entrevistas a expertos', 'Experimentos propios', 'Observación directa', 'Encuestas', 'Artículos científicos', 'Documentales / videos', 'Bases de datos'].map(v => (
                                  <EtapaCheckBox key={v} etapa="investigacion" field="fuentes" value={v} />
                                ))}
                              </div>
                            </div>
                            <div className="mt-4">
                              <p className={subLabelClass}>Técnicas de recolección de datos</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {['Encuesta escrita', 'Entrevista', 'Observación sistemática', 'Experimento de laboratorio', 'Análisis documental', 'Revisión bibliográfica', 'Registro fotográfico', 'Diario de campo', 'Análisis estadístico'].map(v => (
                                  <EtapaCheckBox key={v} etapa="investigacion" field="tecnicas_recoleccion" value={v} />
                                ))}
                              </div>
                            </div>
                            <div className="mt-4">
                              <label className={labelClass}>Hallazgos y conclusiones</label>
                              <textarea value={etapas.investigacion.hallazgos} onChange={e => updateEtapa('investigacion', 'hallazgos', e.target.value)}
                                rows={3} placeholder="¿Qué encontraron en la investigación?" className={textareaClass} />
                            </div>
                            <CamposComunes etapa="investigacion" color="blue" />
                          </div>
                        )}
                      </div>

                      {/* 2. DISEÑO */}
                      <div className="border border-violet-200 rounded-xl overflow-hidden">
                        <button type="button" onClick={() => toggleEtapaAbierta('diseno')}
                          className="w-full flex items-center justify-between p-4 bg-violet-50 hover:bg-violet-100 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">✏️</span>
                            <div>
                              <span className="font-semibold text-violet-900 text-sm">2. Diseño</span>
                              <p className="text-xs text-violet-600 mt-0.5">Planificación visual y técnica de la solución</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge(etapas.diseno.estado)}`}>{etapas.diseno.estado}</span>
                            <span className="text-violet-500 text-lg">{etapas.diseno.activa ? '▼' : '▶'}</span>
                          </div>
                        </button>
                        {etapas.diseno.activa && (
                          <div className="p-5 border-t border-violet-100 space-y-1 bg-white">
                            <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-xs text-violet-700 mb-3">
                              <strong>📌 Objetivo de esta etapa:</strong> Planificar la solución de manera visual y técnica antes de construirla.
                            </div>
                            <div className="mt-2">
                              <p className={subLabelClass}>Tipo de diseño a utilizar</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {['Boceto manual', 'Diagrama de flujo', 'Plano técnico', 'Wireframe digital', 'Maqueta en papel', 'Modelado 3D', 'Prototipo rápido', 'Mapa conceptual', 'Otro'].map(v => (
                                  <EtapaCheckBox key={v} etapa="diseno" field="tipo_diseno" value={v} />
                                ))}
                              </div>
                            </div>
                            <div className="mt-4">
                              <p className={subLabelClass}>Herramientas de diseño</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {['Papel y lápiz', 'Canva', 'Figma', 'Google Slides', 'Tinkercad', 'AutoCAD / LibreCAD', 'Scratch (diagrama)', 'Miro', 'Otro'].map(v => (
                                  <EtapaCheckBox key={v} etapa="diseno" field="herramientas_diseno" value={v} />
                                ))}
                              </div>
                            </div>
                            <div className="mt-4">
                              <label className={labelClass}>Criterios de diseño</label>
                              <textarea value={etapas.diseno.criterios_diseno} onChange={e => updateEtapa('diseno', 'criterios_diseno', e.target.value)}
                                rows={3} placeholder="¿Qué requisitos debe cumplir el diseño?" className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Revisión y validación del diseño</label>
                              <textarea value={etapas.diseno.revision_diseno} onChange={e => updateEtapa('diseno', 'revision_diseno', e.target.value)}
                                rows={2} placeholder="¿Quién revisará y aprobará el diseño antes de pasar al desarrollo?" className={textareaClass} />
                            </div>
                            <CamposComunes etapa="diseno" color="violet" />
                          </div>
                        )}
                      </div>

                      {/* 3. DESARROLLO */}
                      <div className="border border-amber-200 rounded-xl overflow-hidden">
                        <button type="button" onClick={() => toggleEtapaAbierta('desarrollo')}
                          className="w-full flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">🔧</span>
                            <div>
                              <span className="font-semibold text-amber-900 text-sm">3. Desarrollo</span>
                              <p className="text-xs text-amber-600 mt-0.5">Construcción, programación o elaboración del producto</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge(etapas.desarrollo.estado)}`}>{etapas.desarrollo.estado}</span>
                            <span className="text-amber-500 text-lg">{etapas.desarrollo.activa ? '▼' : '▶'}</span>
                          </div>
                        </button>
                        {etapas.desarrollo.activa && (
                          <div className="p-5 border-t border-amber-100 space-y-1 bg-white">
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 mb-3">
                              <strong>📌 Objetivo de esta etapa:</strong> Construir, programar o elaborar el producto o solución planificada.
                            </div>
                            <div className="mt-2">
                              <p className={subLabelClass}>Tipo de desarrollo</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {['Construcción física', 'Programación / código', 'Diseño gráfico digital', 'Fabricación con impresora 3D', 'Electrónica / Arduino', 'Producción audiovisual', 'Investigación experimental', 'Desarrollo mixto'].map(v => (
                                  <EtapaCheckBox key={v} etapa="desarrollo" field="tipo_desarrollo" value={v} />
                                ))}
                              </div>
                            </div>
                            <div className="mt-4">
                              <label className={labelClass}>Hitos o entregas parciales</label>
                              <textarea value={etapas.desarrollo.hitos} onChange={e => updateEtapa('desarrollo', 'hitos', e.target.value)}
                                rows={4} placeholder="Lista las entregas parciales con fechas estimadas." className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Distribución de roles en el equipo</label>
                              <textarea value={etapas.desarrollo.roles_equipo} onChange={e => updateEtapa('desarrollo', 'roles_equipo', e.target.value)}
                                rows={3} placeholder="Ej: Estudiante A — programación / Estudiante B — ensamblaje" className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Pruebas realizadas y resultados</label>
                              <textarea value={etapas.desarrollo.pruebas} onChange={e => updateEtapa('desarrollo', 'pruebas', e.target.value)}
                                rows={3} placeholder="¿Qué pruebas se realizaron para verificar que funciona correctamente?" className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Obstáculos encontrados y cómo se resolvieron</label>
                              <textarea value={etapas.desarrollo.obstaculos} onChange={e => updateEtapa('desarrollo', 'obstaculos', e.target.value)}
                                rows={3} placeholder="¿Qué dificultades surgieron durante el desarrollo?" className={textareaClass} />
                            </div>
                            <CamposComunes etapa="desarrollo" color="amber" />
                          </div>
                        )}
                      </div>

                      {/* 4. EVALUACIÓN */}
                      <div className="border border-green-200 rounded-xl overflow-hidden">
                        <button type="button" onClick={() => toggleEtapaAbierta('evaluacion')}
                          className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">📊</span>
                            <div>
                              <span className="font-semibold text-green-900 text-sm">4. Evaluación</span>
                              <p className="text-xs text-green-600 mt-0.5">Medición del logro de objetivos y calidad del proceso</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge(etapas.evaluacion.estado)}`}>{etapas.evaluacion.estado}</span>
                            <span className="text-green-500 text-lg">{etapas.evaluacion.activa ? '▼' : '▶'}</span>
                          </div>
                        </button>
                        {etapas.evaluacion.activa && (
                          <div className="p-5 border-t border-green-100 space-y-1 bg-white">
                            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs text-green-700 mb-3">
                              <strong>📌 Objetivo de esta etapa:</strong> Medir el logro de objetivos de aprendizaje y calidad del proceso.
                            </div>
                            <div className="mt-2">
                              <p className={subLabelClass}>Tipo de evaluación</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {['Diagnóstica', 'Formativa', 'Sumativa', 'Autoevaluación', 'Coevaluación', 'Heteroevaluación'].map(v => (
                                  <EtapaCheckBox key={v} etapa="evaluacion" field="tipo_evaluacion" value={v} />
                                ))}
                              </div>
                            </div>
                            <div className="mt-4">
                              <p className={subLabelClass}>Instrumento de evaluación principal</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {['Rúbrica', 'Lista de cotejo', 'Escala de apreciación', 'Portafolio', 'Prueba escrita', 'Presentación oral', 'Registro de observación', 'Informe de proyecto'].map(v => (
                                  <EtapaCheckBox key={v} etapa="evaluacion" field="instrumento" value={v} />
                                ))}
                              </div>
                            </div>
                            <div className="mt-4">
                              <label className={labelClass}>Criterios de evaluación</label>
                              <textarea value={etapas.evaluacion.criterios_evaluacion} onChange={e => updateEtapa('evaluacion', 'criterios_evaluacion', e.target.value)}
                                rows={4} placeholder="¿Qué aspectos se evaluarán y con qué peso?" className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Resultados obtenidos vs. esperados</label>
                              <textarea value={etapas.evaluacion.resultados} onChange={e => updateEtapa('evaluacion', 'resultados', e.target.value)}
                                rows={3} placeholder="¿Los estudiantes lograron los objetivos esperados?" className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Retroalimentación recibida</label>
                              <textarea value={etapas.evaluacion.retroalimentacion} onChange={e => updateEtapa('evaluacion', 'retroalimentacion', e.target.value)}
                                rows={3} placeholder="¿Qué retroalimentación dieron el docente, los pares o la comunidad?" className={textareaClass} />
                            </div>
                            <CamposComunes etapa="evaluacion" color="green" />
                          </div>
                        )}
                      </div>

                      {/* 5. CIERRE */}
                      <div className="border border-rose-200 rounded-xl overflow-hidden">
                        <button type="button" onClick={() => toggleEtapaAbierta('cierre')}
                          className="w-full flex items-center justify-between p-4 bg-rose-50 hover:bg-rose-100 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">🏁</span>
                            <div>
                              <span className="font-semibold text-rose-900 text-sm">5. Cierre</span>
                              <p className="text-xs text-rose-600 mt-0.5">Presentación, reflexión final y difusión del proyecto</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge(etapas.cierre.estado)}`}>{etapas.cierre.estado}</span>
                            <span className="text-rose-500 text-lg">{etapas.cierre.activa ? '▼' : '▶'}</span>
                          </div>
                        </button>
                        {etapas.cierre.activa && (
                          <div className="p-5 border-t border-rose-100 space-y-1 bg-white">
                            <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-xs text-rose-700 mb-3">
                              <strong>📌 Objetivo de esta etapa:</strong> Presentar el producto final, reflexionar y difundir los resultados.
                            </div>
                            <div className="mt-2">
                              <p className={subLabelClass}>Forma de presentación del producto</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {['Feria tecnológica', 'Exposición al curso', 'Video presentación', 'Informe escrito', 'Prototipo funcional', 'App / demo en vivo', 'Póster científico', 'Publicación web', 'Otro'].map(v => (
                                  <EtapaCheckBox key={v} etapa="cierre" field="tipo_presentacion" value={v} />
                                ))}
                              </div>
                            </div>
                            <div className="mt-4">
                              <label className={labelClass}>Entregables finales</label>
                              <textarea value={etapas.cierre.entregables} onChange={e => updateEtapa('cierre', 'entregables', e.target.value)}
                                rows={3} placeholder="¿Qué documentos, archivos o productos físicos se entregarán al finalizar?" className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Estrategia de difusión</label>
                              <textarea value={etapas.cierre.difusion} onChange={e => updateEtapa('cierre', 'difusion', e.target.value)}
                                rows={2} placeholder="¿Cómo se compartirá el proyecto con la comunidad?" className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Reflexión del equipo</label>
                              <textarea value={etapas.cierre.reflexion_equipo} onChange={e => updateEtapa('cierre', 'reflexion_equipo', e.target.value)}
                                rows={3} placeholder="¿Cómo se sintió el equipo al finalizar el proyecto?" className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Lecciones aprendidas</label>
                              <textarea value={etapas.cierre.lecciones} onChange={e => updateEtapa('cierre', 'lecciones', e.target.value)}
                                rows={3} placeholder="¿Qué aprendieron del proceso completo?" className={textareaClass} />
                            </div>
                            <div className="mt-3">
                              <label className={labelClass}>Continuidad o proyección futura</label>
                              <textarea value={etapas.cierre.continuidad} onChange={e => updateEtapa('cierre', 'continuidad', e.target.value)}
                                rows={2} placeholder="¿Tiene este proyecto una continuación?" className={textareaClass} />
                            </div>
                            <CamposComunes etapa="cierre" color="rose" />
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* ── E — STEAM y Tecnología ───────────────────────────────────── */}
              {tab === 4 && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                    <h2 className="font-bold text-blue-900 border-b pb-2">E. Enfoque STEAM</h2>
                    <p className="text-sm text-gray-500">Justifica cada componente STEAM presente en el proyecto.</p>
                    <div className="space-y-3">
                      {[
                        { key: 'steam_ciencia' as const, emoji: '🔬', letra: 'S', nombre: 'Ciencia', color: 'blue', placeholder: '¿Qué concepto científico trabaja este proyecto?' },
                        { key: 'steam_tecnologia' as const, emoji: '💻', letra: 'T', nombre: 'Tecnología', color: 'indigo', placeholder: '¿Qué tecnología se analiza, usa o propone?' },
                        { key: 'steam_ingenieria' as const, emoji: '⚙️', letra: 'E', nombre: 'Ingeniería', color: 'amber', placeholder: '¿Qué solución o diseño construirán?' },
                        { key: 'steam_arte' as const, emoji: '🎨', letra: 'A', nombre: 'Arte', color: 'pink', placeholder: '¿Qué componente creativo, visual o de diseño tendrá el proyecto?' },
                        { key: 'steam_matematica' as const, emoji: '📐', letra: 'M', nombre: 'Matemática', color: 'green', placeholder: '¿Qué mediciones, datos o gráficos usarán?' },
                      ].map(({ key, emoji, letra, nombre, color, placeholder }) => (
                        <div key={key} className={`border border-${color}-200 rounded-xl p-4 bg-${color}-50`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{emoji}</span>
                            <span className={`font-bold text-${color}-700 text-lg`}>{letra}</span>
                            <span className={`font-semibold text-${color}-800 text-sm`}>— {nombre}</span>
                          </div>
                          <textarea
                            value={form[key]}
                            onChange={e => setForm({ ...form, [key]: e.target.value })}
                            rows={2} placeholder={placeholder}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                    <h3 className="font-semibold text-blue-900 border-b pb-2">Uso de tecnología e IA</h3>
                    <div>
                      <label className={labelClass}>Uso de IA en el proyecto</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {['No se utilizó', 'Apoyo conceptual', 'Generación de ideas', 'Análisis / retroalimentación'].map(v => (
                          <CheckBox key={v} field="uso_ia" value={v} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Estrategias de verificación y uso ético de IA</label>
                      <textarea value={form.estrategia_verificacion} onChange={e => setForm({ ...form, estrategia_verificacion: e.target.value })}
                        rows={3} placeholder="¿Cómo verificaron la información generada por IA? ¿Qué criterios éticos aplicaron?" className={textareaClass} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── F — Diseño y Producto ────────────────────────────────────── */}
              {tab === 5 && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                    <h2 className="font-bold text-blue-900 border-b pb-2">F. Diseño y producto final</h2>
                    <div>
                      <label className={labelClass}>Objetivo general del proyecto</label>
                      <textarea value={form.objetivo_general} onChange={e => setForm({ ...form, objetivo_general: e.target.value })}
                        rows={2} placeholder="Ej: Diseñar una solución tecnológica que permita reducir el consumo energético en el colegio." className={textareaClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Objetivos específicos</label>
                      <p className="text-xs text-gray-400 mb-2">Agrega al menos 3 objetivos concretos y medibles.</p>
                      <ListaEditable
                        items={form.objetivos_especificos}
                        onChange={v => setForm({ ...form, objetivos_especificos: v })}
                        placeholder="Ej: Investigar el problema ambiental asociado."
                        label="objetivo"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Solución propuesta</label>
                      <textarea value={form.solucion_propuesta} onChange={e => setForm({ ...form, solucion_propuesta: e.target.value })}
                        rows={3} placeholder="¿Qué solución concreta propone el equipo para resolver el problema detectado?" className={textareaClass} />
                    </div>
                    <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700">🖊️ Boceto / Diseño preliminar</p>
                      <div>
                        <label className={labelClass}>Descripción del boceto o esquema inicial</label>
                        <textarea value={form.boceto_descripcion} onChange={e => setForm({ ...form, boceto_descripcion: e.target.value })}
                          rows={3} placeholder="Describe el diseño o boceto del prototipo, solución o producto." className={textareaClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Enlace al boceto o diseño (Canva, Drive, Figma, etc.)</label>
                        <input value={form.boceto_url} onChange={e => setForm({ ...form, boceto_url: e.target.value })}
                          placeholder="https://..." className={inputClass} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                    <h3 className="font-semibold text-blue-900 border-b pb-2">Producto final</h3>
                    <div>
                      <label className={labelClass}>Tipo de producto</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {['Prototipo', 'Informe', 'App / programa', 'Video', 'Presentación', 'Otro'].map(v => (
                          <CheckBox key={v} field="tipo_producto" value={v} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Descripción del producto final</label>
                      <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                        rows={4} placeholder="Describe el producto o resultado final del proyecto..." className={textareaClass} />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-700 font-medium">📎 Evidencias adjuntas</p>
                      <p className="text-xs text-blue-500 mt-1">Las evidencias se suben desde la sección Evidencias y se vinculan a este proyecto.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── G — Evaluación ── INTACTO ────────────────────────────────── */}
              {tab === 6 && (
                <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                  <h2 className="font-bold text-blue-900 border-b pb-2">G. Evaluación</h2>
                  <div>
                    <label className={labelClass}>Instrumento(s) de evaluación</label>
                    <div className="flex gap-4 mt-2">
                      {['Rúbrica', 'Lista de cotejo', 'Autoevaluación', 'Coevaluación'].map(v => (
                        <CheckBox key={v} field="instrumento_evaluacion" value={v} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Criterios evaluados</label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['Proceso', 'Producto', 'Trabajo en equipo', 'Presentación', 'Creatividad', 'Innovación'].map(v => (
                        <CheckBox key={v} field="criterios_evaluados" value={v} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Autoevaluación / Coevaluación</label>
                    <textarea value={form.autoevaluacion} onChange={e => setForm({ ...form, autoevaluacion: e.target.value })}
                      rows={3} placeholder="Describe cómo se realizó la autoevaluación o coevaluación..." className={textareaClass} />
                  </div>
                </div>
              )}

              {/* ── H — Reflexión ────────────────────────────────────────────── */}
              {tab === 7 && (
                <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                  <h2 className="font-bold text-blue-900 border-b pb-2">H. Reflexión final</h2>
                  <div>
                    <label className={labelClass}>Aprendizajes logrados</label>
                    <textarea value={form.aprendizajes_logrados} onChange={e => setForm({ ...form, aprendizajes_logrados: e.target.value })}
                      rows={3} placeholder="¿Qué aprendieron los estudiantes con este proyecto?" className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Dificultades encontradas</label>
                    <textarea value={form.dificultades} onChange={e => setForm({ ...form, dificultades: e.target.value })}
                      rows={3} placeholder="¿Qué obstáculos o desafíos surgieron durante el proyecto?" className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Mejoras para futuras versiones</label>
                    <textarea value={form.mejoras} onChange={e => setForm({ ...form, mejoras: e.target.value })}
                      rows={3} placeholder="¿Qué harían diferente en una próxima versión del proyecto?" className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Impacto en la comunidad (si aplica)</label>
                    <textarea value={form.impacto_comunidad} onChange={e => setForm({ ...form, impacto_comunidad: e.target.value })}
                      rows={3} placeholder="¿Qué impacto tuvo o podría tener en la comunidad escolar o local?" className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Fuentes consultadas / Bibliografía</label>
                    <p className="text-xs text-gray-400 mb-2">Agrega los sitios, libros, videos o artículos que usaron para investigar.</p>
                    <ListaEditable
                      items={form.fuentes_consultadas}
                      onChange={v => setForm({ ...form, fuentes_consultadas: v })}
                      placeholder="Ej: https://... / Libro: Física para secundaria / Video de YouTube: ..."
                      label="fuente"
                    />
                  </div>
                </div>
              )}

              {/* ── Navegación entre tabs ───────────────────────────────────────── */}
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
                    {loading ? 'Guardando...' : '💾 Guardar cambios'}
                  </button>
                )}
                <button type="button" onClick={saveDraft}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  📝 Borrador
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
