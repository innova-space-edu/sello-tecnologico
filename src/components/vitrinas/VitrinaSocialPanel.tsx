'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type TrendingPage = {
  id: string
  title: string
  slug: string
  description?: string | null
  theme_color?: string | null
  accent_color?: string | null
  likes_count?: number
  views_count?: number
  comments_count?: number
  trend_score?: number
}

type SocialData = {
  trending: TrendingPage[]
}

export default function VitrinaSocialPanel({ slug, theme, accent }: { slug: string; theme: string; accent: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SocialData>({ trending: [] })
  const apiUrl = useMemo(() => `/api/vitrinas/social/${slug}`, [slug])

  useEffect(() => {
    const refresh = async () => {
      setLoading(true)
      const response = await fetch(apiUrl, { cache: 'no-store' })
      if (response.ok) {
        const nextData = await response.json()
        setData({ trending: nextData.trending ?? [] })
      }
      setLoading(false)
    }

    refresh()
  }, [apiUrl])

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 self-start">
      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-black text-slate-900">Trending</h2>
            <p className="text-xs text-slate-400">Páginas públicas con más actividad</p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${accent}18`, color: accent }}>
            Sello Tecnológico
          </span>
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400">Cargando tendencias…</p>
          ) : data.trending.length > 0 ? data.trending.map((page, index) => {
            const isCurrent = page.slug === slug
            return (
              <Link
                key={page.id}
                href={`/p/${page.slug}`}
                className={`block rounded-2xl border p-3 transition-colors ${isCurrent ? 'border-slate-200 bg-slate-50' : 'border-slate-100 hover:bg-slate-50'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-bold text-slate-400">#{index + 1} tendencia</p>
                  {isCurrent && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${theme}, ${accent})` }}>actual</span>}
                </div>
                <h3 className="font-black text-slate-900 line-clamp-1">{page.title.replace(/^Vitrina:\s*/i, '')}</h3>
                {page.description && <p className="text-xs text-slate-500 line-clamp-2 mt-1">{page.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                  <span className="rounded-full bg-white px-2 py-1">❤️ {page.likes_count ?? 0}</span>
                  <span className="rounded-full bg-white px-2 py-1">👁️ {page.views_count ?? 0}</span>
                  <span className="rounded-full bg-white px-2 py-1">💬 {page.comments_count ?? 0}</span>
                </div>
              </Link>
            )
          }) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
              Aún no hay páginas públicas con actividad para mostrar.
            </div>
          )}
        </div>
      </section>
    </aside>
  )
}
