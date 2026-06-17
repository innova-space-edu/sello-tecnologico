import Sidebar from '@/components/Sidebar'
import { getSurveyActor } from '@/lib/survey-auth'
import { buildStudentReport } from '@/lib/student-report'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function Card({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
      <div className="text-xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-blue-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export default async function ReporteEstudiantePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')
  if (!['admin', 'docente', 'coordinador', 'utp'].includes(actor.role)) redirect('/dashboard')

  const { id } = await params
  const report = await buildStudentReport(id)

  if (!report.profile) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
          <p className="text-slate-500">Estudiante no encontrado.</p>
        </main>
      </div>
    )
  }

  const p = report.profile

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
            <Link href="/reportes" className="text-blue-600 text-sm hover:underline">← Volver a reportes</Link>
            <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold mt-4">Informe integral del estudiante</p>
            <h1 className="text-2xl font-bold text-blue-900 mt-1">{p.full_name ?? p.email ?? 'Estudiante'}</h1>
            <p className="text-slate-500 mt-1">{p.email ?? 'Sin correo'} · {p.curso ?? 'Sin curso'} · {p.role ?? 'Sin rol'}</p>
          </div>
          <a
            href={`/api/reportes/estudiante/${p.id}`}
            target="_blank"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold text-center"
          >
            Descargar JSON
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-10 gap-3 mb-6">
          <Card label="Proyectos" value={report.stats.projects} icon="🗂️" />
          <Card label="Evidencias" value={report.stats.evidences} icon="📎" />
          <Card label="Seguimientos" value={report.stats.followups} icon="🧭" />
          <Card label="Encuestas" value={report.stats.surveyResponses} icon="🗳️" />
          <Card label="Portafolios" value={report.stats.portfolios} icon="📋" />
          <Card label="Autoevaluaciones" value={report.stats.selfEvaluations} icon="🌱" />
          <Card label="Mensajes enviados" value={report.stats.sentMessages} icon="📤" />
          <Card label="Mensajes recibidos" value={report.stats.receivedMessages} icon="📥" />
          <Card label="Alertas" value={report.stats.flaggedMessages} icon="🚨" />
          <Card label="Accesos" value={report.stats.accessLogs} icon="🛂" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-5">
            <Section title="Línea de tiempo del estudiante">
              {report.timeline.length > 0 ? (
                <div className="space-y-3">
                  {report.timeline.slice(0, 80).map((item, index) => (
                    <div key={`${item.type}-${item.date}-${index}`} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 font-semibold">{item.type}</span>
                        <span className="text-xs text-slate-400">{new Date(item.date).toLocaleString('es-CL')}</span>
                      </div>
                      <p className="font-semibold text-slate-800">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin actividad registrada.</p>
              )}
            </Section>

            <Section title="Proyectos y evidencias">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2">Proyectos</h3>
                  <div className="space-y-2">
                    {report.ownedProjects.slice(0, 20).map((item: any) => (
                      <div key={item.id} className="bg-slate-50 rounded-lg p-3">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.status ?? 'Sin estado'} · {item.courses?.name ?? 'Sin curso'}</p>
                      </div>
                    ))}
                    {report.ownedProjects.length === 0 && <p className="text-sm text-slate-400">Sin proyectos creados.</p>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2">Evidencias</h3>
                  <div className="space-y-2">
                    {report.evidences.slice(0, 20).map((item: any) => (
                      <div key={item.id} className="bg-slate-50 rounded-lg p-3">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.evidencia_tipo ?? item.type ?? 'Sin tipo'} · {item.projects?.title ?? 'Sin proyecto'}</p>
                      </div>
                    ))}
                    {report.evidences.length === 0 && <p className="text-sm text-slate-400">Sin evidencias subidas.</p>}
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <div className="space-y-5">
            <Section title="Convivencia y seguridad">
              {report.flaggedMessages.length > 0 ? (
                <div className="space-y-2">
                  {report.flaggedMessages.slice(0, 20).map((item: any) => (
                    <div key={item.id} className="bg-red-50 border border-red-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-700">{item.category} · {item.severity ?? 'sin severidad'}</p>
                      <p className="text-sm text-slate-700 mt-1 line-clamp-3">{item.content}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.reviewed ? 'Revisada' : 'Pendiente'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin alertas registradas.</p>
              )}
            </Section>

            <Section title="Encuestas y autoevaluaciones">
              <div className="space-y-2">
                {report.surveyResponses.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="bg-slate-50 rounded-lg p-3">
                    <p className="font-medium">{item.surveys?.title ?? 'Encuesta'}</p>
                    <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString('es-CL')}</p>
                  </div>
                ))}
                {report.selfEvaluations.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="bg-green-50 rounded-lg p-3">
                    <p className="font-medium">{item.project_name ?? 'Autoevaluación'}</p>
                    <p className="text-xs text-slate-500">{item.intervention_place ?? 'Sin lugar'} · {new Date(item.created_at).toLocaleDateString('es-CL')}</p>
                  </div>
                ))}
                {report.surveyResponses.length === 0 && report.selfEvaluations.length === 0 && (
                  <p className="text-sm text-slate-400">Sin respuestas registradas.</p>
                )}
              </div>
            </Section>

            <Section title="Portafolio y accesos">
              <p className="text-sm text-slate-600">Portafolios: <strong>{report.portfolios.length}</strong></p>
              <p className="text-sm text-slate-600">Eventos de acceso: <strong>{report.accessLogs.length}</strong></p>
            </Section>
          </div>
        </div>
      </main>
    </div>
  )
}
