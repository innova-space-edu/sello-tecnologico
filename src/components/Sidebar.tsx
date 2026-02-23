'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin', label: 'Panel Admin', icon: '👑' },
  { href: '/cursos', label: 'Cursos', icon: '📚' },
  { href: '/proyectos', label: 'Proyectos', icon: '🗂️' },
  { href: '/evidencias', label: 'Evidencias', icon: '📎' },
  { href: '/usuarios', label: 'Usuarios', icon: '👥' },
  { href: '/usuarios/importar', label: 'Importar alumnos', icon: '⬆️' },
  { href: '/calendario', label: 'Calendario', icon: '📅' },
  { href: '/mensajes', label: 'Mensajes', icon: '💬' },
  { href: '/portafolio', label: 'Portafolio', icon: '📋' },
  { href: '/reportes', label: 'Reportes', icon: '📈' },
  { href: '/historial', label: 'Historial', icon: '🕐' },
  { href: '/notificaciones', label: 'Notificaciones', icon: '🔔' },
  { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
  { href: '/admin/moderacion', label: 'Moderación', icon: '🚨' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Botón hamburguesa móvil */}
      <button onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-blue-900 text-white p-2.5 rounded-xl shadow-lg">
        {open ? '✕' : '☰'}
      </button>

      {/* Overlay móvil */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-full bg-blue-900 text-white flex flex-col z-40 transition-transform duration-300
        w-64
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="p-6 border-b border-blue-700">
          <div className="text-xs text-blue-300 uppercase tracking-widest mb-1">Colegio Providencia</div>
          <div className="text-lg font-bold text-white leading-tight">Sello Tecnológico</div>
        </div>

        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {menu.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`}>
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-blue-700">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-blue-200 hover:bg-blue-800 hover:text-white transition-colors">
            <span>🚪</span> Cerrar sesión
          </button>
          <div className="text-xs text-blue-400 mt-3 text-center">Innova Space Education 2026</div>
        </div>
      </aside>

      {/* Espaciador desktop */}
      <div className="hidden lg:block w-64 shrink-0" />
    </>
  )
}
