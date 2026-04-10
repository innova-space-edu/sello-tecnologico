import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { buildGroupSignature, normalizeText, extractMemberName } from '@/lib/project-groups'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: perfil } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    if (!['admin', 'coordinador'].includes(perfil?.role ?? '')) {
      return NextResponse.json({ error: 'Solo admins pueden ejecutar esta migración' }, { status: 403 })
    }

    // Obtener todos los proyectos con curso e integrantes
    const { data: projects, error: errProjects } = await supabaseAdmin
      .from('projects')
      .select('id, title, course_id, integrantes_roles, owner_id, group_id')
      .not('course_id', 'is', null)

    if (errProjects) return NextResponse.json({ error: errProjects.message }, { status: 500 })

    let procesados = 0
    let actualizados = 0
    let omitidos = 0
    let errores = 0

    for (const p of projects ?? []) {
      procesados++

      // Saltar si ya tiene group_id asignado
      if (p.group_id) { omitidos++; continue }

      // Saltar si no tiene integrantes
      const integrantes: string[] = Array.isArray(p.integrantes_roles)
        ? p.integrantes_roles.filter(Boolean)
        : []
      if (!p.course_id || integrantes.length === 0) { omitidos++; continue }

      try {
        const signature = buildGroupSignature(p.course_id, integrantes)
        if (!signature || signature === `course:${p.course_id}|`) { omitidos++; continue }

        // Buscar o crear grupo
        const { data: existing } = await supabaseAdmin
          .from('project_groups')
          .select('id')
          .eq('normalized_signature', signature)
          .maybeSingle()

        let groupId = existing?.id ?? null

        if (!groupId) {
          const { data: created, error: errCreate } = await supabaseAdmin
            .from('project_groups')
            .insert({
              course_id: p.course_id,
              group_name: p.title ?? 'Grupo migrado',
              normalized_signature: signature,
              created_by: p.owner_id ?? null,
            })
            .select('id')
            .single()

          if (errCreate) { errores++; continue }
          groupId = created.id
        }

        // Sincronizar miembros
        const uniqueRaw = Array.from(new Set(integrantes.map(i => i.trim()).filter(Boolean)))
        for (const raw of uniqueRaw) {
          const normalized = extractMemberName(raw)
          if (!normalized) continue
          const { data: exists } = await supabaseAdmin
            .from('project_group_members')
            .select('id')
            .eq('group_id', groupId)
            .eq('normalized_name', normalized)
            .maybeSingle()
          if (!exists) {
            await supabaseAdmin.from('project_group_members').insert({
              group_id: groupId,
              full_name: raw,
              normalized_name: normalized,
              course_id: p.course_id,
            })
          }
        }

        // Actualizar el proyecto con el group_id
        await supabaseAdmin.from('projects').update({ group_id: groupId }).eq('id', p.id)
        actualizados++
      } catch (e: any) {
        console.error(`[rebuild] Error en proyecto ${p.id}:`, e.message)
        errores++
      }
    }

    return NextResponse.json({
      ok: true,
      procesados,
      actualizados,
      omitidos,
      errores,
      mensaje: `Migración completa: ${actualizados} proyectos vinculados a grupos, ${omitidos} omitidos, ${errores} errores.`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
