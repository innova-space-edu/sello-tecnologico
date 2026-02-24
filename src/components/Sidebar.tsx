'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

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
  { href: '/admin/moderacion', label: 'Moderación', icon: '🚨' },
  { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [rol, setRol] = useState('')
  const [alertasMod, setAlertasMod] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      setRol(perfil?.role ?? '')

      if (perfil?.role === 'admin') {
        // Contar alertas de moderación pendientes
        const { count } = await supabase
          .from('flagged_messages')
          .select('*', { count: 'exact', head: true })
          .eq('reviewed', false)
        setAlertasMod(count ?? 0)

        // Suscribir a nuevas alertas en tiempo real
        const modChannel = supabase
          .channel('mod-alerts')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flagged_messages' }, () => {
            setAlertasMod(prev => prev + 1)
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flagged_messages' }, async () => {
            const { count } = await supabase
              .from('flagged_messages')
              .select('*', { count: 'exact', head: true })
              .eq('reviewed', false)
            setAlertasMod(count ?? 0)
          })
          .subscribe()

        return () => { supabase.removeChannel(modChannel) }
      }

      // Contar mensajes no leídos para todos
      const { count: unread } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false)
      setUnreadMessages(unread ?? 0)

      const msgChannel = supabase
        .channel('unread-msgs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `receiver_id=eq.${user.id}` }, () => {
          setUnreadMessages(prev => prev + 1)
        })
        .subscribe()

      return () => { supabase.removeChannel(msgChannel) }
    }
    init()
  }, [])

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
        {(alertasMod > 0 || unreadMessages > 0) && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
        )}
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
            // Ocultar moderación a no-admins
            if (item.href === '/admin/moderacion' && rol !== 'admin') return null
            if (item.href === '/admin' && rol !== 'admin') return null
            if (item.href === '/usuarios/importar' && rol === 'estudiante') return null
            if (item.href === '/notificaciones' && rol === 'estudiante') return null
            if (item.href === '/historial' && rol === 'estudiante') return null

            const active = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))

            // Badges de alerta
            const esMod = item.href === '/admin/moderacion'
            const esMensajes = item.href === '/mensajes'

            return (
              <Link key={item.href} href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                  active ? 'bg-blue-600 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`}>
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>

                {/* Punto rojo moderación */}
                {esMod && alertasMod > 0 && (
                  <span className="ml-auto flex items-center justify-center bg-red-500 text-white text-xs rounded-full min-w-5 h-5 px-1 font-bold">
                    {alertasMod > 9 ? '9+' : alertasMod}
                  </span>
                )}

                {/* Punto rojo mensajes */}
                {esMensajes && unreadMessages > 0 && (
                  <span className="ml-auto flex items-center justify-center bg-red-500 text-white text-xs rounded-full min-w-5 h-5 px-1 font-bold">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
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

      <div className="hidden lg:block w-64 shrink-0" />
    </>
  )
}
