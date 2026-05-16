import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

const STAFF_ROLES = new Set(['admin', 'docente', 'coordinador'])

async function getSessionContext(projectId: string) {
  const supabase = await createServerSupabaseClient()
  const admin = createSupabaseAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }

  const [{ data: perfil }, { data: proyecto }] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, role, curso').eq('id', user.id).maybeSingle(),
    admin.from('projects').select('id, title, owner_id, course_id').eq('id', projectId).maybeSingle(),
  ])

  if (!proyecto) return { error: NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 }) }

  const isStaff = STAFF_ROLES.has(perfil?.role ?? '')
  const isOwner = proyecto.owner_id === user.id
  const { data: membership } = await admin
    .from('project_collaborators')
    .select('id, role, status')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('status', 'accepted')
    .maybeSingle()

  const canView = isStaff || isOwner || !!membership
  const canManage = isStaff || isOwner

  if (!canView) return { error: NextResponse.json({ error: 'Sin permisos para ver este proyecto' }, { status: 403 }) }
  return { admin, user, perfil, proyecto, isStaff, isOwner, canManage }
}

export async function GET(_req: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const ctx = await getSessionContext(id)
    if ('error' in ctx) return ctx.error
    const { admin, proyecto, canManage } = ctx

    const { data: ownerProfile } = await admin
      .from('profiles')
      .select('id, full_name, email, role, curso')
      .eq('id', proyecto.owner_id)
      .maybeSingle()

    const { data: collaborators } = await admin
      .from('project_collaborators')
      .select('id, project_id, user_id, role, status, created_at, invited_by')
      .eq('project_id', id)
      .neq('status', 'removed')
      .order('created_at', { ascending: true })

    const collaboratorIds = (collaborators ?? []).map((c: any) => c.user_id).filter(Boolean)
    const { data: collaboratorProfiles } = collaboratorIds.length
      ? await admin.from('profiles').select('id, full_name, email, role, curso').in('id', collaboratorIds)
      : { data: [] as any[] }

    const profilesMap = new Map((collaboratorProfiles ?? []).map((p: any) => [p.id, p]))
    const currentCollaborators = (collaborators ?? []).map((c: any) => ({
      ...c,
      profile: profilesMap.get(c.user_id) ?? null,
    }))

    let classmates: any[] = []
    if (proyecto.course_id && canManage) {
      const { data: courseMembers } = await admin
        .from('course_members')
        .select('user_id')
        .eq('course_id', proyecto.course_id)

      const ids = Array.from(new Set((courseMembers ?? []).map((m: any) => m.user_id).filter(Boolean)))
      const excluded = new Set([proyecto.owner_id, ...collaboratorIds])
      const availableIds = ids.filter((uid: string) => !excluded.has(uid))

      if (availableIds.length > 0) {
        const { data: profiles } = await admin
          .from('profiles')
          .select('id, full_name, email, role, curso')
          .in('id', availableIds)
          .order('full_name', { ascending: true })
        classmates = profiles ?? []
      }
    }

    return NextResponse.json({
      ok: true,
      canManage,
      owner: ownerProfile,
      collaborators: currentCollaborators,
      classmates,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const ctx = await getSessionContext(id)
    if ('error' in ctx) return ctx.error
    const { admin, user, proyecto, canManage } = ctx

    if (!canManage) return NextResponse.json({ error: 'Solo el creador del proyecto o un usuario administrativo puede agregar compañeros.' }, { status: 403 })

    const body = await req.json()
    const userIds: string[] = Array.isArray(body.userIds) ? body.userIds.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0) : []
    const role = body.role === 'viewer' ? 'viewer' : 'editor'

    if (!userIds.length) return NextResponse.json({ error: 'Selecciona al menos un compañero.' }, { status: 400 })
    if (!proyecto.course_id) return NextResponse.json({ error: 'El proyecto debe tener curso asignado para agregar compañeros.' }, { status: 400 })

    const { data: courseMembers } = await admin
      .from('course_members')
      .select('user_id')
      .eq('course_id', proyecto.course_id)

    const validCourseIds = new Set((courseMembers ?? []).map((m: any) => m.user_id))
    const filteredIds: string[] = Array.from(new Set(userIds)).filter((uid) => uid !== proyecto.owner_id && validCourseIds.has(uid))

    if (!filteredIds.length) {
      return NextResponse.json({ error: 'Los usuarios seleccionados no pertenecen al curso del proyecto.' }, { status: 400 })
    }

    const rows = filteredIds.map((uid: string) => ({
      project_id: id,
      user_id: uid,
      role,
      status: 'accepted',
      invited_by: user.id,
      accepted_at: new Date().toISOString(),
    }))

    const { error } = await admin
      .from('project_collaborators')
      .upsert(rows, { onConflict: 'project_id,user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await admin.from('project_edit_events').insert(filteredIds.map((uid: string) => ({
      project_id: id,
      user_id: user.id,
      event_type: 'collaborator_added',
      field_name: uid,
      metadata: { added_user_id: uid, role },
    }))).then(() => undefined)

    return NextResponse.json({ ok: true, added: filteredIds.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const ctx = await getSessionContext(id)
    if ('error' in ctx) return ctx.error
    const { admin, user, proyecto, canManage } = ctx

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

    const removingSelf = userId === user.id
    if (!canManage && !removingSelf) {
      return NextResponse.json({ error: 'Sin permisos para quitar colaboradores.' }, { status: 403 })
    }
    if (userId === proyecto.owner_id) {
      return NextResponse.json({ error: 'No se puede quitar al creador del proyecto.' }, { status: 400 })
    }

    const { error } = await admin
      .from('project_collaborators')
      .update({ status: 'removed', removed_at: new Date().toISOString() } as any)
      .eq('project_id', id)
      .eq('user_id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await admin.from('project_edit_events').insert({
      project_id: id,
      user_id: user.id,
      event_type: 'collaborator_removed',
      field_name: userId,
      metadata: { removed_user_id: userId },
    }).then(() => undefined)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}
