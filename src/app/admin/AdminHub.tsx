'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Summary = {
  authorizations: { total: number; pending: number; approved: number }
  acts: { total: number; official: number }
  moderation: { pending: number }
}

const sections = [
  {
    title: 'Seguridad y autorizaciones',
    description: 'Control institucional, consentimientos y revisión de contenido.',
    links: [
      { href: '/admin/autorizaciones-familiares', icon: '🛡️', title: 'Autorizaciones', subtitle: 'Solicitudes, firmas, decisiones y pendientes', counter: 'authPending' },
      { href: '/admin/actas-familiares', icon: '📜', title: 'Archivo de actas', subtitle: 'Folios, aprobaciones, revocaciones e historial', counter: 'acts' },
      { href: '/admin/moderacion', icon: '🚨', title: 'Moderación', subtitle: 'Alertas, incidentes y revisión de mensajes', counter: 'moderation' },
      { href: '/admin/espacio-creativo', icon: '🖼️', title: 'Revisión de galería', subtitle: 'Aprobar, rechazar o retirar obras', counter: '' },
      { href: '/admin/encuestas-online', icon: '📋', title: 'Encuestas públicas', subtitle: 'Revisar y aprobar formularios creados por estudiantes', counter: '' },
    ],
  },
  {
    title: 'Personas y gestión académica',
    description: 'Gestión de integrantes, actividades y reportes institucionales.',
    links: [
      { href: '/usuarios', icon: '👥', title: 'Usuarios', subtitle: 'Consultar, editar y bloquear cuentas', counter: '' },
      { href: '/usuarios/importar', icon: '⬆️', title: 'Importar alumnos', subtitle: 'Incorporar estudiantes de manera masiva', counter: '' },
      { href: '/reportes', icon: '📈', title: 'Reportes', subtitle: 'Indicadores y resultados educativos', counter: '' },
      { href: '/admin/proyectos', icon: '🗂️', title: 'Administrar proyectos', subtitle: 'Gestionar trabajos de toda la plataforma', counter: '' },
    ],
  },
  {
    title: 'Comunicación y configuración',
    description: 'Mensajes, notificaciones y herramientas de administración.',
    links: [
      { href: '/mis-notificaciones', icon: '🔔', title: 'Mis avisos', subtitle: 'Avisos personales de la cuenta administradora', counter: '' },
      { href: '/notificaciones', icon: '📣', title: 'Notificaciones globales', subtitle: 'Publicar y gestionar avisos generales', counter: '' },
      { href: '/admin/mensajes', icon: '💬', title: 'Monitoreo de mensajes', subtitle: 'Revisión institucional de conversaciones', counter: '' },
      { href: '/configuracion', icon: '⚙️', title: 'Configuración', subtitle: 'Parámetros de la plataforma', counter: '' },
    ],
  },
] as const

export default function AdminHub() {
  const [summary, setSummary] = useState<Summary | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/admin/registros-resumen', { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted && data) setSummary(data as Summary) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const badge = (key: string): string | null => {
    if (!summary) return null
    if (key === 'authPending') return `${summary.authorizations.pending} pendientes`
    if (key === 'acts') return `${summary.acts.official} oficiales`
    if (key === 'moderation') return `${summary.moderation.pending} por revisar`
    return null
  }

  return (
    <section aria-label="Centro de administración de CreaLab" className="mb-7 space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-950 to-blue-800 px-5 py-5 text-white">
        <h2 className="text-lg font-bold">Centro de control de CreaLab</h2>
        <p className="mt-1 text-sm text-blue-100">Los accesos de administración se concentran aquí. Las herramientas de proyectos para docentes y estudiantes permanecen en el menú lateral.</p>
        {summary && <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/15 px-3 py-1.5">{summary.authorizations.total} autorizaciones registradas</span>
          <span className="rounded-full bg-amber-400/20 px-3 py-1.5">{summary.authorizations.pending} por revisar</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5">{summary.acts.total} actas archivadas</span>
        </div>}
      </div>
      {sections.map(section => (
        <div key={section.title} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <h3 className="font-bold text-blue-950">{section.title}</h3>
          <p className="mt-1 text-xs text-gray-500">{section.description}</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {section.links.map(link => (
              <Link key={link.href} href={link.href}
                className="group flex min-h-32 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                <div className="flex items-start justify-between gap-2">
                  <span aria-hidden="true" className="text-2xl">{link.icon}</span>
                  <span className="text-blue-600 transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900">{link.title}</h4>
                <p className="mt-1 text-xs leading-5 text-slate-600">{link.subtitle}</p>
                {badge(link.counter) && <span className="mt-2 self-start rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-900">{badge(link.counter)}</span>}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
