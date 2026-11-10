import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canPublishSurvey, getOnlineSurveyActor, isUuid, normalizeOnlineSurvey } from '@/lib/online-surveys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

async function authorized(params: Params) {
  const { id } = await params.params
  const actor = await getOnlineSurveyActor()
  if (!actor || !isUuid(id)) return { error: 'Sesión o identificador inválido.', status: 401 as const }
  const db = createAdminSupabaseClient()
  const { data: survey, error } = await db.from('online_surveys').select('*').eq('id', id).maybeSingle()
  if (error) return { error: 'No se pudo consultar la encuesta.', status: 503 as const }
  if (!survey || (actor.role !== 'admin' && survey.creator_id !== actor.id)) return { error: 'No autorizado.', status: 403 as const }
  return { actor, db, survey }
}

export async function GET(_request: Request, params: Params) {
  const context = await authorized(params)
  if ('error' in context) return fail(context.error!, context.status!)
  const { db, survey } = context
  const [{ data: responses, error: responseError }, { count, error: countError }] = await Promise.all([
    db.from('online_survey_submissions').select('id,answers,created_at').eq('survey_id', survey.id)
      .order('created_at', { ascending: false }).limit(200),
    db.from('online_survey_submissions').select('id', { count: 'exact', head: true }).eq('survey_id', survey.id),
  ])
  if (responseError || countError) return fail('No fue posible cargar las respuestas.', 503)
  return NextResponse.json({ survey, responses: responses ?? [], total: count ?? 0 }, { headers })
}

export async function PUT(request: Request, params: Params) {
  const context = await authorized(params)
  if ('error' in context) return fail(context.error!, context.status!)
  const { db, survey, actor } = context
  const { count } = await db.from('online_survey_submissions').select('id', { count: 'exact', head: true })
    .eq('survey_id', survey.id)
  if ((count ?? 0) > 0) return fail('No puedes cambiar las preguntas después de recibir respuestas.', 409)
  if (!request.headers.get('content-type')?.includes('application/json')) return fail('Se requiere JSON.', 415)
  const raw = await request.text()
  if (raw.length > 60000) return fail('Formulario demasiado grande.', 413)
  let body: unknown
  try { body = JSON.parse(raw) } catch { return fail('JSON inválido.', 400) }
  const parsed = normalizeOnlineSurvey(body)
  if (!parsed.data) return fail(parsed.error ?? 'Formulario inválido.', 400)
  const status = canPublishSurvey(actor.role) ? 'published' : 'pending_review'
  const { error } = await db.from('online_surveys').update({
    title: parsed.data.title, description: parsed.data.description,
    questions: parsed.data.questions, status,
    reviewed_by: canPublishSurvey(actor.role) ? actor.id : null,
    reviewed_at: canPublishSurvey(actor.role) ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', survey.id)
  if (error) return fail('No fue posible actualizar la encuesta.', 503)
  return NextResponse.json({ ok: true, status }, { headers })
}

export async function PATCH(request: Request, params: Params) {
  const context = await authorized(params)
  if ('error' in context) return fail(context.error!, context.status!)
  const { db, survey, actor } = context
  const body = await request.json().catch(() => null)
  const action = body && typeof body === 'object' && !Array.isArray(body) ? String((body as Record<string, unknown>).action ?? '') : ''
  let status = ''
  if (action === 'approve' && actor.role === 'admin' && ['pending_review','rejected'].includes(survey.status)) status = 'published'
  if (action === 'reject' && actor.role === 'admin' && survey.status === 'pending_review') status = 'rejected'
  if (action === 'close' && survey.status === 'published') status = 'closed'
  if (action === 'reopen' && survey.status === 'closed' && survey.reviewed_at) status = 'published'
  if (action === 'resubmit' && survey.creator_id === actor.id && survey.status === 'rejected') status = 'pending_review'
  if (!status) return fail('Acción no permitida para el estado actual.', 400)

  const moderation = action === 'approve' || action === 'reject'
  const { error } = await db.from('online_surveys').update({
    status,
    updated_at: new Date().toISOString(),
    ...(moderation ? { reviewed_by: actor.id, reviewed_at: new Date().toISOString() } : {}),
  }).eq('id', survey.id).eq('status', survey.status)
  if (error) return fail('No fue posible cambiar el estado.', 503)
  return NextResponse.json({ ok: true, status }, { headers })
}

export async function DELETE(_request: Request, params: Params) {
  const context = await authorized(params)
  if ('error' in context) return fail(context.error!, context.status!)
  const { db, survey } = context
  const { count } = await db.from('online_survey_submissions').select('id', { count: 'exact', head: true }).eq('survey_id', survey.id)
  if ((count ?? 0) > 0) return fail('La encuesta tiene respuestas: ciérrala en lugar de borrarla.', 409)
  const { error } = await db.from('online_surveys').delete().eq('id', survey.id)
  if (error) return fail('No fue posible eliminar.', 503)
  return NextResponse.json({ ok: true }, { headers })
}
