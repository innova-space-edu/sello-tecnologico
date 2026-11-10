import type { Metadata } from 'next'
import './globals.css'
import MiraChat from '@/components/MiraChat'
import NotificationBanner from '@/components/NotificationBanner'
import LegacyConsentCountdown from '@/components/legal/LegacyConsentCountdown'
import ProviChat from '@/components/ProviChat'
import AccessTracker from '@/components/AccessTracker'
import FollowupRealtimeMount from '@/components/seguimientos/FollowupRealtimeMount'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://sello-tecnologico.vercel.app')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CreaLab – Laboratorio de Proyectos Educativos',
    template: '%s | CreaLab',
  },
  description: 'CreaLab: crea, desarrolla, documenta y comparte proyectos educativos',
  applicationName: 'CreaLab',
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    siteName: 'CreaLab — Innova Space Education',
    title: 'CreaLab – Laboratorio de Proyectos Educativos',
    description: 'Proyectos, historias, publicaciones y páginas creadas por nuestra comunidad educativa.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'CreaLab — Innova Space Education' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CreaLab – Laboratorio de Proyectos Educativos',
    description: 'Proyectos, historias, publicaciones y páginas creadas por nuestra comunidad educativa.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <LegacyConsentCountdown policyHref="/proteccion-datos" />
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
