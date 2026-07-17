import 'server-only'

import { ImageResponse } from 'next/og'
import type { SharePreview } from '@/lib/share-preview'

const iconByKind: Record<SharePreview['mediaKind'], string> = {
  image: '🖼️',
  video: '▶',
  audio: '🎙️',
  document: '📄',
  page: '🌐',
  story: '✨',
  post: '📝',
}

function shorten(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value
}

export function createShareImage(preview: SharePreview) {
  const theme = preview.theme || '#1d4ed8'
  const accent = preview.accent || '#7c3aed'
  const icon = iconByKind[preview.mediaKind]
  const title = shorten(preview.title, 95)
  const description = shorten(preview.description, 180)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${theme}, ${accent})`,
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {preview.imageUrl ? (
          <img
            src={preview.imageUrl}
            alt=""
            width="1200"
            height="630"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.22), transparent 35%), radial-gradient(circle at 80% 75%, rgba(255,255,255,.16), transparent 32%)',
            }}
          />
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background: preview.imageUrl
              ? 'linear-gradient(90deg, rgba(2,6,23,.93) 0%, rgba(2,6,23,.76) 46%, rgba(2,6,23,.22) 100%)'
              : 'linear-gradient(135deg, rgba(2,6,23,.18), rgba(2,6,23,.46))',
          }}
        />

        {preview.mediaKind === 'video' && (
          <div
            style={{
              position: 'absolute',
              right: 72,
              top: 190,
              width: 180,
              height: 180,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,.92)',
              color: theme,
              fontSize: 90,
              paddingLeft: 10,
              boxShadow: '0 24px 60px rgba(0,0,0,.35)',
            }}
          >
            ▶
          </div>
        )}

        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '58px 68px 52px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 68,
                height: 68,
                borderRadius: 20,
                background: 'rgba(255,255,255,.94)',
                color: theme,
                fontSize: 34,
                fontWeight: 900,
              }}
            >
              {icon}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>Sello Tecnológico</div>
              <div style={{ fontSize: 18, opacity: 0.82 }}>Colegio Providencia</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: preview.mediaKind === 'video' ? 820 : 980 }}>
            <div
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                borderRadius: 999,
                padding: '10px 18px',
                background: 'rgba(255,255,255,.18)',
                border: '1px solid rgba(255,255,255,.28)',
                fontSize: 18,
                fontWeight: 800,
                marginBottom: 18,
              }}
            >
              {preview.label}
            </div>
            <div style={{ fontSize: 58, lineHeight: 1.04, fontWeight: 950, letterSpacing: -1.5 }}>
              {title}
            </div>
            <div style={{ marginTop: 18, fontSize: 25, lineHeight: 1.35, opacity: 0.9 }}>
              {description}
            </div>
            {preview.author && (
              <div style={{ marginTop: 20, fontSize: 20, fontWeight: 800, opacity: 0.82 }}>
                Publicado por {preview.author}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, opacity: 0.78 }}>
            <span>sello-tecnologico.vercel.app</span>
            <span>Proyectos que inspiran</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  )
}
