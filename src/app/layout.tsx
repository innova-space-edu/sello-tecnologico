import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import MiraChat from '@/components/MiraChat'
import NotificationBanner from '@/components/NotificationBanner'
import ProviChat from '@/components/ProviChat'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sello Tecnológico – Colegio Providencia',
  description: 'Plataforma de gestión del Sello Tecnológico',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <NotificationBanner />
        {children}
        <ProviChat />
        <MiraChat />
      </body>
    </html>
  )
}
