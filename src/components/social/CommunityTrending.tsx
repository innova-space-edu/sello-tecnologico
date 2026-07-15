'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { TrendingPage } from './types'

export default function CommunityTrending() {
  const [pages, setPages] = useState<TrendingPage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/feed/trending', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : { trending: [] })
      .then(data => setPages(data.trending ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-black text-slate-900">Tendencias</h2>
            <p className="text-xs text-slate-500">Páginas con más actividad</p>
          </div>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">En vivo</span>
        </div>

        <div className="space-y-3">
          {loading ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />) : pages.length > 0 ? pages.map((page, index) => (
            <Link key={page.id} href={`/p/${page.slug}`} className="block rounded-2xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
              <p className="text-xs font-bold text-slate-400">#{index + 1} tendencia</p>
              <h3 className="mt-1 line-clamp-1 font-black text-slate-900">{page.title}</h3>
              {page.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{page.description}</p>}
              <div className="mt-3 flex gap-2 text-[11px] font-bold text-slate-500">
                <span>❤️ {page.likes_count}</span><span>💬 {page.comments_count}</span><span>👁️ {page.views_count}</span>
              </div>
            </Link>
          )) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">Aún no hay tendencias.</p>}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <h2 className="font-black text-slate-900">Comunidad segura</h2>
        <p className="mt-2 leading-relaxed">Comparte proyectos, comenta con respeto y reconoce el trabajo de estudiantes y docentes.</p>
      </section>
    </aside>
  )
}
