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
  const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole(profile?.role ?? '')
      const { data } = await supabase
        .from('project_reports')
        .select('*, projects(title), courses(id, name), profiles!project_reports_created_by_fkey(full_name), project_report_evaluations(final_grade, earned_points, total_points)')
        .order('updated_at', { ascending: false })
      setRows(data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  const staff = ['admin', 'docente', 'coordinador', 'utp'].includes(role)
  const filtered = rows.filter(row => !search || `${row.title} ${row.projects?.title ?? ''} ${row.courses?.name ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const grouped = filtered.reduce<Record<string, { id: string; name: string; reports: any[] }>>((acc, row) => {
    const id = row.courses?.id ?? 'sin-curso'
    if (!acc[id]) acc[id] = { id, name: row.courses?.name ?? 'Sin curso asignado', reports: [] }
    acc[id].reports.push(row)
    return acc
  }, {})
  const courses = Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const ReportCard = ({ row }: { row: any }) => {
    const evaluation = row.project_report_evaluations?.[0]
    return <Link href={`/informes/${row.id}`} className="block rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-gray-900">{row.title}</h3>
          <p className="mt-1 text-sm text-gray-500">Proyecto: {row.projects?.title ?? 'Sin proyecto'}</p>
          <p className="mt-2 text-xs text-gray-400">Jefe del informe: {row.profiles?.full_name ?? '—'} · Actualizado {new Date(row.updated_at).toLocaleString('es-CL')}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusColor[row.status] ?? statusColor.draft}`}>{statusLabel[row.status] ?? row.status}</span>
      </div>
      {evaluation?.final_grade != null && <div className="mt-4 flex items-center justify-between rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800"><span>Puntaje {evaluation.earned_points}/{evaluation.total_points}</span><strong className="text-lg">Nota {Number(evaluation.final_grade).toFixed(1)}</strong></div>}
    </Link>
  }

  return <div className="flex min-h-screen bg-gray-50">
    <Sidebar />
    <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-blue-900">Informes de proyecto</h1>
        <p className="mt-1 text-gray-500">{staff ? 'Selecciona un curso para revisar sus informes, comentar secciones y evaluar con rúbrica.' : 'Los informes se crean automáticamente junto con cada proyecto y se editan en equipo.'}</p>
      </div>

      <div className="mb-5 rounded-xl bg-white p-4 shadow-sm">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por informe, proyecto o curso" className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>

      {loading ? <div className="rounded-xl bg-white p-12 text-center text-gray-400">Cargando informes…</div> : staff ? (
        courses.length ? <div className="space-y-4">
          {courses.map(course => {
            const open = openCourses[course.id] ?? Boolean(search)
            const pending = course.reports.filter(report => ['submitted', 'in_review', 'changes_requested'].includes(report.status)).length
            return <section key={course.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <button type="button" onClick={() => setOpenCourses(prev => ({ ...prev, [course.id]: !open }))} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left hover:bg-blue-50">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-2xl">📚</div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-blue-900">{course.name}</h2>
                    <p className="text-sm text-gray-500">{course.reports.length} informe{course.reports.length === 1 ? '' : 's'}{pending ? ` · ${pending} pendiente${pending === 1 ? '' : 's'} de revisión` : ''}</p>
                  </div>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">{open ? 'Cerrar ▲' : 'Ver informes ▼'}</span>
              </button>
              {open && <div className="grid grid-cols-1 gap-4 border-t border-gray-100 bg-gray-50 p-4 xl:grid-cols-2">{course.reports.map(row => <ReportCard key={row.id} row={row} />)}</div>}
            </section>
          })}
        </div> : <div className="rounded-xl bg-white p-12 text-center text-gray-400">No hay informes disponibles.</div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{filtered.map(row => <ReportCard key={row.id} row={row} />)}</div>
      ) : <div className="rounded-xl bg-white p-12 text-center text-gray-400">No hay informes disponibles.</div>}
    </main>
  </div>
}
