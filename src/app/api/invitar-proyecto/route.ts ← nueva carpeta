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

    if (!['admin', 'docente', 'coordinador'].includes(perfil?.role ?? '')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { cursoId, proyectoId } = await req.json()
    if (!cursoId || !proyectoId) {
      return NextResponse.json({ error: 'cursoId y proyectoId son requeridos' }, { status: 400 })
    }

    // Obtener datos del proyecto plantilla
    const { data: plantilla } = await supabaseAdmin
      .from('projects').select('*, courses(name)').eq('id', proyectoId).single()

    if (!plantilla) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    // Obtener todos los miembros del curso
    const { data: miembros } = await supabaseAdmin
      .from('course_members')
      .select('user_id, profiles(full_name, role)')
      .eq('course_id', cursoId)

    if (!miembros?.length) {
      return NextResponse.json({ error: 'El curso no tiene estudiantes' }, { status: 400 })
    }

    // Ver quiénes ya tienen copia
    const { data: yaDistribuidos } = await supabaseAdmin
      .from('projects').select('owner_id, id').eq('plantilla_id', proyectoId)

    const mapaDistribuidos = new Map(
      (yaDistribuidos ?? []).map((p: any) => [p.owner_id, p.id])
    )

    // Crear copias para los que no tienen
    const sinCopia = miembros.filter((m: any) => !mapaDistribuidos.has(m.user_id))

    if (sinCopia.length > 0) {
      const nuevasCopias = sinCopia.map((m: any) => ({
        title: plantilla.title,
        description: plantilla.description,
        status: 'Borrador',
        type: plantilla.type,
        course_id: plantilla.course_id,
        start_date: plantilla.start_date,
        end_date: plantilla.end_date,
        semestre: plantilla.semestre,
        asignaturas: plantilla.asignaturas,
        docentes_responsables: plantilla.docentes_responsables,
        tipo_proyecto: plantilla.tipo_proyecto,
        objetivos_aprendizaje: plantilla.objetivos_aprendizaje,
        habilidades: plantilla.habilidades,
        vinculacion_pei: plantilla.vinculacion_pei,
        pregunta_guia: plantilla.pregunta_guia,
        contexto_problema: plantilla.contexto_problema,
        justificacion: plantilla.justificacion,
        metodologia: plantilla.metodologia,
        organizacion_trabajo: plantilla.organizacion_trabajo,
        herramientas_tecnologicas: plantilla.herramientas_tecnologicas,
        herramientas_materiales: plantilla.herramientas_materiales,
        etapas_metodologia: plantilla.etapas_metodologia,
        uso_ia: plantilla.uso_ia,
        estrategia_verificacion: plantilla.estrategia_verificacion,
        tipo_producto: plantilla.tipo_producto,
        instrumento_evaluacion: plantilla.instrumento_evaluacion,
        criterios_evaluados: plantilla.criterios_evaluados,
        autoevaluacion: plantilla.autoevaluacion,
        aprendizajes_logrados: plantilla.aprendizajes_logrados,
        dificultades: plantilla.dificultades,
        mejoras: plantilla.mejoras,
        impacto_comunidad: plantilla.impacto_comunidad,
        owner_id: m.user_id,
        plantilla_id: proyectoId,
        distribuido_por: user.id,
        distribuido_at: new Date().toISOString(),
        es_copia_distribuida: true,
      }))

      const { data: insertadas } = await supabaseAdmin
        .from('projects').insert(nuevasCopias).select('id, owner_id')

      // Actualizar mapa con las nuevas copias
      ;(insertadas ?? []).forEach((p: any) => mapaDistribuidos.set(p.owner_id, p.id))
    }

    // Marcar plantilla como distribuida
    await supabaseAdmin.from('projects')
      .update({ es_plantilla: true }).eq('id', proyectoId)

    // Enviar mensaje a cada estudiante con el link a SU copia
    const mensajes = miembros.map((m: any) => {
      const copiaId = mapaDistribuidos.get(m.user_id)
      const link = copiaId
        ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/proyectos/${copiaId}`
        : ''
      return {
        sender_id: user.id,
        receiver_id: m.user_id,
        content: `📋 **Invitación de proyecto** — ${perfil?.full_name ?? 'Tu docente'} te ha asignado el proyecto "${plantilla.title}" del curso ${plantilla.courses?.name ?? ''}. Entra a completarlo aquí: ${link}`,
        read: false,
      }
    })

    await supabaseAdmin.from('messages').insert(mensajes)

    return NextResponse.json({
      ok: true,
      enviados: miembros.length,
      copias_nuevas: sinCopia.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
