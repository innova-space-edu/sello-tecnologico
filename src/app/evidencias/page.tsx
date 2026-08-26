'use client'

import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const typeIcon: Record<string, string> = {
  documento: '📄',
  foto: '🖼️',
  video: '🎥',
  enlace: '🔗',
  presentación: '📊',
  código: '💻',
}

const etapaColor: Record<string, string> = {
  inicial: 'bg-amber-100 text-amber-800',
  intermedia: 'bg-blue-100 text-blue-800',
  final: 'bg-emerald-100 text-emerald-800',
}

const etapaIcon: Record<string, string> = {
  inicial: '🟡',
  intermedia: '🔵',
  final: '🟢',
}

function normalizarAsignaturas(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item ?? '').trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

function obtenerCurso(ev: any): string {
  return ev.projects?.courses?.name ?? ev.profiles?.curso ?? 'Sin curso asignado'
}

function obtenerNivel(ev: any): string {
  const curso = obtenerCurso(ev).trim()
  if (curso === 'Sin curso asignado') return 'Sin nivel asignado'

  const texto = curso.replace(/º/g, '°')
  const match = texto.match(/(\d+)\s*°?\s*(b[aá]sico|medio)/i)

  if (match) {
    const numero = match[1]
    const tipo = match[2].toLowerCase().startsWith('b') ? 'Básico' : 'Medio'
    return `${numero}° ${tipo}`
  }

  if (/pre\s*-?\s*k[ií]nder/i.test(texto)) return 'Prekínder'
  if (/k[ií]nder/i.test(texto)) return 'Kínder'

  return texto.replace(/\s+[A-Z]$/i, '').trim() || curso
}

function obtenerAsignaturas(ev: any): string[] {
  const asignaturas = normalizarAsignaturas(ev.projects?.asignaturas)
  return asignaturas.length > 0 ? asignaturas : ['Sin asignatura']
}

function obtenerAsignaturaGrupo(ev: any): string {
  const asignaturas = obtenerAsignaturas(ev)
  if (asignaturas.length === 1) return asignaturas[0]
  return asignaturas.join(' + ')
}

function obtenerAnio(ev: any): string {
  const year = ev.projects?.year
  if (year !== null && year !== undefined && String(year).trim()) return String(year)

  const fecha = ev.created_at ? new Date(ev.created_at) : null
  if (fecha && !Number.isNaN(fecha.getTime())) return String(fecha.getFullYear())

  return 'Sin año'
}

function ordenarNivel(a: string, b: string): number {
  const rank = (nivel: string) => {
    if (nivel === 'Prekínder') return 1
    if (nivel === 'Kínder') return 2

    const match = nivel.match(/(\d+)°\s*(Básico|Medio)/i)
    if (match) {
      const numero = Number(match[1])
      const base = match[2].toLowerCase() === 'básico' ? 10 : 30
      return base + numero
    }

    if (nivel === 'Sin nivel asignado') return 999
    return 500
  }

  const diff = rank(a) - rank(b)
  return diff !== 0 ? diff : a.localeCompare(b, 'es')
}

