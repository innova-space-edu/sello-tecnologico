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
        .select('*, projects(title), courses(id, name), profiles!project_reports_created_by_fkey(full_name), project_report_evaluations(final_grade, earned_points, total_points), project_report_members(user_id)')
        .order('updated_at', { ascending: false })
      setRows(data ?? [])
      setLoading(false)
    }
    void load()
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
    const collaborators = Math.max(0, (row.project_report_members?.length ?? 1) - 1)
    return <Link href={`/informes/${row.id}`} className="block rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-gray-900">{row.title}</h3>
          <p className="mt-1 text-sm text-gray-500">Proyecto: {row.projects?.title ?? 'Sin proyecto'}</p>
          <p className="mt-2 text-xs text-gray-400">Jefe: {row.profiles?.full_name ?? '—'} · {collaborators} colaborador{collaborators === 1 ? '' : 'es'} · Actualizado {new Date(row.updated_at).toLocaleString('es-CL')}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusColor[row.status] ?? statusColor.draft}`}>{statusLabel[row.status] ?? row.status}</span>
      </div>
      {evaluation?.final_grade != null && <div className="mt-4 flex items-center justify-between rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800"><span>Puntaje {evaluation.earned_points}/{evaluation.total_points}</span><strong className="text-lg">Nota {Number(evaluation.final_grade).toFixed(1)}</strong></div>}
    </Link>
  }

  return <div className="flex min-h-screen bg-gray-50">
    <Sidebar />
    <main className="flex-1 p-4 pt-16 lg:ml-64 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Informes de proyecto</h1>
          <p className="mt-1 text-gray-500">{staff ? 'Selecciona un curso para revisar sus informes, comentar bloques y evaluar con rúbrica.' : 'Un integrante crea el informe, agrega al equipo y todos completan el mismo documento compartido.'}</p>
        </div>
        {!staff && <Link href="/informes/nuevo" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700">+ Crear informe</Link>}
      </div>

      {!staff && <section className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl">📝</div>
          <div>
            <h2 className="font-bold text-blue-900">El informe lo crea el grupo</h2>
            <p className="mt-1 text-sm leading-relaxed text-blue-800">Elijan a un integrante para crearlo. Esa persona quedará como jefe y podrá agregar al resto de sus compañeros. Todos verán los mismos bloques, textos, tablas y recursos.</p>
          </div>
        </div>
      </section>}

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
        </div> : <div className="rounded-xl bg-white p-12 text-center text-gray-400">Todavía no hay informes creados por los estudiantes.</div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{filtered.map(row => <ReportCard key={row.id} row={row} />)}</div>
      ) : <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <div className="text-4xl">📄</div>
        <h2 className="mt-3 font-bold text-gray-800">Todavía no participas en un informe</h2>
        <p className="mt-2 text-sm text-gray-500">Crea el informe de tu grupo o pídele al jefe que te agregue como integrante.</p>
        <Link href="/informes/nuevo" className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">Crear primer informe</Link>
      </div>}
    </main>
  </div>
}
