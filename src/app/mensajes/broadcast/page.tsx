import Sidebar from '@/components/Sidebar'
import EnviarMensajeGrupalModal from '@/components/mensajes/EnviarMensajeGrupalModal'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'
import { redirect } from 'next/navigation'

type Usuario = {
  id: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  curso?: string | null
}

export default async function MensajeGrupalPage() {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')
  if (!['admin', 'docente'].includes(actor.role)) redirect('/mensajes')

  const admin = createAdminSupabaseClient()

  const { data: users } = await admin
    .from('profiles')
    .select('id, full_name, email, role, curso')
    .neq('id', actor.id)
    .order('full_name', { ascending: true })

  const currentUser: Usuario = {
    id: actor.id,
    full_name: actor.full_name,
    email: actor.email,
    role: actor.role,
    curso: actor.curso,
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <section className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm p-6 border border-blue-100">
          <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Mensajes</p>
          <h1 className="text-2xl font-bold text-blue-900 mt-1">Enviar mensaje grupal</h1>
          <p className="text-gray-500 mt-2">
            Selecciona destinatarios, escribe el mensaje y adjunta archivos. El mensaje se enviará de forma individual a cada usuario.
          </p>
        </section>

        <EnviarMensajeGrupalModal
          usuarios={(users ?? []) as Usuario[]}
          currentUser={currentUser}
        />
      </main>
    </div>
  )
}
