import Sidebar from '@/components/Sidebar'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Params = {
  params: Promise<{ id: string }>
}

export default async function ReporteEstudiantePage({ params }: Params) {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')
  if (!['admin', 'docente', 'coordinador', 'utp'].includes(actor.role)) redirect('/dashboard')

  const { id } = await params
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, curso, role')
    .eq('id', id)
    .single()

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="max-w-4xl mx-auto space-y-5">
          <Link href="/reportes" className="text-blue-600 text-sm hover:underline">← Volver a reportes</Link>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Informe integral</p>
            <h1 className="text-2xl font-bold text-blue-900 mt-2">
              {profile?.full_name ?? profile?.email ?? 'Estudiante no encontrado'}
            </h1>
            <p className="text-slate-500 mt-1">
              {profile?.email ?? 'Sin correo'} · {profile?.curso ?? 'Sin curso'} · {profile?.role ?? 'Sin rol'}
            </p>
            <p className="text-sm text-slate-500 mt-4">
              Esta vista queda lista para conectar proyectos, evidencias, seguimientos, encuestas, portafolio, mensajes y alertas en una ficha integral.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href={`/api/reportes/estudiante/${id}`}
              target="_blank"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-4 text-sm font-semibold text-center"
            >
              Descargar datos JSON del estudiante
            </a>
            <Link
              href="/admin/moderacion"
              className="bg-white hover:bg-blue-50 border border-blue-100 text-blue-700 rounded-xl px-5 py-4 text-sm font-semibold text-center"
            >
              Ver moderación y alertas
            </Link>
          </section>
        </div>
      </main>
    </div>
  )
}
