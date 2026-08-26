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
  return ev.projects?.courses?.name ?? ev.profiles?.curso ?? 'Sin curso asignado'
}

function nivelDe(ev: any): string {
  const curso = cursoDe(ev).trim().replace(/º/g, '°')
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

function anioDe(ev: any): string {
  const candidato = ev.projects?.start_date || ev.projects?.created_at || ev.created_at
  if (!candidato) return 'Sin año'
  const fecha = new Date(candidato)
  return Number.isNaN(fecha.getTime()) ? 'Sin año' : String(fecha.getFullYear())
}

function grupoAsignaturaDe(ev: any): string {
  const items = asignaturasDe(ev)
  return items.length === 1 ? items[0] : items.join(' + ')
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

function fechaCorta(value: string): string {
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha'
  return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EvidenciasPage() {
  const supabase = useMemo(() => createClient(), [])
  const [evidencias, setEvidencias] = useState<any[]>([])
  const [rol, setRol] = useState('')
  const [userId, setUserId] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [filtroNivel, setFiltroNivel] = useState('todos')
  const [filtroAsignatura, setFiltroAsignatura] = useState('todas')
  const [filtroAnio, setFiltroAnio] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEtapa, setFiltroEtapa] = useState('todas')
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

  const niveles = useMemo(
    () => Array.from(new Set(evidencias.map(nivelDe))).sort(ordenarNivel),
    [evidencias]
  )

  const asignaturas = useMemo(
    () => Array.from(new Set(evidencias.flatMap(asignaturasDe))).sort((a, b) => a.localeCompare(b, 'es')),
    [evidencias]
  )

  const anios = useMemo(
    () => Array.from(new Set(evidencias.map(anioDe))).sort((a, b) => {
      if (a === 'Sin año') return 1
      if (b === 'Sin año') return -1
      return Number(b) - Number(a)
    }),
    [evidencias]
  )

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return evidencias.filter(ev => {
      const materias = asignaturasDe(ev)
      const nivel = nivelDe(ev)
      const anio = anioDe(ev)
      const texto = [
        ev.title, ev.description, ev.projects?.title, ev.profiles?.full_name,
        ev.profiles?.email, cursoDe(ev), nivel, anio, ...materias,
        ...(Array.isArray(ev.tags) ? ev.tags : []),
      ].map(x => String(x ?? '').toLowerCase())

      return (!q || texto.some(x => x.includes(q))) &&
        (filtroNivel === 'todos' || nivel === filtroNivel) &&
        (filtroAsignatura === 'todas' || materias.includes(filtroAsignatura)) &&
        (filtroAnio === 'todos' || anio === filtroAnio) &&
        (filtroTipo === 'todos' || ev.type === filtroTipo) &&
        (filtroEtapa === 'todas' || ev.evidencia_tipo === filtroEtapa)
    })
  }, [evidencias, busqueda, filtroNivel, filtroAsignatura, filtroAnio, filtroTipo, filtroEtapa])

  const estructura = useMemo(() => {
    const result: Record<string, Record<string, Record<string, any[]>>> = {}
    for (const ev of filtradas) {
      const nivel = nivelDe(ev)
      const asignatura = grupoAsignaturaDe(ev)
      const anio = anioDe(ev)
      result[nivel] ??= {}
      result[nivel][asignatura] ??= {}
      result[nivel][asignatura][anio] ??= []
      result[nivel][asignatura][anio].push(ev)
    }
    return result
  }, [filtradas])

  const imagenes = filtradas.filter(ev =>
    Boolean(ev.file_url) && (ev.file_type?.startsWith('image/') || ev.type === 'foto')
  )

  const limpiar = () => {
    setBusqueda('')
    setFiltroNivel('todos')
    setFiltroAsignatura('todas')
    setFiltroAnio('todos')
    setFiltroTipo('todos')
    setFiltroEtapa('todas')
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
    const isImage = ev.file_url && (ev.file_type?.startsWith('image/') || ev.type === 'foto')
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
              <span>🏫 {cursoDe(ev)}</span>
              {ev.projects?.title && <span>📌 {ev.projects.title}</span>}
              {ev.profiles && <span>👤 {ev.profiles.full_name ?? ev.profiles.email ?? 'Sin nombre'}</span>}
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8 min-w-0">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-blue-950">Evidencias</h1>
              <span className="text-xs font-semibold bg-blue-100 text-blue-800 rounded-full px-2.5 py-1">Nivel → Asignatura → Año</span>
            </div>
            <p className="text-slate-500 mt-1">Archivo organizado del Sello Tecnológico.</p>
          </div>
          <Link href="/evidencias/nueva" className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl w-fit">📎 + Nueva evidencia</Link>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="bg-blue-950 text-white rounded-xl p-4"><p className="text-xs text-blue-200">EVIDENCIAS</p><p className="text-2xl font-bold">{evidencias.length}</p></div>
          <div className="bg-slate-900 text-white rounded-xl p-4"><p className="text-xs text-slate-300">NIVELES</p><p className="text-2xl font-bold">{niveles.length}</p></div>
          <div className="bg-indigo-950 text-white rounded-xl p-4"><p className="text-xs text-indigo-200">ASIGNATURAS</p><p className="text-2xl font-bold">{asignaturas.length}</p></div>
          <div className="bg-cyan-950 text-white rounded-xl p-4"><p className="text-xs text-cyan-200">AÑOS</p><p className="text-2xl font-bold">{anios.length}</p></div>
        </div>

        {errorCarga && (
          <div className="mb-5 border border-red-200 bg-red-50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><p className="font-semibold text-red-800">No se pudieron cargar las evidencias</p><p className="text-sm text-red-600 mt-1">{errorCarga}</p></div>
            <button onClick={() => cargarEvidencias(rol, userId)} className="bg-red-700 text-white px-4 py-2 rounded-lg font-semibold w-fit">Reintentar</button>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="🔍 Buscar evidencia, proyecto, alumno..." className="md:col-span-2 border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
            <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm"><option value="todos">Todos los niveles</option>{niveles.map(x => <option key={x}>{x}</option>)}</select>
            <select value={filtroAsignatura} onChange={e => setFiltroAsignatura(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm"><option value="todas">Todas las asignaturas</option>{asignaturas.map(x => <option key={x}>{x}</option>)}</select>
            <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm"><option value="todos">Todos los años</option>{anios.map(x => <option key={x}>{x}</option>)}</select>
            <div className="flex gap-2">
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="min-w-0 flex-1 border border-slate-200 rounded-lg px-2 py-2.5 text-sm"><option value="todos">Tipo</option>{Object.keys(typeIcon).map(x => <option key={x} value={x}>{typeIcon[x]} {x}</option>)}</select>
              <select value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)} className="min-w-0 flex-1 border border-slate-200 rounded-lg px-2 py-2.5 text-sm"><option value="todas">Etapa</option><option value="inicial">Inicial</option><option value="intermedia">Intermedia</option><option value="final">Final</option></select>
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Mostrando <b>{filtradas.length}</b> de {evidencias.length}</p>
            <button onClick={limpiar} className="text-sm text-blue-700 hover:underline">Limpiar filtros</button>
          </div>
        </section>

        <div className="bg-white border border-slate-200 rounded-xl p-1 inline-flex gap-1 mb-5 shadow-sm">
          <button onClick={() => setVista('archivo')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${vista === 'archivo' ? 'bg-blue-700 text-white' : 'text-slate-600'}`}>🗂️ Archivo organizado</button>
          <button onClick={() => setVista('galeria')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${vista === 'galeria' ? 'bg-blue-700 text-white' : 'text-slate-600'}`}>🖼️ Galería ({imagenes.length})</button>
        </div>

        {cargando ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">Cargando evidencias...</div>
        ) : vista === 'galeria' ? (
          imagenes.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {imagenes.map(ev => (
                <Link key={ev.id} href={`/evidencias/${ev.id}`} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-52 bg-slate-900"><img src={ev.file_url} alt={ev.title} className="w-full h-full object-cover" /></div>
                  <div className="p-4"><div className="flex gap-1.5 flex-wrap mb-2"><span className="text-[11px] bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">{nivelDe(ev)}</span><span className="text-[11px] bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">{anioDe(ev)}</span></div><h3 className="font-semibold text-slate-900 line-clamp-2">{ev.title}</h3><p className="text-xs text-slate-500 mt-1">{asignaturasDe(ev).join(' · ')}</p></div>
                </Link>
              ))}
            </div>
          ) : <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">No hay imágenes para los filtros seleccionados.</div>
        ) : filtradas.length ? (
          <div className="space-y-5">
            {Object.keys(estructura).sort(ordenarNivel).map(nivel => (
              <details key={nivel} open className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="cursor-pointer list-none bg-blue-950 text-white px-5 py-4 font-bold text-lg">🎓 {nivel}</summary>
                <div className="p-4 space-y-4">
                  {Object.keys(estructura[nivel]).sort((a, b) => a.localeCompare(b, 'es')).map(asignatura => (
                    <details key={asignatura} open className="border border-slate-200 rounded-xl overflow-hidden">
                      <summary className="cursor-pointer list-none bg-slate-900 text-white px-4 py-3 font-semibold">📘 {asignatura}</summary>
                      <div className="divide-y divide-slate-100">
                        {Object.keys(estructura[nivel][asignatura]).sort((a, b) => Number(b) - Number(a)).map(anio => (
                          <section key={anio} className="p-3 lg:p-4">
                            <div className="flex items-center gap-3 mb-3"><span className="bg-blue-100 text-blue-900 font-bold text-sm px-3 py-1 rounded-lg">📅 {anio}</span><span className="text-xs text-slate-400">{estructura[nivel][asignatura][anio].length} evidencia(s)</span></div>
                            <div className="space-y-2">{estructura[nivel][asignatura][anio].map(renderEvidencia)}</div>
                          </section>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : !errorCarga ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center"><div className="text-4xl mb-3">📎</div><h3 className="font-semibold text-slate-800">No hay evidencias con estos filtros</h3><button onClick={limpiar} className="text-blue-700 hover:underline mt-2 text-sm">Limpiar filtros</button></div>
        ) : null}
      </main>
    </div>
  )
}
