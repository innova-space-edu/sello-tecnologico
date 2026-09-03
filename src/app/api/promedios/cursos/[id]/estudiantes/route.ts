import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { canAccessCourse, getPromediosActor, noStoreHeaders } from '@/lib/promedios-auth'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Context) {
  const actor = await getPromediosActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStoreHeaders() })

  const { id: courseId } = await params
  if (!(await canAccessCourse(actor, courseId))) {
    return NextResponse.json({ error: 'No tienes acceso a este curso' }, { status: 403, headers: noStoreHeaders() })
  }

  const mode = request.nextUrl.searchParams.get('mode') === 'name' ? 'name' : 'alias'
  const workbookId = request.nextUrl.searchParams.get('workbookId')
  const admin = createAdminSupabaseClient()

  if (workbookId) {
    const { data: workbook } = await admin
      .from('promedios_workbooks')
      .select('id, owner_id')
      .eq('id', workbookId)
      .is('archived_at', null)
      .maybeSingle()
    if (!workbook || (workbook.owner_id !== actor.id && actor.role !== 'admin')) {
      return NextResponse.json({ error: 'Libro no disponible' }, { status: 404, headers: noStoreHeaders() })
    }
  }

  const { data: members, error: memberError } = await admin
    .from('course_members')
    .select('user_id')
    .eq('course_id', courseId)
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500, headers: noStoreHeaders() })

  const ids = (members ?? []).map((row) => row.user_id)
  if (ids.length === 0) return NextResponse.json({ students: [] }, { headers: noStoreHeaders() })

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .in('id', ids)
    .eq('role', 'estudiante')
    .order('full_name')
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500, headers: noStoreHeaders() })

  const students = profiles ?? []
  if (mode === 'name') {
    return NextResponse.json({
      students: students.map((student) => ({ id: student.id, label: student.full_name || 'Estudiante' })),
      mode,
    }, { headers: noStoreHeaders() })
  }

  if (!workbookId) {
    return NextResponse.json({
      students: students.map((student, index) => ({ id: student.id, label: `Estudiante ${String(index + 1).padStart(2, '0')}` })),
      mode,
    }, { headers: noStoreHeaders() })
  }

  const { data: existing } = await admin
    .from('promedios_aliases')
    .select('student_id, alias')
    .eq('workbook_id', workbookId)
  const aliases = new Map((existing ?? []).map((row) => [row.student_id, row.alias]))

  const missing = students.filter((student) => !aliases.has(student.id))
  if (missing.length > 0) {
    const usedNumbers = new Set(
      [...aliases.values()]
        .map((alias) => Number(String(alias).match(/(\d+)$/)?.[1]))
        .filter((value) => Number.isFinite(value))
    )
    let next = 1
    const rows = missing.map((student) => {
      while (usedNumbers.has(next)) next += 1
      const alias = `Estudiante ${String(next).padStart(2, '0')}`
      usedNumbers.add(next)
      next += 1
      aliases.set(student.id, alias)
      return { workbook_id: workbookId, student_id: student.id, alias }
    })
    const { error: aliasError } = await admin.from('promedios_aliases').upsert(rows, { onConflict: 'workbook_id,student_id' })
    if (aliasError) return NextResponse.json({ error: aliasError.message }, { status: 500, headers: noStoreHeaders() })
  }

  return NextResponse.json({
    students: students.map((student) => ({ id: student.id, label: aliases.get(student.id) ?? 'Estudiante' })),
    mode,
  }, { headers: noStoreHeaders() })
}
