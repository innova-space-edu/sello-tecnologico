import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

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
      .from('profiles').select('role, full_name').eq('id', user.id).single()

    if (!['admin', 'docente', 'coordinador'].includes(perfil?.role ?? ''))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { cursoId, proyectoId } = await req.json()
    if (!cursoId || !proyectoId)
      return NextResponse.json({ error: 'cursoId y proyectoId son requeridos' }, { status: 400 })

    const { data: proyecto } = await supabaseAdmin
      .from('projects').select('id, title').eq('id', proyectoId).single()
    if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    const { data: curso } = await supabaseAdmin
      .from('courses').select('id, name').eq('id', cursoId).single()
    if (!curso) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 })

    const { data: miembros } = await supabaseAdmin
      .from('course_members').select('user_id').eq('course_id', cursoId)
    if (!miembros?.length)
      return NextResponse.json({ error: 'El curso no tiene estudiantes' }, { status: 400 })

    // Ver quiénes ya tienen invitación vigente
    const { data: yaInvitados } = await supabaseAdmin
      .from('project_invitations')
      .select('estudiante_id')
      .eq('proyecto_id', proyectoId)
      .eq('curso_id', cursoId)
      .in('estado', ['pendiente', 'aceptada'])

    const idsYaInvitados = new Set((yaInvitados ?? []).map((i: any) => i.estudiante_id))
    const nuevos = miembros.filter((m: any) => !idsYaInvitados.has(m.user_id))

    if (nuevos.length === 0)
      return NextResponse.json({
        ok: true, enviados: 0,
        mensaje: 'Todos los estudiantes ya tienen una invitación activa para este proyecto.'
      })

    // Crear invitaciones
    const invitaciones = nuevos.map((m: any) => ({
      proyecto_id: proyectoId,
      curso_id: cursoId,
      estudiante_id: m.user_id,
      enviado_por: user.id,
      estado: 'pendiente',
    }))

    const { data: invCreadas, error: errInv } = await supabaseAdmin
      .from('project_invitations').insert(invitaciones).select('id, estudiante_id')
    if (errInv) return NextResponse.json({ error: errInv.message }, { status: 500 })

    const mapaInv = new Map((invCreadas ?? []).map((i: any) => [i.estudiante_id, i.id]))
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sello-tecnologico.vercel.app'

    // Enviar mensaje con link personalizado
    const mensajes = nuevos.map((m: any) => ({
      sender_id: user.id,
      receiver_id: m.user_id,
      content: `📋 Invitación de proyecto — ${perfil?.full_name ?? 'Tu docente'} te invita a participar en el proyecto "${proyecto.title}" del curso ${curso.name}. Acepta aquí: ${appUrl}/proyectos/aceptar?inv=${mapaInv.get(m.user_id)}`,
      read: false,
    }))

    await supabaseAdmin.from('messages').insert(mensajes)

    return NextResponse.json({ ok: true, enviados: nuevos.length, ya_invitados: idsYaInvitados.size })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
