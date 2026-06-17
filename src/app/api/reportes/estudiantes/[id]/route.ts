import { NextResponse } from 'next/server'
import { getSurveyActor } from '@/lib/survey-auth'
import { buildStudentReport } from '@/lib/student-report'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const actor = await getSurveyActor()
  if (!actor) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  if (!['admin', 'docente', 'coordinador', 'utp'].includes(actor.role)) {
    return NextResponse.json({ error: 'No tienes permiso para descargar este reporte.' }, { status: 403 })
  }

  const { id } = await params
  const report = await buildStudentReport(id)

  return NextResponse.json(report)
}
