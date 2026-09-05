'use client'

import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const typeIcon: Record<string, string> = {
  documento: '📄', foto: '🖼️', video: '🎥', enlace: '🔗', presentación: '📊', código: '💻',
}

const etapaStyle: Record<string, string> = {
  inicial: 'bg-amber-100 text-amber-800',
  intermedia: 'bg-blue-100 text-blue-800',
  final: 'bg-emerald-100 text-emerald-800',
}

const etapaIcon: Record<string, string> = { inicial: '🟡', intermedia: '🔵', final: '🟢' }

function asignaturasDe(ev: any): string[] {
  const value = ev.projects?.asignaturas
  if (Array.isArray(value)) {
    const items = value.map((x: unknown) => String(x ?? '').trim()).filter(Boolean)
    return items.length ? items : ['Sin asignatura']
  }
  if (typeof value === 'string') {
    const items = value.split(',').map(x => x.trim()).filter(Boolean)
    return items.length ? items : ['Sin asignatura']
  }
  return ['Sin asignatura']
}

function cursoDe(ev: any): string {
  const raw = ev.projects?.courses?.name ?? ev.profiles?.curso
  if (!raw) return 'Sin curso asignado'
  return String(raw).trim().replace(/º/g, '°').replace(/\s+/g, ' ') || 'Sin curso asignado'
}

function nivelDe(ev: any): string {
  const curso = cursoDe(ev)
  if (!curso || curso === 'Sin curso asignado') return 'Sin nivel asignado'

  const match = curso.match(/(\d+)\s*°?\s*(b[aá]sico|medio)/i)
  if (match) {
    const tipo = match[2].toLowerCase().startsWith('b') ? 'Básico' : 'Medio'
    return `${match[1]}° ${tipo}`
  }
  if (/pre\s*-?\s*k[ií]nder/i.test(curso)) return 'Prekínder'
  if (/k[ií]nder/i.test(curso)) return 'Kínder'

  return curso.replace(/\s+[A-Z]$/i, '').trim() || curso
}

