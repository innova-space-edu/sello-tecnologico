import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canPublishSurvey, getOnlineSurveyActor, makeOnlineSlug, normalizeOnlineSurvey } from '@/lib/online-surveys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

export async function GET() {
  const actor = await getOnlineSurveyActor()
  if (!actor) return fail('Inicia sesión para ver tus encuestas.', 401)
  const db = createAdminSupabaseClient()
  const { data, error } = await db.from('online_surveys')
    .select('id,title,slug,description,status,created_at,updated_at,online_survey_submissions(count)')
    .eq('creator_id', actor.id).order('created_at', { ascending: false }).limit(100)
  if (error) return fail('No se pudo consultar el listado.', 503)
  return NextResponse.json({ surveys: data ?? [] }, { headers })
}

export async function POST(request: Request) {
  const actor = await getOnlineSurveyActor()
  if (!actor) return fail('Inicia sesión con una cuenta habilitada.', 401)
  if (!request.headers.get('content-type')?.includes('application/json')) return fail('Se requiere JSON.', 415)
  const raw = await request.text()
  if (raw.length > 60000) return fail('El formulario supera el tamaño máximo.', 413)
  let body: unknown
  try { body = JSON.parse(raw) } catch { return fail('JSON inválido.', 400) }
  const parsed = normalizeOnlineSurvey(body)
  if (!parsed.data) return fail(parsed.error ?? 'Formulario inválido.', 400)
  const db = createAdminSupabaseClient()

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const [{ count: hourly, error: rateError }, { count: total, error: totalError }] = await Promise.all([
    db.from('online_surveys').select('id', { count: 'exact', head: true }).eq('creator_id', actor.id).gte('created_at', since),
    db.from('online_surveys').select('id', { count: 'exact', head: true }).eq('creator_id', actor.id),
  ])
  if (rateError || totalError) return fail('No fue posible comprobar el límite de encuestas.', 503)
  if ((hourly ?? 0) >= 10 || (total ?? 0) >= 150) return fail('Alcanzaste el límite de encuestas. Contacta a administración.', 429)

  const status = canPublishSurvey(actor.role) ? 'published' : 'pending_review'
  const { data, error } = await db.from('online_surveys').insert({
    creator_id: actor.id,
    title: parsed.data.title,
    description: parsed.data.description,
    slug: makeOnlineSlug(parsed.data.title),
    questions: parsed.data.questions,
    status,
    reviewed_by: canPublishSurvey(actor.role) ? actor.id : null,
    reviewed_at: canPublishSurvey(actor.role) ? new Date().toISOString() : null,
  }).select('id,slug,status').single()
  if (error || !data) return fail('No fue posible crear la encuesta.', 503)
  return NextResponse.json(data, { status: 201, headers })
}
