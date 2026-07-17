import type { Metadata } from 'next'
import './globals.css'
import MiraChat from '@/components/MiraChat'
import NotificationBanner from '@/components/NotificationBanner'
import ProviChat from '@/components/ProviChat'
import AccessTracker from '@/components/AccessTracker'
import FollowupRealtimeMount from '@/components/seguimientos/FollowupRealtimeMount'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://sello-tecnologico.vercel.app')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Sello Tecnológico – Colegio Providencia',
    template: '%s | Sello Tecnológico',
  },
  description: 'Plataforma de gestión del Sello Tecnológico',
  applicationName: 'Sello Tecnológico',
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    siteName: 'Sello Tecnológico — Colegio Providencia',
    title: 'Sello Tecnológico – Colegio Providencia',
    description: 'Proyectos, historias, publicaciones y páginas creadas por nuestra comunidad educativa.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Sello Tecnológico — Colegio Providencia' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sello Tecnológico – Colegio Providencia',
    description: 'Proyectos, historias, publicaciones y páginas creadas por nuestra comunidad educativa.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <NotificationBanner />
        <AccessTracker />
        <FollowupRealtimeMount />
        {children}
        <ProviChat />
        <MiraChat />
      </body>
    </html>
  )
}
