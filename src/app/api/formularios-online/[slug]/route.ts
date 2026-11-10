import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { isUuid, validateOnlineAnswers, type OnlineQuestion } from '@/lib/online-surveys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ slug: string }> }
const headers = { 'Cache-Control': 'no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

async function publishedSurvey(slug: string) {
  if (!/^[a-z0-9-]{10,80}$/.test(slug)) return null
  const db = createAdminSupabaseClient()
  const { data, error } = await db.from('online_surveys')
    .select('id,slug,title,description,questions,status').eq('slug', slug).maybeSingle()
  if (error || !data || data.status !== 'published') return null
  return data
}

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params
  const survey = await publishedSurvey(slug)
  if (!survey) return fail('Este formulario no está publicado o ya se cerró.', 404)
  const { id: _internalId, status: _status, ...publicSurvey } = survey
  return NextResponse.json({ survey: publicSurvey }, { headers })
}

export async function POST(request: Request, { params }: Params) {
  if (!request.headers.get('content-type')?.includes('application/json')) return fail('Se requiere JSON.', 415)
  const { slug } = await params
  const survey = await publishedSurvey(slug)
  if (!survey) return fail('Esta encuesta no recibe respuestas.', 404)
  const raw = await request.text()
  if (raw.length > 42000) return fail('Las respuestas son demasiado extensas.', 413)
  let body: unknown
  try { body = JSON.parse(raw) } catch { return fail('JSON inválido.', 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Datos inválidos.', 400)
  const payload = body as Record<string, unknown>
  if (!isUuid(payload.token)) return fail('Identificador de envío inválido.', 400)
  const validation = validateOnlineAnswers(survey.questions as OnlineQuestion[], payload.answers)
  if (!validation.answers) return fail(validation.error ?? 'Revisa las respuestas.', 400)

  const db = createAdminSupabaseClient()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() || ''
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
  const sourceHash = ip && secret ? createHmac('sha256', secret).update(slug + ':' + ip).digest('hex') : null

  // Límite por enlace y dirección seudonimizada; permite clases completas
  // desde la misma red. Nunca se almacena la dirección IP original.
  if (sourceHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error } = await db.from('online_survey_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', survey.id).eq('source_hash', sourceHash).gte('created_at', since)
    if (error) return fail('No fue posible verificar el límite de respuestas.', 503)
    if ((count ?? 0) >= 500) return fail('Se alcanzó el límite de respuestas desde esta red. Intenta más tarde.', 429)
  }

  const { error } = await db.from('online_survey_submissions').insert({
    survey_id: survey.id, respondent_token: payload.token,
    answers: validation.answers, source_hash: sourceHash,
  })
  if (error) {
    if (error.code === '23505') return fail('Ya recibimos una respuesta desde este dispositivo para esta encuesta.', 409)
    return fail('No fue posible guardar la respuesta.', 503)
  }
  return NextResponse.json({ ok: true }, { status: 201, headers })
}
