import Sidebar from '@/components/Sidebar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

const labelByCategory: Record<string, string> = {
  bullying: 'Hostigamiento / bullying',
  exclusion: 'Exclusion social',
  violence: 'Amenaza o violencia',
  sexual: 'Connotacion sexual',
  sexual_solicitation: 'Solicitud sexual',
  discrimination: 'Discriminacion',
  discriminacion: 'Discriminacion',
  privacy_risk: 'Doxeo / privacidad',
  profanity: 'Insulto o garabato',
  drugs: 'Sustancias',
  self_harm: 'Riesgo de autolesion',
  romance_contact: 'Contacto romantico',
}

const colorBySeverity: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
}

function connotation(item: any) {
  const category = item.category ?? 'profanity'
  const severity = item.severity ?? 'medium'
  const base = labelByCategory[category] ?? category
  if (severity === 'critical') return `${base} · riesgo critico`
  if (severity === 'high') return `${base} · requiere revision prioritaria`
  if (severity === 'medium') return `${base} · alerta preventiva`
  return `${base} · observacion`
}

function pairKey(item: any) {
  return `${item.sender_id}-${item.receiver_id}`
}

export default async function VistaAgresionesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()

  if (perfil?.role !== 'admin') {
    return (
      <div className="flex min-h-screen bg-gray-50"><Sidebar /><main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8"><div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center"><div className="text-4xl mb-3">🚫</div><h2 className="text-lg font-semibold text-red-700">Acceso restringido</h2></div></main></div>
    )
  }

  const { data: flagged } = await supabase
    .from('flagged_messages')
    .select('id, sender_id, receiver_id, content, category, severity, confidence, matched_words, reviewed, created_at, sender:profiles!flagged_messages_sender_id_fkey(full_name, email, curso, role), receiver:profiles!flagged_messages_receiver_id_fkey(full_name, email, curso, role)')
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = flagged ?? []
  const grouped = new Map<string, any>()
  for (const item of rows) {
    const key = pairKey(item)
    const current = grouped.get(key) ?? { key, sender: item.sender, receiver: item.receiver, sender_id: item.sender_id, receiver_id: item.receiver_id, total: 0, pending: 0, categories: new Set<string>(), last: item.created_at, items: [] as any[] }
    current.total += 1
    if (!item.reviewed) current.pending += 1
    current.categories.add(labelByCategory[item.category] ?? item.category)
    current.items.push(item)
    grouped.set(key, current)
  }
  const cases = Array.from(grouped.values()).sort((a, b) => b.pending - a.pending || b.total - a.total)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href="/admin/moderacion" className="text-blue-600 text-sm hover:underline">← Volver a moderacion</Link>
          <div className="mt-3 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-red-500 font-semibold">Convivencia escolar</p>
              <h1 className="text-2xl font-bold text-blue-900 mt-1">Vista de agresiones</h1>
              <p className="text-gray-500 mt-1 text-sm">Resumen por participante, mensaje y connotacion detectada.</p>
            </div>
            <Link href="/admin/mensajes" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">Revisar mensajes completos</Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4"><div className="text-2xl font-bold text-gray-800">{rows.length}</div><div className="text-xs text-gray-500">Alertas totales</div></div>
          <div className="bg-white rounded-xl shadow-sm p-4"><div className="text-2xl font-bold text-red-700">{rows.filter((r: any) => !r.reviewed).length}</div><div className="text-xs text-gray-500">Pendientes</div></div>
          <div className="bg-white rounded-xl shadow-sm p-4"><div className="text-2xl font-bold text-blue-700">{cases.length}</div><div className="text-xs text-gray-500">Conversaciones con alerta</div></div>
          <div className="bg-white rounded-xl shadow-sm p-4"><div className="text-2xl font-bold text-orange-700">{rows.filter((r: any) => ['critical', 'high'].includes(r.severity ?? '')).length}</div><div className="text-xs text-gray-500">Alta prioridad</div></div>
        </div>

        <div className="space-y-4">
          {cases.length > 0 ? cases.map(conv => (
            <section key={conv.key} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-800">{conv.sender?.full_name ?? conv.sender?.email ?? 'Sin nombre'} → {conv.receiver?.full_name ?? conv.receiver?.email ?? 'Sin nombre'}</h2>
                  <p className="text-xs text-gray-500 mt-1">{conv.sender?.curso ?? 'Sin curso'} · {conv.total} alerta(s) · {conv.pending} pendiente(s)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(conv.categories).map((cat: any) => <span key={cat} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{cat}</span>)}
                  <Link href={`/admin/mensajes?sender=${conv.sender_id}&receiver=${conv.receiver_id}`} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-semibold">Abrir conversacion</Link>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {conv.items.slice(0, 5).map((item: any) => (
                  <article key={item.id} className="p-5">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`text-xs border px-2 py-1 rounded-full font-semibold ${colorBySeverity[item.severity ?? 'medium'] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>{item.severity ?? 'sin severidad'}</span>
                      <span className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-1 rounded-full font-semibold">{connotation(item)}</span>
                      {(item.matched_words ?? []).slice(0, 4).map((word: string) => <span key={word} className="text-xs bg-gray-50 text-gray-500 border border-gray-100 px-2 py-1 rounded-full">{word}</span>)}
                    </div>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{item.content}</p>
                    <p className="mt-2 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('es-CL')}</p>
                  </article>
                ))}
              </div>
            </section>
          )) : <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">No hay alertas registradas.</div>}
        </div>
      </main>
    </div>
  )
}
