import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getSurveyActor } from '@/lib/survey-auth'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const actor = await getSurveyActor()
  if (!actor) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  if (!['admin', 'docente', 'coordinador', 'utp'].includes(actor.role)) {
    return NextResponse.json({ error: 'No tienes permiso para ver este reporte.' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminSupabaseClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, full_name, email, curso, role')
    .eq('id', id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Estudiante no encontrado.' }, { status: 404 })
  }

  return NextResponse.json({
    profile,
    status: 'basic_report_ready',
    note: 'Reporte básico activo. El reporte integral se reactivará después de validar relaciones de tablas.',
  })
}
