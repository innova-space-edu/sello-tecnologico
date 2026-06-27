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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !canManage(actor.role)) {
    return NextResponse.json({ error: 'No tienes permiso para editar formatos.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const title = cleanText((body as any).title)
  const description = cleanText((body as any).description)
  const questions = normalizeAutoevaluacionQuestions((body as any).questions)

  if (!title) return NextResponse.json({ error: 'El nombre del formato es obligatorio.' }, { status: 400 })
  if (questions.length === 0) return NextResponse.json({ error: 'El formato debe tener al menos una pregunta.' }, { status: 400 })

  const admin = createAdminSupabaseClient()
  const { error } = await admin
    .from('self_evaluation_formats')
    .update({
      title,
      description: description || null,
      questions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, id })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getSurveyActor()
  if (!actor || !canManage(actor.role)) {
    return NextResponse.json({ error: 'No tienes permiso para eliminar formatos.' }, { status: 403 })
  }

  const admin = createAdminSupabaseClient()
  const { error } = await admin
    .from('self_evaluation_formats')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
