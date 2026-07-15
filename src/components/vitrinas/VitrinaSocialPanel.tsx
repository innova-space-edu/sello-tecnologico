'use client'

import { useEffect, useMemo, useCallback, useState } from 'react'
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

type Props = {
  slug: string
  theme: string
  accent: string
  textColor?: string
  cardColor?: string
  surfaceStyle?: string
}

function cleanTitle(title: string) {
  return title.startsWith('Vitrina:') ? title.slice(8).trim() : title
}

function panelStyle(cardColor: string, accent: string, surfaceStyle?: string) {
  if (surfaceStyle === 'flat') return { background: cardColor, borderColor: '#e5e7eb', boxShadow: 'none' }
  if (surfaceStyle === 'bordered') return { background: cardColor, borderColor: `${accent}55`, boxShadow: 'none' }
  if (surfaceStyle === 'floating') return { background: cardColor, borderColor: `${accent}22`, boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)' }
  return { background: `${cardColor}f4`, borderColor: `${accent}22`, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }
}

export default function VitrinaSocialPanel({ slug, theme, accent, textColor = '#0f172a', cardColor = '#ffffff', surfaceStyle = 'flat' }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SocialData>({ trending: [] })
  const apiUrl = useMemo(() => `/api/vitrinas/social/${slug}?includeTrending=1&includeComments=0`, [slug])

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const response = await fetch(apiUrl, { cache: 'no-store' })
    if (response.ok) {
      const nextData = await response.json()
      setData({ trending: nextData.trending ?? [] })
    }
    if (!silent) setLoading(false)
  }, [apiUrl])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const handleUpdate = () => refresh(true)
    window.addEventListener('vitrina-social-updated', handleUpdate)
    return () => window.removeEventListener('vitrina-social-updated', handleUpdate)
  }, [refresh])

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 self-start">
      <section className="rounded-3xl border p-5" style={panelStyle(cardColor, accent, surfaceStyle)}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-black" style={{ color: textColor }}>Trending</h2>
            <p className="text-xs" style={{ color: `${textColor}88` }}>Páginas públicas con más actividad</p>
          </div>
          <Link href="/comunidad" className="text-xs px-2 py-1 rounded-full" style={{ background: `${accent}18`, color: accent }}>
            Ver comunidad
          </Link>
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm" style={{ color: `${textColor}88` }}>Cargando tendencias…</p>
          ) : data.trending.length > 0 ? data.trending.map((page, index) => {
            const isCurrent = page.slug === slug
            return (
              <Link
                key={page.id}
                href={`/p/${page.slug}`}
                className="block rounded-2xl border p-3 transition-opacity hover:opacity-90"
                style={{ background: isCurrent ? `${accent}12` : `${cardColor}cc`, borderColor: isCurrent ? `${accent}55` : `${accent}22` }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-bold" style={{ color: `${textColor}88` }}>#{index + 1} tendencia</p>
                  {isCurrent && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${theme}, ${accent})` }}>actual</span>}
                </div>
                <h3 className="font-black line-clamp-1" style={{ color: textColor }}>{cleanTitle(page.title)}</h3>
                {page.description && <p className="text-xs line-clamp-2 mt-1" style={{ color: `${textColor}88` }}>{page.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold" style={{ color: `${textColor}99` }}>
                  <span className="rounded-full px-2 py-1" style={{ background: `${accent}10` }}>❤️ {page.likes_count ?? 0}</span>
                  <span className="rounded-full px-2 py-1" style={{ background: `${accent}10` }}>👁️ {page.views_count ?? 0}</span>
                  <span className="rounded-full px-2 py-1" style={{ background: `${accent}10` }}>💬 {page.comments_count ?? 0}</span>
                </div>
              </Link>
            )
          }) : (
            <div className="rounded-2xl border border-dashed p-4 text-sm" style={{ color: `${textColor}88`, borderColor: `${accent}22` }}>
              Aún no hay páginas públicas con actividad para mostrar.
            </div>
          )}
        </div>
      </section>
    </aside>
  )
}
