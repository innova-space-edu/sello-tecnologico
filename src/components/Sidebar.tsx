'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/mis-encuestas', label: 'Mis encuestas', icon: '🗳️' },
  { href: '/admin', label: 'Panel Admin', icon: '👑' },
  { href: '/cursos', label: 'Cursos', icon: '📚' },
  { href: '/proyectos', label: 'Proyectos', icon: '🗂️' },
  { href: '/evidencias', label: 'Evidencias', icon: '📎' },
  { href: '/seguimientos', label: 'Seguimiento', icon: '🧭' },
  { href: '/autoevaluacion', label: 'Autoevaluación', icon: '🌱' },
  { href: '/autoevaluacion/respuestas', label: 'Respuestas autoevaluación', icon: '📝' },
  { href: '/encuestas', label: 'Encuestas', icon: '🗳️' },
  { href: '/vitrinas', label: 'Páginas', icon: '🌐' },
  { href: '/informes', label: 'Informes', icon: '📘' },
  { href: '/usuarios', label: 'Usuarios', icon: '👥' },
  { href: '/usuarios/importar', label: 'Importar alumnos', icon: '⬆️' },
  { href: '/calendario', label: 'Calendario', icon: '📅' },
  { href: '/mensajes', label: 'Mensajes', icon: '💬' },
  { href: '/mis-notificaciones', label: 'Mis avisos', icon: '🔔' },
  { href: '/reportes', label: 'Reportes', icon: '📈' },
  { href: '/notificaciones', label: 'Notificaciones', icon: '📣' },
  { href: '/admin/moderacion', label: 'Moderación', icon: '🚨' },
  { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [rol, setRol] = useState('')
  const [nombre, setNombre] = useState('')
  const [alertasMod, setAlertasMod] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    let modChannel: ReturnType<typeof supabase.channel> | null = null
    let msgChannel: ReturnType<typeof supabase.channel> | null = null

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('profiles').select('role, full_name').eq('id', user.id).single()
      const role = perfil?.role ?? ''
      setRol(role)
      setNombre(perfil?.full_name ?? user.email ?? '')

      if (role === 'admin') {
        const { count } = await supabase
          .from('flagged_messages')
          .select('*', { count: 'exact', head: true })
          .eq('reviewed', false)
        setAlertasMod(count ?? 0)

        modChannel = supabase
          .channel('mod-alerts')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flagged_messages' }, () => {
            setAlertasMod(prev => prev + 1)
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flagged_messages' }, async () => {
            const { count: updatedCount } = await supabase
              .from('flagged_messages')
              .select('*', { count: 'exact', head: true })
              .eq('reviewed', false)
            setAlertasMod(updatedCount ?? 0)
          })
          .subscribe()
      }

      const { count: unread } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false)
      setUnreadMessages(unread ?? 0)

      msgChannel = supabase
        .channel(`unread-msgs-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => {
          setUnreadMessages(prev => prev + 1)
        })
        .subscribe()
    }
    init()

    return () => {
      if (modChannel) supabase.removeChannel(modChannel)
      if (msgChannel) supabase.removeChannel(msgChannel)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-blue-900 text-white p-2.5 rounded-xl shadow-lg">
        {open ? '✕' : '☰'}
        {(alertasMod > 0 || unreadMessages > 0) && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
        )}
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setOpen(false)} />
      )}

      <aside className={`
        fixed left-0 top-0 h-full bg-blue-900 text-white flex flex-col z-40 transition-transform duration-300
        w-64
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="p-6 border-b border-blue-700">
          <div className="text-xs text-blue-300 uppercase tracking-widest mb-1">Colegio Providencia</div>
          <div className="text-lg font-bold text-white leading-tight">Proyectos</div>
        </div>

        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {menu.map((item) => {
            const esAdmin = rol === 'admin'
            const esEstudianteRol = rol === 'estudiante'

            if (item.href === '/admin' && !esAdmin) return null
            if (item.href === '/admin/moderacion' && !esAdmin) return null
            if (item.href === '/notificaciones' && !esAdmin) return null
            if (item.href === '/mis-encuestas' && !esEstudianteRol) return null
            if (item.href === '/usuarios/importar' && esEstudianteRol) return null
            if (item.href === '/usuarios' && esEstudianteRol) return null
            if (item.href === '/reportes' && esEstudianteRol) return null
            if (item.href === '/encuestas' && !['admin', 'docente'].includes(rol)) return null
            if (item.href === '/autoevaluacion/respuestas' && !['admin', 'docente'].includes(rol)) return null

            const active = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))

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
                {esMod && alertasMod > 0 && (
                  <span className="ml-auto flex items-center justify-center bg-red-500 text-white text-xs rounded-full min-w-5 h-5 px-1 font-bold">
                    {alertasMod > 9 ? '9+' : alertasMod}
                  </span>
                )}
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
          {nombre && (
            <div className="flex items-center gap-3 px-3 py-2.5 mb-2 bg-blue-800 rounded-lg">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                {nombre[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{nombre}</p>
                <p className="text-xs text-blue-300 capitalize">{rol}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-blue-200 hover:bg-blue-800 hover:text-white transition-colors">
            <span>🚪</span> Cerrar sesión
          </button>
          <div className="text-xs text-blue-400 mt-2 text-center">Innova Space Education 2026</div>
        </div>
      </aside>

      <div className="hidden lg:block w-64 shrink-0" />
    </>
  )
}
