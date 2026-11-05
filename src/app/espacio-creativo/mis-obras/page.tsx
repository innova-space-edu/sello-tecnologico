import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import MyCreativeWorks from '@/components/creative/MyCreativeWorks'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Mis obras · Espacio creativo',
  description: 'Revisa y corrige el material que subiste a la galería del Sello Tecnológico.',
}

export default async function MisObrasPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles')
    .select('role,blocked').eq('id', user.id).maybeSingle()
  if (!profile || profile.blocked ||
      !['admin', 'docente', 'coordinador', 'utp', 'estudiante'].includes(profile.role)) {
    redirect('/espacio-creativo')
  }

  return (
    <main className="min-h-screen bg-[#090e1b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090e1b]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/espacio-creativo" className="font-black tracking-wide text-white">
            ✦ Sello Tecnológico <span className="ml-2 text-sm font-normal text-slate-400">/ Mis obras</span>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/espacio-creativo" className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold hover:bg-white/20">
              ← Volver a la galería
            </Link>
            <Link href={profile.role === 'admin' ? '/admin' : '/dashboard'}
              className="rounded-full border border-fuchsia-300/30 px-5 py-2.5 text-sm font-bold text-fuchsia-200 hover:bg-white/10">
              {profile.role === 'admin' ? 'Administración' : 'Mi plataforma'}
            </Link>
          </div>
        </div>
      </header>
      <MyCreativeWorks />
    </main>
  )
}