function fechaValida(value: string | null | undefined): Date | null {
  if (!value) return null
  const fecha = new Date(value)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

function anioDe(ev: any): string {
  const fecha = fechaValida(ev.created_at)
  return fecha ? String(fecha.getFullYear()) : 'Sin año'
}

function fechaClaveDe(ev: any): string {
  const fecha = fechaValida(ev.created_at)
  if (!fecha) return 'sin-fecha'
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fechaCorta(value: string): string {
  const fecha = fechaValida(value)
  if (!fecha) return 'Sin fecha'
  return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fechaGrupo(clave: string): string {
  if (clave === 'sin-fecha') return 'Sin fecha'
  const fecha = new Date(`${clave}T12:00:00`)
  if (Number.isNaN(fecha.getTime())) return clave
  return fecha.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function usuarioIdDe(ev: any): string {
  return String(ev.profiles?.id ?? ev.created_by ?? ev.profiles?.email ?? 'sin-usuario')
}

function usuarioDe(ev: any): string {
  return String(ev.profiles?.full_name ?? ev.profiles?.email ?? 'Usuario sin identificar').trim()
}

function usuarioEmailDe(ev: any): string {
  return String(ev.profiles?.email ?? '').trim()
}

function esImagen(ev: any): boolean {
  return Boolean(ev.file_url) && (ev.file_type?.startsWith('image/') || ev.type === 'foto')
}

function rankNivel(nivel: string): number {
  if (nivel === 'Prekínder') return 1
  if (nivel === 'Kínder') return 2
  const match = nivel.match(/(\d+)°\s*(Básico|Medio)/i)
  if (match) return (match[2].toLowerCase() === 'básico' ? 10 : 30) + Number(match[1])
  if (nivel === 'Sin nivel asignado') return 999
  return 500
}

function ordenarNivel(a: string, b: string): number {
  const diff = rankNivel(a) - rankNivel(b)
  return diff || a.localeCompare(b, 'es')
}

function ordenarCurso(a: string, b: string): number {
  if (a === 'Sin curso asignado') return 1
  if (b === 'Sin curso asignado') return -1
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

function ordenarAnio(a: string, b: string): number {
  if (a === 'Sin año') return 1
  if (b === 'Sin año') return -1
  return Number(b) - Number(a)
}

function contarNodo(nodo: any): number {
  if (Array.isArray(nodo)) return nodo.length
  if (!nodo || typeof nodo !== 'object') return 0
  if (nodo.fechas) return (Object.values(nodo.fechas) as any[]).reduce((acc: number, value: any) => acc + contarNodo(value), 0)
  return (Object.values(nodo) as any[]).reduce((acc: number, value: any) => acc + contarNodo(value), 0)
}

export default function EvidenciasPage() {
  const supabase = useMemo(() => createClient(), [])
  const [evidencias, setEvidencias] = useState<any[]>([])
  const [rol, setRol] = useState('')
  const [userId, setUserId] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('todos')
  const [filtroNivel, setFiltroNivel] = useState('todos')
  const [filtroCurso, setFiltroCurso] = useState('todos')
  const [filtroUsuario, setFiltroUsuario] = useState('todos')
  const [vista, setVista] = useState<'archivo' | 'galeria'>('archivo')

  const cargarEvidencias = async (userRole: string, uid: string) => {
    setCargando(true)
    setErrorCarga('')

    let query = supabase
      .from('evidences')
      .select(`
        *,
        projects(id, title, asignaturas, start_date, created_at, courses(name)),
        profiles!evidences_created_by_fkey(id, full_name, email, curso)
      `)

    if (userRole === 'estudiante') query = query.eq('created_by', uid)

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error cargando evidencias:', error)
      setEvidencias([])
      setErrorCarga(error.message || 'No fue posible cargar las evidencias.')
    } else {
      setEvidencias(data ?? [])
    }
    setCargando(false)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCargando(false)
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = perfil?.role ?? ''
      setRol(role)
      setUserId(user.id)
      await cargarEvidencias(role, user.id)
    }
    init()
  }, [supabase])

  const esEstudiante = rol === 'estudiante'

  const anios = useMemo(
    () => Array.from(new Set(evidencias.map(anioDe))).sort(ordenarAnio),
    [evidencias]
  )

  const niveles = useMemo(
    () => Array.from(new Set(evidencias.map(nivelDe))).sort(ordenarNivel),
    [evidencias]
  )

  const cursos = useMemo(
    () => Array.from(new Set(evidencias.map(cursoDe))).sort(ordenarCurso),
    [evidencias]
  )

  const usuarios = useMemo(() => {
    const mapa = new Map<string, string>()
    evidencias.forEach(ev => mapa.set(usuarioIdDe(ev), usuarioDe(ev)))
    return Array.from(mapa.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
  }, [evidencias])

  const nivelesDisponibles = useMemo(() => {
    const base = filtroAnio === 'todos' ? evidencias : evidencias.filter(ev => anioDe(ev) === filtroAnio)
    return Array.from(new Set(base.map(nivelDe))).sort(ordenarNivel)
  }, [evidencias, filtroAnio])

  const cursosDisponibles = useMemo(() => {
    const base = evidencias.filter(ev =>
      (filtroAnio === 'todos' || anioDe(ev) === filtroAnio) &&
      (filtroNivel === 'todos' || nivelDe(ev) === filtroNivel)
    )
    return Array.from(new Set(base.map(cursoDe))).sort(ordenarCurso)
  }, [evidencias, filtroAnio, filtroNivel])

  const usuariosDisponibles = useMemo(() => {
    const mapa = new Map<string, string>()
    evidencias
      .filter(ev =>
        (filtroAnio === 'todos' || anioDe(ev) === filtroAnio) &&
        (filtroNivel === 'todos' || nivelDe(ev) === filtroNivel) &&
        (filtroCurso === 'todos' || cursoDe(ev) === filtroCurso)
      )
      .forEach(ev => mapa.set(usuarioIdDe(ev), usuarioDe(ev)))

    return Array.from(mapa.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
  }, [evidencias, filtroAnio, filtroNivel, filtroCurso])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return evidencias.filter(ev => {
      const nivel = nivelDe(ev)
      const curso = cursoDe(ev)
      const anio = anioDe(ev)
      const usuario = usuarioDe(ev)
      const materias = asignaturasDe(ev)
      const texto = [
        ev.title, ev.description, ev.projects?.title, usuario, ev.profiles?.email,
        curso, nivel, anio, ...materias, ...(Array.isArray(ev.tags) ? ev.tags : []),
      ].map(x => String(x ?? '').toLowerCase())

      return (!q || texto.some(x => x.includes(q))) &&
        (filtroAnio === 'todos' || anio === filtroAnio) &&
        (filtroNivel === 'todos' || nivel === filtroNivel) &&
        (filtroCurso === 'todos' || curso === filtroCurso) &&
        (filtroUsuario === 'todos' || usuarioIdDe(ev) === filtroUsuario)
    })
  }, [evidencias, busqueda, filtroAnio, filtroNivel, filtroCurso, filtroUsuario])

  const estructura = useMemo(() => {
    const result: Record<string, Record<string, Record<string, Record<string, {
      nombre: string
      email: string
      fechas: Record<string, any[]>
    }>>>> = {}

    for (const ev of filtradas) {
      const anio = anioDe(ev)
      const nivel = nivelDe(ev)
      const curso = cursoDe(ev)
      const usuarioId = usuarioIdDe(ev)
      const fecha = fechaClaveDe(ev)

      result[anio] ??= {}
      result[anio][nivel] ??= {}
      result[anio][nivel][curso] ??= {}
      result[anio][nivel][curso][usuarioId] ??= {
        nombre: usuarioDe(ev),
        email: usuarioEmailDe(ev),
        fechas: {},
      }
      result[anio][nivel][curso][usuarioId].fechas[fecha] ??= []
      result[anio][nivel][curso][usuarioId].fechas[fecha].push(ev)
    }

    return result
  }, [filtradas])

  const limpiar = () => {
    setBusqueda('')
    setFiltroAnio('todos')
    setFiltroNivel('todos')
    setFiltroCurso('todos')
    setFiltroUsuario('todos')
  }

  const eliminar = async (ev: any) => {
    if (!confirm(`¿Eliminar la evidencia "${ev.title}"?`)) return
    const { error } = await supabase.from('evidences').delete().eq('id', ev.id)
    if (error) {
      alert(`No se pudo eliminar la evidencia: ${error.message}`)
      return
    }
    await cargarEvidencias(rol, userId)
  }

  const renderEvidencia = (ev: any) => {
    const isImage = esImagen(ev)
    return (
      <article key={ev.id} className="border border-slate-200 rounded-xl bg-white p-3 hover:border-blue-300 hover:shadow-sm transition-all">
        <div className="flex gap-3 items-start">
          {isImage ? (
            <Link href={`/evidencias/${ev.id}`} className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
              <img src={ev.file_url} alt={ev.title} className="w-full h-full object-cover" />
            </Link>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-xl shrink-0">
              {typeIcon[ev.type] ?? '📎'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2 items-center">
              <Link href={`/evidencias/${ev.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                {ev.title}
              </Link>
              {ev.evidencia_tipo && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${etapaStyle[ev.evidencia_tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                  {etapaIcon[ev.evidencia_tipo]} {ev.evidencia_tipo}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
              <span>🎓 {nivelDe(ev)}</span>
              <span>🏫 {cursoDe(ev)}</span>
              {ev.projects?.title && <span>📌 {ev.projects.title}</span>}
              {!esEstudiante && <span>👤 {usuarioDe(ev)}</span>}
              <span>📅 {fechaCorta(ev.created_at)}</span>
            </div>

            {ev.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ev.description}</p>}
          </div>

          <div className="flex gap-1 shrink-0">
            <Link href={`/evidencias/${ev.id}`} title="Ver" className="p-2 rounded-lg text-blue-700 hover:bg-blue-50">👁️</Link>
            {ev.file_url && <a href={ev.file_url} target="_blank" rel="noopener noreferrer" title="Abrir archivo" className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50">⬇️</a>}
            {(ev.created_by === userId || !esEstudiante) && <Link href={`/evidencias/${ev.id}/editar`} title="Editar" className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">✏️</Link>}
            {(ev.created_by === userId || !esEstudiante) && <button onClick={() => eliminar(ev)} title="Eliminar" className="p-2 rounded-lg text-red-600 hover:bg-red-50">🗑️</button>}
          </div>
        </div>
      </article>
    )
  }

  const renderGaleria = () => {
    if (!filtradas.length) {
      return <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">No hay evidencias para los filtros seleccionados.</div>
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {filtradas.map(ev => {
          const isImage = esImagen(ev)
          return (
            <Link key={ev.id} href={`/evidencias/${ev.id}`} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all">
              {isImage ? (
                <div className="h-48 bg-slate-900 overflow-hidden">
                  <img src={ev.file_url} alt={ev.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                </div>
              ) : (
                <div className="h-48 bg-slate-100 flex flex-col items-center justify-center text-slate-500">
                  <span className="text-5xl">{typeIcon[ev.type] ?? '📎'}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide mt-3">{ev.type ?? 'archivo'}</span>
                </div>
              )}

              <div className="p-4">
                <div className="flex gap-1.5 flex-wrap mb-2">
                  <span className="text-[11px] bg-slate-900 text-white rounded-full px-2 py-0.5">{anioDe(ev)}</span>
                  <span className="text-[11px] bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">{nivelDe(ev)}</span>
                  <span className="text-[11px] bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">{cursoDe(ev)}</span>
                </div>
                <h3 className="font-semibold text-slate-900 line-clamp-2">{ev.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{asignaturasDe(ev).join(' · ')}</p>
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                  {!esEstudiante && <p className="truncate">👤 {usuarioDe(ev)}</p>}
                  <p>📅 {fechaCorta(ev.created_at)}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8 min-w-0">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-blue-950">{esEstudiante ? 'Mis evidencias' : 'Evidencias'}</h1>
              {!esEstudiante && (
                <span className="text-xs font-semibold bg-blue-100 text-blue-800 rounded-full px-2.5 py-1">Año → Nivel → Curso → Usuario → Fecha</span>
              )}
            </div>
            <p className="text-slate-500 mt-1">
              {esEstudiante ? 'Revisa tus evidencias y archivos.' : 'Archivo institucional organizado como árbol de carpetas.'}
            </p>
          </div>
          <Link href="/evidencias/nueva" className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl w-fit">📎 + Nueva evidencia</Link>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
          <div className="bg-blue-950 text-white rounded-xl p-4"><p className="text-xs text-blue-200">EVIDENCIAS</p><p className="text-2xl font-bold">{evidencias.length}</p></div>
          <div className="bg-slate-900 text-white rounded-xl p-4"><p className="text-xs text-slate-300">AÑOS</p><p className="text-2xl font-bold">{anios.length}</p></div>
          <div className="bg-blue-900 text-white rounded-xl p-4"><p className="text-xs text-blue-200">NIVELES</p><p className="text-2xl font-bold">{niveles.length}</p></div>
          <div className="bg-indigo-950 text-white rounded-xl p-4"><p className="text-xs text-indigo-200">CURSOS</p><p className="text-2xl font-bold">{cursos.length}</p></div>
          <div className="bg-cyan-950 text-white rounded-xl p-4"><p className="text-xs text-cyan-200">{esEstudiante ? 'RESULTADOS' : 'USUARIOS'}</p><p className="text-2xl font-bold">{esEstudiante ? filtradas.length : usuarios.length}</p></div>
        </div>

        {errorCarga && (
          <div className="mb-5 border border-red-200 bg-red-50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><p className="font-semibold text-red-800">No se pudieron cargar las evidencias</p><p className="text-sm text-red-600 mt-1">{errorCarga}</p></div>
            <button onClick={() => cargarEvidencias(rol, userId)} className="bg-red-700 text-white px-4 py-2 rounded-lg font-semibold w-fit">Reintentar</button>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-5">
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${esEstudiante ? 'xl:grid-cols-5' : 'xl:grid-cols-7'}`}>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar evidencia, proyecto, usuario..."
              className="md:col-span-2 border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
            <select
              value={filtroAnio}
              onChange={e => {
                setFiltroAnio(e.target.value)
                setFiltroNivel('todos')
                setFiltroCurso('todos')
                setFiltroUsuario('todos')
              }}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="todos">Todos los años</option>
              {anios.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <select
              value={filtroNivel}
              onChange={e => {
                setFiltroNivel(e.target.value)
                setFiltroCurso('todos')
                setFiltroUsuario('todos')
              }}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="todos">Todos los niveles</option>
              {nivelesDisponibles.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <select
              value={filtroCurso}
              onChange={e => {
                setFiltroCurso(e.target.value)
                setFiltroUsuario('todos')
              }}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="todos">Todos los cursos</option>
              {cursosDisponibles.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            {!esEstudiante && (
              <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm xl:col-span-2">
                <option value="todos">Todos los usuarios</option>
                {usuariosDisponibles.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Mostrando <b>{filtradas.length}</b> de {evidencias.length}</p>
            <div className="flex items-center gap-3">
              {!esEstudiante && <span className="text-xs text-slate-400">Filtros: año · nivel · curso · usuario</span>}
              <button onClick={limpiar} className="text-sm text-blue-700 hover:underline">Limpiar filtros</button>
            </div>
          </div>
        </section>

        <div className="bg-white border border-slate-200 rounded-xl p-1 inline-flex gap-1 mb-5 shadow-sm">
          <button onClick={() => setVista('archivo')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${vista === 'archivo' ? 'bg-blue-700 text-white' : 'text-slate-600'}`}>
            {esEstudiante ? '📋 Mis evidencias' : '🗂️ Archivo por carpetas'}
          </button>
          <button onClick={() => setVista('galeria')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${vista === 'galeria' ? 'bg-blue-700 text-white' : 'text-slate-600'}`}>
            🖼️ Galería ({filtradas.length})
          </button>
        </div>

        {cargando ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">Cargando evidencias...</div>
        ) : vista === 'galeria' ? (
          renderGaleria()
        ) : esEstudiante ? (
          filtradas.length ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
              {filtradas.map(renderEvidencia)}
            </div>
          ) : !errorCarga ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center"><div className="text-4xl mb-3">📎</div><h3 className="font-semibold text-slate-800">No hay evidencias con estos filtros</h3><button onClick={limpiar} className="text-blue-700 hover:underline mt-2 text-sm">Limpiar filtros</button></div>
          ) : null
        ) : filtradas.length ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-bold text-blue-950">Explorador de evidencias</h2>
                <p className="text-xs text-slate-500 mt-0.5">Abre las carpetas para navegar por año, nivel, curso, usuario y fecha.</p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">{filtradas.length} evidencia(s)</span>
            </div>

            <div className="p-4 lg:p-5 space-y-4">
              {Object.keys(estructura).sort(ordenarAnio).map(anio => (
                <details key={anio} open={Object.keys(estructura).length === 1} className="group/year border border-slate-200 rounded-xl overflow-hidden">
                  <summary className="cursor-pointer list-none bg-blue-950 text-white px-4 py-3 flex items-center justify-between gap-3">
                    <span className="font-bold flex items-center gap-2"><span>📁</span><span>{anio}</span></span>
                    <span className="text-xs bg-white/15 rounded-full px-2.5 py-1">{contarNodo(estructura[anio])} evidencia(s)</span>
                  </summary>

                  <div className="p-4 bg-white">
                    <div className="ml-2 border-l-2 border-blue-200 pl-5 space-y-3">
                      {Object.keys(estructura[anio]).sort(ordenarNivel).map(nivel => (
                        <details key={nivel} className="relative group/nivel">
                          <span className="absolute -left-[1.45rem] top-5 w-5 border-t-2 border-blue-200" />
                          <summary className="cursor-pointer list-none border border-blue-100 bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-100/70">
                            <span className="font-semibold text-blue-950 flex items-center gap-2"><span>📂</span><span>{nivel}</span></span>
                            <span className="text-xs text-blue-800">{contarNodo(estructura[anio][nivel])}</span>
                          </summary>

                          <div className="ml-5 mt-3 border-l-2 border-indigo-100 pl-5 space-y-3">
                            {Object.keys(estructura[anio][nivel]).sort(ordenarCurso).map(curso => (
                              <details key={curso} className="relative group/curso">
                                <span className="absolute -left-[1.45rem] top-5 w-5 border-t-2 border-indigo-100" />
                                <summary className="cursor-pointer list-none border border-slate-200 bg-white rounded-lg px-4 py-3 flex items-center justify-between gap-3 hover:border-blue-300 hover:bg-slate-50">
                                  <span className="font-semibold text-slate-900 flex items-center gap-2"><span>🏫</span><span>{curso}</span></span>
                                  <span className="text-xs text-slate-500">{contarNodo(estructura[anio][nivel][curso])}</span>
                                </summary>

                                <div className="ml-5 mt-3 border-l-2 border-slate-200 pl-5 space-y-3">
                                  {Object.keys(estructura[anio][nivel][curso])
                                    .sort((a, b) => estructura[anio][nivel][curso][a].nombre.localeCompare(estructura[anio][nivel][curso][b].nombre, 'es', { sensitivity: 'base' }))
                                    .map(usuarioId => {
                                      const usuario = estructura[anio][nivel][curso][usuarioId]
                                      return (
                                        <details key={usuarioId} className="relative group/usuario">
                                          <span className="absolute -left-[1.45rem] top-5 w-5 border-t-2 border-slate-200" />
                                          <summary className="cursor-pointer list-none border border-slate-200 bg-slate-50 rounded-lg px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-100">
                                            <span className="min-w-0 flex items-center gap-2">
                                              <span>👤</span>
                                              <span className="min-w-0">
                                                <span className="font-semibold text-slate-900 block truncate">{usuario.nombre}</span>
                                                {usuario.email && usuario.email !== usuario.nombre && <span className="text-[11px] text-slate-500 block truncate">{usuario.email}</span>}
                                              </span>
                                            </span>
                                            <span className="text-xs text-slate-500 shrink-0">{contarNodo(usuario)} evidencia(s)</span>
                                          </summary>

                                          <div className="ml-5 mt-3 border-l-2 border-emerald-100 pl-5 space-y-3">
                                            {Object.keys(usuario.fechas).sort((a, b) => {
                                              if (a === 'sin-fecha') return 1
                                              if (b === 'sin-fecha') return -1
                                              return b.localeCompare(a)
                                            }).map(fecha => (
                                              <section key={fecha} className="relative">
                                                <span className="absolute -left-[1.45rem] top-5 w-5 border-t-2 border-emerald-100" />
                                                <div className="border border-emerald-100 rounded-xl overflow-hidden bg-white">
                                                  <div className="bg-emerald-50 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                                    <span className="font-semibold text-emerald-950 text-sm">📅 {fechaGrupo(fecha)}</span>
                                                    <span className="text-xs text-emerald-800">{usuario.fechas[fecha].length} evidencia(s)</span>
                                                  </div>
                                                  <div className="p-3 space-y-2">{usuario.fechas[fecha].map(renderEvidencia)}</div>
                                                </div>
                                              </section>
                                            ))}
                                          </div>
                                        </details>
                                      )
                                    })}
                                </div>
                              </details>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ) : !errorCarga ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center"><div className="text-4xl mb-3">📎</div><h3 className="font-semibold text-slate-800">No hay evidencias con estos filtros</h3><button onClick={limpiar} className="text-blue-700 hover:underline mt-2 text-sm">Limpiar filtros</button></div>
        ) : null}
      </main>
    </div>
  )
}
