'use client'

import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'

const statusLabel: Record<string, string> = {
  draft: 'Borrador', submitted: 'Enviado', in_review: 'En revisión', changes_requested: 'Cambios solicitados', evaluated: 'Evaluado', finalized: 'Finalizado',
}
const statusColor: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', submitted: 'bg-blue-100 text-blue-700', in_review: 'bg-amber-100 text-amber-700', changes_requested: 'bg-orange-100 text-orange-700', evaluated: 'bg-green-100 text-green-700', finalized: 'bg-purple-100 text-purple-700',
}

export default function InformesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole(profile?.role ?? '')
      const { data } = await supabase
        .from('project_reports')
        .select('*, projects(title), courses(name), profiles!project_reports_created_by_fkey(full_name), project_report_evaluations(final_grade, earned_points, total_points)')
        .order('updated_at', { ascending: false })
      setRows(data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  const staff = ['admin', 'docente', 'coordinador', 'utp'].includes(role)
  const filtered = rows.filter(row => !search || `${row.title} ${row.projects?.title ?? ''} ${row.courses?.name ?? ''}`.toLowerCase().includes(search.toLowerCase()))

  return <div className="flex min-h-screen bg-gray-50">
    <Sidebar />
    <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Informes de proyecto</h1>
          <p className="mt-1 text-gray-500">{staff ? 'Revisa todos los informes, comenta secciones y evalúa con rúbrica.' : 'Crea y edita el informe colaborativo de tu equipo.'}</p>
        </div>
        {!staff && <Link href="/informes/nuevo" className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">📘 + Crear informe</Link>}
      </div>

      <div className="mb-5 rounded-xl bg-white p-4 shadow-sm">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por informe, proyecto o curso" className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>

      {loading ? <div className="rounded-xl bg-white p-12 text-center text-gray-400">Cargando informes…</div> : filtered.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map(row => {
            const evaluation = row.project_report_evaluations?.[0]
            return <Link key={row.id} href={`/informes/${row.id}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-500">{row.courses?.name ?? 'Sin curso'}</p>
                  <h2 className="mt-1 truncate text-lg font-bold text-gray-900">{row.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">Proyecto: {row.projects?.title ?? 'Sin proyecto'}</p>
                  <p className="mt-2 text-xs text-gray-400">Jefe del informe: {row.profiles?.full_name ?? '—'} · Actualizado {new Date(row.updated_at).toLocaleString('es-CL')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusColor[row.status] ?? statusColor.draft}`}>{statusLabel[row.status] ?? row.status}</span>
              </div>
              {evaluation?.final_grade != null && <div className="mt-4 flex items-center justify-between rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800"><span>Puntaje {evaluation.earned_points}/{evaluation.total_points}</span><strong className="text-lg">Nota {Number(evaluation.final_grade).toFixed(1)}</strong></div>}
            </Link>
          })}
        </div>
      ) : <div className="rounded-xl bg-white p-12 text-center text-gray-400">No hay informes disponibles.</div>}
    </main>
  </div>
}
