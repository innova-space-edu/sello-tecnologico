import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canReadSurvey, getSurveyActor } from '@/lib/survey-auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminSupabaseClient()
  const { data: response } = await admin
    .from('survey_responses')
    .select('id, survey_id')
    .eq('id', id)
    .single()

  if (!response) return NextResponse.json({ error: 'Respuesta no encontrada' }, { status: 404 })
  if (!(await canReadSurvey(actor, response.survey_id))) {
    return NextResponse.json({ error: 'No tienes permiso para retroalimentar esta respuesta.' }, { status: 403 })
  }

  const body = await request.json()
  const feedback = String(body.feedback ?? '').trim()
  const { error } = await admin
    .from('survey_responses')
    .update({ feedback: feedback || null, feedback_updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, feedback })
}
