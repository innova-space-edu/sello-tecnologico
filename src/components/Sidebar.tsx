'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/cursos', label: 'Cursos', icon: '📚' },
  { href: '/proyectos', label: 'Proyectos', icon: '🗂️' },
  { href: '/evidencias', label: 'Evidencias', icon: '📎' },
  { href: '/usuarios', label: 'Usuarios', icon: '👥' },
  { href: '/reportes', label: 'Reportes', icon: '📈' },
  { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 min-h-screen bg-blue-900 text-white flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-blue-700">
        <div className="text-xs text-blue-300 uppercase tracking-widest mb-1">Colegio Providencia</div>
        <div className="text-lg font-bold text-white leading-tight">Sello Tecnológico</div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {menu.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              }`}>
              <span>{item.icon}</span>{item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-blue-700">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-blue-200 hover:bg-blue-800 hover:text-white transition-colors">
          <span>🚪</span> Cerrar sesión
        </button>
        <div className="text-xs text-blue-400 mt-4 text-center">Innova Space Education 2026</div>
      </div>
    </aside>
  )
}
