import Sidebar from '@/components/Sidebar'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'
import { analyzeMessageContent } from '@/lib/moderation-engine'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type SearchParams = Promise<{
  q?: string
  limit?: string
}>

const severityColor: Record<string, string> = {
  none: 'bg-green-50 text-green-700 border-green-100',
  low: 'bg-slate-50 text-slate-700 border-slate-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  high: 'bg-orange-50 text-orange-700 border-orange-100',
  critical: 'bg-red-50 text-red-700 border-red-100',
}

export default async function RegistroMensajeriaPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getSurveyActor()
  if (!actor) redirect('/login')
  if (actor.role !== 'admin') redirect('/dashboard')

  const params = await searchParams
  const q = String(params.q ?? '').trim()
  const limit = Math.min(Math.max(Number(params.limit ?? 300), 50), 1000)

  const admin = createAdminSupabaseClient()

  let query = admin
    .from('messages')
    .select(`
      id,
      content,
      read,
      created_at,
      sender_id,
      receiver_id,
      sender:profiles!messages_sender_id_fkey(full_name, email, curso, role),
      receiver:profiles!messages_receiver_id_fkey(full_name, email, curso, role)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    query = query.ilike('content', `%${q}%`)
  }

  const { data: messages } = await query

  const rows = (messages ?? []).map((message: any) => ({
    ...message,
    moderation: analyzeMessageContent(message.content ?? ''),
  }))

  const risky = rows.filter(row => row.moderation.action !== 'allow')
  const critical = rows.filter(row => row.moderation.severity === 'critical')

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href="/admin/moderacion" className="text-blue-600 text-sm hover:underline">← Volver a Moderación</Link>
          <h1 className="text-2xl font-bold text-blue-900 mt-2">Registro de mensajería y observador</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Revisión de mensajes recientes con el nuevo motor de análisis. Evita falsos positivos como “sexto”.
          </p>
        </div>

        <form className="bg-white rounded-xl shadow-sm p-4 mb-5 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <label className="text-sm font-medium text-gray-700">
            Buscar texto
            <input name="q" defaultValue={q} className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5" placeholder="Buscar palabra o frase" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Límite
            <select name="limit" defaultValue={String(limit)} className="mt-1 border border-gray-300 rounded-xl px-3 py-2.5 bg-white">
              <option value="100">100</option>
              <option value="300">300</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </select>
          </label>
          <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold">Filtrar</button>
        </form>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-400">Mensajes revisados</p>
            <p className="text-2xl font-bold text-slate-900">{rows.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-400">Con alerta</p>
            <p className="text-2xl font-bold text-amber-600">{risky.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-400">Críticos</p>
            <p className="text-2xl font-bold text-red-600">{critical.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-400">Seguro</p>
            <p className="text-2xl font-bold text-green-600">{rows.length - risky.length}</p>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Riesgo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Mensaje</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">De / Para</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Coincidencias</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((message: any) => (
                  <tr key={message.id} className="hover:bg-blue-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs border rounded-full px-2 py-1 font-semibold ${severityColor[message.moderation.severity] ?? severityColor.none}`}>
                        {message.moderation.severity}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{message.moderation.action}</p>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p><strong>De:</strong> {message.sender?.full_name ?? message.sender?.email ?? '—'} {message.sender?.curso ? `(${message.sender.curso})` : ''}</p>
                      <p><strong>Para:</strong> {message.receiver?.full_name ?? message.receiver?.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {message.moderation.matchedWords.length > 0
                          ? message.moderation.matchedWords.map((word: string) => <span key={word} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">{word}</span>)
                          : <span className="text-xs text-gray-400">Sin coincidencias</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(message.created_at).toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
