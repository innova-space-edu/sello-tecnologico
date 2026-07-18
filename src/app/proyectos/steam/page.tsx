'use client'

import Sidebar from '@/components/Sidebar'
import { ROUTE_LABELS, STEAM_TEMPLATES, type SteamRoute } from '@/lib/steam-templates'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const AREAS = Array.from(new Set(STEAM_TEMPLATES.flatMap(template => template.areas))).sort((a, b) => a.localeCompare(b, 'es'))

export default function SteamCatalogPage() {
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('Todas')
  const [mode, setMode] = useState('Todas')
  const [level, setLevel] = useState('Todos')
  const [route, setRoute] = useState<'Todas' | SteamRoute>('Todas')

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')
    return STEAM_TEMPLATES.filter(template => {
      const matchesSearch = !query || [template.title, template.summary, template.product, ...template.areas].join(' ').toLocaleLowerCase('es').includes(query)
      const matchesArea = area === 'Todas' || template.areas.includes(area)
      const matchesMode = mode === 'Todas' || template.mode === mode
      const matchesLevel = level === 'Todos' || template.levels.includes(level)
      const matchesRoute = route === 'Todas' || template.route === route
      return matchesSearch && matchesArea && matchesMode && matchesLevel && matchesRoute
    })
  }, [area, level, mode, route, search])

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 pt-16 lg:ml-64 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link href="/proyectos" className="text-sm font-semibold text-blue-600 hover:underline">← Volver a proyectos</Link>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-2xl text-white shadow-sm">🚀</span>
                <div>
                  <h1 className="text-2xl font-black text-blue-950">Crear proyecto STEAM</h1>
                  <p className="text-sm text-slate-500">Elige una idea y avanza desde el desafío hasta una versión mejorada.</p>
                </div>
              </div>
            </div>
            <Link href="/proyectos/steam/nuevo?template=idea-libre" className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50">✨ Tengo mi propia idea</Link>
          </div>

          <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2">
                <span className="sr-only">Buscar</span>
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar biología, IA, espacio, arte…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              </label>
              <select value={area} onChange={event => setArea(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Todas</option>{AREAS.map(item => <option key={item}>{item}</option>)}</select>
              <select value={mode} onChange={event => setMode(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Todas</option><option>Físico</option><option>Digital</option><option>Híbrido</option></select>
              <select value={level} onChange={event => setLevel(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Todos</option><option>1° medio</option><option>2° medio</option><option>3° medio</option><option>4° medio</option></select>
              <select value={route} onChange={event => setRoute(event.target.value as 'Todas' | SteamRoute)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option value="Todas">Todas las rutas</option>{Object.entries(ROUTE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-400">{filtered.length} plantillas disponibles · Los filtros solo muestran opciones adecuadas.</p>
          </section>

          {filtered.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(template => (
                <article key={template.slug} className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-4 border-b border-slate-100 bg-gradient-to-br from-blue-50 to-violet-50 p-5">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">{template.icon}</span>
                    <div className="min-w-0">
                      <h2 className="font-black text-slate-900">{template.title}</h2>
                      <p className="mt-1 text-xs font-bold text-violet-700">{ROUTE_LABELS[template.route]}</p>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-sm leading-relaxed text-slate-600">{template.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">{template.areas.map(item => <span key={item} className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{item}</span>)}</div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-slate-50 p-2"><dt className="text-slate-400">Modalidad</dt><dd className="mt-0.5 font-black text-slate-700">{template.mode}</dd></div>
                      <div className="rounded-xl bg-slate-50 p-2"><dt className="text-slate-400">Dificultad</dt><dd className="mt-0.5 font-black text-slate-700">{template.difficulty}</dd></div>
                      <div className="rounded-xl bg-slate-50 p-2"><dt className="text-slate-400">Duración</dt><dd className="mt-0.5 font-black text-slate-700">{template.duration}</dd></div>
                    </dl>
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800"><strong>Producto:</strong> {template.product}</div>
                    <Link href={`/proyectos/steam/nuevo?template=${template.slug}`} className="mt-5 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-blue-700">Elegir esta idea →</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><div className="text-5xl">🔎</div><h2 className="mt-3 text-xl font-black text-slate-800">No encontramos una plantilla</h2><p className="mt-1 text-sm text-slate-500">Cambia los filtros o comienza con una idea propia.</p></div>
          )}
        </div>
      </main>
    </div>
  )
}
