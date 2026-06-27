import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'
import { normalizeAutoevaluacionQuestions } from '@/lib/autoevaluacion'

function canManage(role?: string | null) {
  return ['admin', 'docente', 'coordinador'].includes(String(role ?? ''))
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

export async function GET() {
  const actor = await getSurveyActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('self_evaluation_formats')
    .select('id, title, description, questions, source, active, created_at, updated_at')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ formats: [], warning: error.message })
  return NextResponse.json({ formats: data ?? [] })
}

export async function POST(request: Request) {
  const actor = await getSurveyActor()
  if (!actor || !canManage(actor.role)) {
    return NextResponse.json({ error: 'No tienes permiso para crear formatos.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const title = cleanText((body as any).title)
  const description = cleanText((body as any).description)
  const source = cleanText((body as any).source) === 'copy' ? 'copy' : 'custom'
  const questions = normalizeAutoevaluacionQuestions((body as any).questions)

  if (!title) return NextResponse.json({ error: 'El nombre del formato es obligatorio.' }, { status: 400 })
  if (questions.length === 0) return NextResponse.json({ error: 'El formato debe tener al menos una pregunta.' }, { status: 400 })

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('self_evaluation_formats')
    .insert({
      title,
      description: description || null,
      questions,
      source,
      created_by: actor.id,
      active: true,
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'No fue posible guardar el formato.' }, { status: 400 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