function formatearFecha(fecha: string): string {
  if (!fecha) return 'Sin fecha'
  const date = new Date(fecha)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'

  return date.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function EvidenciasPage() {
  const supabase = useMemo(() => createClient(), [])
  const [evidencias, setEvidencias] = useState<any[]>([])
  const [rol, setRol] = useState('')
  const [userId, setUserId] = useState('')
  const [cargando, setCargando] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [filtroNivel, setFiltroNivel] = useState('todos')
  const [filtroAsignatura, setFiltroAsignatura] = useState('todas')
  const [filtroAnio, setFiltroAnio] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEtapa, setFiltroEtapa] = useState('todas')
  const [vista, setVista] = useState<'archivo' | 'galeria'>('archivo')

  const fetchEvidencias = async (userRole: string, uid: string) => {
    let query = supabase
      .from('evidences')
      .select(`
        *,
        projects(id, title, year, asignaturas, courses(name), project_groups(group_name)),
        profiles!evidences_created_by_fkey(id, full_name, email, curso)
      `)

    if (userRole === 'estudiante') {
      query = query.eq('created_by', uid)
    }

    const { data } = await query.order('created_at', { ascending: false })
    setEvidencias(data ?? [])
    setCargando(false)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCargando(false)
        return
      }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = perfil?.role ?? ''
      setRol(role)
      setUserId(user.id)
      await fetchEvidencias(role, user.id)
    }

    init()
  }, [supabase])

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar la evidencia "${titulo}"?`)) return
    await supabase.from('evidences').delete().eq('id', id)
    await fetchEvidencias(rol, userId)
  }

  const esEstudiante = rol === 'estudiante'

  const nivelesDisponibles = useMemo(
    () => Array.from(new Set(evidencias.map(obtenerNivel))).sort(ordenarNivel),
    [evidencias]
  )

  const asignaturasDisponibles = useMemo(
    () => Array.from(new Set(evidencias.flatMap(obtenerAsignaturas))).sort((a, b) => a.localeCompare(b, 'es')),
    [evidencias]
  )

  const aniosDisponibles = useMemo(
    () => Array.from(new Set(evidencias.map(obtenerAnio))).sort((a, b) => {
      if (a === 'Sin año') return 1
      if (b === 'Sin año') return -1
      return Number(b) - Number(a)
    }),
    [evidencias]
  )

  const evidenciasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    return evidencias.filter(ev => {
      const asignaturas = obtenerAsignaturas(ev)
      const nivel = obtenerNivel(ev)
      const anio = obtenerAnio(ev)
      const curso = obtenerCurso(ev)

      const matchBusqueda = !q || [
        ev.title,
        ev.description,
        ev.projects?.title,
        ev.profiles?.full_name,
        ev.profiles?.email,
        curso,
        nivel,
        anio,
        ...asignaturas,
        ...(Array.isArray(ev.tags) ? ev.tags : []),
      ].some(value => String(value ?? '').toLowerCase().includes(q))

      const matchNivel = filtroNivel === 'todos' || nivel === filtroNivel
      const matchAsignatura = filtroAsignatura === 'todas' || asignaturas.includes(filtroAsignatura)
      const matchAnio = filtroAnio === 'todos' || anio === filtroAnio
      const matchTipo = filtroTipo === 'todos' || ev.type === filtroTipo
      const matchEtapa = filtroEtapa === 'todas' || ev.evidencia_tipo === filtroEtapa

      return matchBusqueda && matchNivel && matchAsignatura && matchAnio && matchTipo && matchEtapa
    })
  }, [evidencias, busqueda, filtroNivel, filtroAsignatura, filtroAnio, filtroTipo, filtroEtapa])

  const estructura = useMemo(() => {
    const grupos: Record<string, Record<string, Record<string, any[]>>> = {}

    for (const ev of evidenciasFiltradas) {
      const nivel = obtenerNivel(ev)
      const asignatura = obtenerAsignaturaGrupo(ev)
      const anio = obtenerAnio(ev)

      if (!grupos[nivel]) grupos[nivel] = {}
      if (!grupos[nivel][asignatura]) grupos[nivel][asignatura] = {}
      if (!grupos[nivel][asignatura][anio]) grupos[nivel][asignatura][anio] = []
      grupos[nivel][asignatura][anio].push(ev)
    }

    return grupos
  }, [evidenciasFiltradas])

  const nivelesOrdenados = Object.keys(estructura).sort(ordenarNivel)
  const imagenesFiltradas = evidenciasFiltradas.filter(ev =>
    Boolean(ev.file_url) && (ev.file_type?.startsWith('image/') || ev.type === 'foto')
  )

  const filtrosActivos = Boolean(
    busqueda ||
    filtroNivel !== 'todos' ||
    filtroAsignatura !== 'todas' ||
    filtroAnio !== 'todos' ||
    filtroTipo !== 'todos' ||
    filtroEtapa !== 'todas'
  )

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroNivel('todos')
    setFiltroAsignatura('todas')
    setFiltroAnio('todos')
    setFiltroTipo('todos')
    setFiltroEtapa('todas')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8 min-w-0">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-blue-950">Evidencias</h1>
              <span className="text-xs font-semibold text-blue-800 bg-blue-100 px-2.5 py-1 rounded-full">
                Nivel → Asignatura → Año
              </span>
            </div>
            <p className="text-slate-500 mt-1 max-w-3xl">
              Archivo organizado del Sello Tecnológico. Cada evidencia conserva su proyecto, curso, autor, etapa y fecha.
            </p>
          </div>

          <Link
            href="/evidencias/nueva"
            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shrink-0 w-fit"
          >
            📎 + Nueva evidencia
          </Link>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="bg-blue-950 text-white rounded-xl px-4 py-3">
            <p className="text-xs text-blue-200 uppercase tracking-wide">Evidencias</p>
            <p className="text-2xl font-bold mt-1">{evidencias.length}</p>
          </div>
          <div className="bg-slate-900 text-white rounded-xl px-4 py-3">
            <p className="text-xs text-slate-300 uppercase tracking-wide">Niveles</p>
            <p className="text-2xl font-bold mt-1">{nivelesDisponibles.length}</p>
          </div>
          <div className="bg-indigo-950 text-white rounded-xl px-4 py-3">
            <p className="text-xs text-indigo-200 uppercase tracking-wide">Asignaturas</p>
            <p className="text-2xl font-bold mt-1">{asignaturasDisponibles.length}</p>
          </div>
          <div className="bg-cyan-950 text-white rounded-xl px-4 py-3">
            <p className="text-xs text-cyan-200 uppercase tracking-wide">Años</p>
            <p className="text-2xl font-bold mt-1">{aniosDisponibles.length}</p>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between mb-5">
          <div className="bg-white border border-slate-200 rounded-xl p-1 inline-flex gap-1 w-fit shadow-sm">
            <button
              onClick={() => setVista('archivo')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                vista === 'archivo' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              🗂️ Archivo organizado
            </button>
            <button
              onClick={() => setVista('galeria')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                vista === 'galeria' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              🖼️ Galería ({imagenesFiltradas.length})
            </button>
          </div>

          {!cargando && (
            <p className="text-xs text-slate-500">
              Mostrando <span className="font-semibold text-slate-800">{evidenciasFiltradas.length}</span> de {evidencias.length} evidencias
            </p>
          )}
        </div>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="md:col-span-2 xl:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Buscar</label>
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Título, proyecto, estudiante, curso, etiqueta..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Nivel</label>
              <select
                value={filtroNivel}
                onChange={e => setFiltroNivel(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="todos">Todos</option>
                {nivelesDisponibles.map(nivel => <option key={nivel} value={nivel}>{nivel}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Asignatura</label>
              <select
                value={filtroAsignatura}
                onChange={e => setFiltroAsignatura(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="todas">Todas</option>
                {asignaturasDisponibles.map(asignatura => (
                  <option key={asignatura} value={asignatura}>{asignatura}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Año</label>
              <select
                value={filtroAnio}
                onChange={e => setFiltroAnio(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="todos">Todos</option>
                {aniosDisponibles.map(anio => <option key={anio} value={anio}>{anio}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Tipo</label>
                <select
                  value={filtroTipo}
                  onChange={e => setFiltroTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="todos">Todos</option>
                  {['documento', 'foto', 'video', 'enlace', 'presentación', 'código'].map(tipo => (
                    <option key={tipo} value={tipo}>{typeIcon[tipo]} {tipo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 xl:mt-2">Etapa</label>
                <select
                  value={filtroEtapa}
                  onChange={e => setFiltroEtapa(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="todas">Todas</option>
                  <option value="inicial">Inicial</option>
                  <option value="intermedia">Intermedia</option>
                  <option value="final">Final</option>
                </select>
              </div>
            </div>
          </div>

          {filtrosActivos && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={limpiarFiltros}
                className="text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                ✕ Limpiar filtros
              </button>
            </div>
          )}
        </section>

        {cargando ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
            Cargando evidencias...
          </div>
        ) : vista === 'galeria' ? (
          imagenesFiltradas.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {imagenesFiltradas.map(ev => {
                const asignaturas = obtenerAsignaturas(ev)
                const nivel = obtenerNivel(ev)
                const anio = obtenerAnio(ev)

                return (
                  <Link
                    key={ev.id}
                    href={`/evidencias/${ev.id}`}
                    className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="h-52 bg-slate-950 overflow-hidden">
                      <img
                        src={ev.file_url}
                        alt={ev.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{nivel}</span>
                        <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{anio}</span>
                      </div>
                      <h3 className="font-semibold text-slate-900 line-clamp-2">{ev.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{asignaturas.join(' · ')}</p>
                      <p className="text-xs text-slate-400 mt-2">{obtenerCurso(ev)} · {formatearFecha(ev.created_at)}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <div className="text-5xl mb-3">🖼️</div>
              <h3 className="font-semibold text-slate-800">No hay imágenes con estos filtros</h3>
              <p className="text-sm text-slate-500 mt-1">Puedes limpiar los filtros o subir una nueva evidencia visual.</p>
            </div>
          )
        ) : evidenciasFiltradas.length > 0 ? (
          <div className="space-y-5">
            {nivelesOrdenados.map(nivel => {
              const asignaturas = estructura[nivel]
              const totalNivel = Object.values(asignaturas)
                .flatMap(grupo => Object.values(grupo).flat())
                .length

              return (
                <details key={nivel} open className="group bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <summary className="cursor-pointer list-none bg-blue-950 text-white px-5 py-4 flex items-center justify-between gap-4 select-none">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl">🎓</span>
                      <div className="min-w-0">
                        <h2 className="font-bold text-lg truncate">{nivel}</h2>
                        <p className="text-xs text-blue-200 mt-0.5">{Object.keys(asignaturas).length} asignatura(s) · {totalNivel} evidencia(s)</p>
                      </div>
                    </div>
                    <span className="text-blue-200 group-open:rotate-180 transition-transform">⌄</span>
                  </summary>

                  <div className="p-4 lg:p-5 space-y-4">
                    {Object.keys(asignaturas).sort((a, b) => a.localeCompare(b, 'es')).map(asignatura => {
                      const porAnio = asignaturas[asignatura]
                      const totalAsignatura = Object.values(porAnio).flat().length
                      const anios = Object.keys(porAnio).sort((a, b) => {
                        if (a === 'Sin año') return 1
                        if (b === 'Sin año') return -1
                        return Number(b) - Number(a)
                      })

                      return (
                        <details key={asignatura} open className="group/asig border border-slate-200 rounded-xl overflow-hidden">
                          <summary className="cursor-pointer list-none bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3 select-none">
                            <div className="flex items-center gap-2 min-w-0">
                              <span>📘</span>
                              <span className="font-semibold truncate">{asignatura}</span>
                              <span className="text-[11px] text-slate-300 shrink-0">{totalAsignatura}</span>
                            </div>
                            <span className="text-slate-400 group-open/asig:rotate-180 transition-transform">⌄</span>
                          </summary>

                          <div className="divide-y divide-slate-100">
                            {anios.map(anio => (
                              <section key={anio} className="p-3 lg:p-4">
                                <div className="flex items-center gap-3 mb-3">
                                  <span className="bg-blue-100 text-blue-900 font-bold text-sm px-3 py-1 rounded-lg">📅 {anio}</span>
                                  <span className="text-xs text-slate-400">{porAnio[anio].length} evidencia(s)</span>
                                  <div className="h-px bg-slate-100 flex-1" />
                                </div>

                                <div className="space-y-2">
                                  {porAnio[anio].map(ev => {
                                    const uploader = ev.profiles
                                    const proyecto = ev.projects
                                    const grupo = proyecto?.project_groups?.group_name
                                    const isImage = ev.file_type?.startsWith('image/') || ev.type === 'foto'

                                    return (
                                      <article
                                        key={ev.id}
                                        className="border border-slate-200 rounded-xl p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                                      >
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                                          <div className="flex items-start gap-3 flex-1 min-w-0">
                                            {isImage && ev.file_url ? (
                                              <Link href={`/evidencias/${ev.id}`} className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                                <img
                                                  src={ev.file_url}
                                                  alt={ev.title}
                                                  className="w-full h-full object-cover"
                                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                                />
                                              </Link>
                                            ) : (
                                              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-xl shrink-0">
                                                {typeIcon[ev.type] ?? '📎'}
                                              </div>
                                            )}

                                            <div className="min-w-0 flex-1">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <Link
                                                  href={`/evidencias/${ev.id}`}
                                                  className="font-semibold text-slate-900 hover:text-blue-700 truncate"
                                                >
                                                  {ev.title}
                                                </Link>
                                                {ev.evidencia_tipo && (
                                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${etapaColor[ev.evidencia_tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                                                    {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo}
                                                  </span>
                                                )}
                                              </div>

                                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                                                <span>🏫 {obtenerCurso(ev)}</span>
                                                {proyecto && (
                                                  <Link href={`/proyectos/${proyecto.id}`} className="text-blue-700 hover:underline">
                                                    📌 {proyecto.title}
                                                  </Link>
                                                )}
                                                {grupo && <span>👥 {grupo}</span>}
                                                {uploader && <span>👤 {uploader.full_name ?? uploader.email ?? 'Sin nombre'}</span>}
                                              </div>

                                              {ev.description && (
                                                <p className="text-xs text-slate-400 mt-1 line-clamp-1">{ev.description}</p>
                                              )}

                                              {Array.isArray(ev.tags) && ev.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                  {ev.tags.slice(0, 4).map((tag: string) => (
                                                    <span key={tag} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">#{tag}</span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center lg:justify-end gap-1.5 shrink-0 border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0">
                                            <span className="text-[11px] text-slate-400 mr-2">{formatearFecha(ev.created_at)}</span>
                                            <Link
                                              href={`/evidencias/${ev.id}`}
                                              className="text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg text-sm"
                                              title="Ver evidencia"
                                            >
                                              👁️
                                            </Link>
                                            {ev.file_url && (
                                              <a
                                                href={ev.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-emerald-700 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg text-sm"
                                                title="Abrir archivo"
                                              >
                                                ⬇️
                                              </a>
                                            )}
                                            {(ev.created_by === userId || !esEstudiante) && (
                                              <Link
                                                href={`/evidencias/${ev.id}/editar`}
                                                className="text-slate-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg text-sm"
                                                title="Editar"
                                              >
                                                ✏️
                                              </Link>
                                            )}
                                            {(ev.created_by === userId || !esEstudiante) && (
                                              <button
                                                onClick={() => handleDelete(ev.id, ev.title)}
                                                className="text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-sm"
                                                title="Eliminar"
                                              >
                                                🗑️
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {ev.drive_url && (
                                          <a
                                            href={ev.drive_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 mt-2 text-xs text-blue-700 hover:underline"
                                          >
                                            🔗 Ver en Drive
                                          </a>
                                        )}
                                      </article>
                                    )
                                  })}
                                </div>
                              </section>
                            ))}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </details>
              )
            })}
          </div>
        ) : evidencias.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-3">📎</div>
            <h3 className="text-lg font-semibold text-slate-800">No hay evidencias aún</h3>
            <p className="text-sm text-slate-500 mt-1">Cuando se suba material aparecerá automáticamente organizado por nivel, asignatura y año.</p>
            <Link
              href="/evidencias/nueva"
              className="inline-block mt-4 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl"
            >
              📎 + Subir primera evidencia
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-semibold text-slate-700">No se encontraron evidencias</h3>
            <p className="text-sm text-slate-500 mt-1">Prueba otra combinación de nivel, asignatura, año, tipo o etapa.</p>
            <button onClick={limpiarFiltros} className="text-sm text-blue-700 hover:underline mt-3">
              Limpiar filtros
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
