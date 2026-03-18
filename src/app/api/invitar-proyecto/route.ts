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

    const { invitacionId } = await req.json()
    if (!invitacionId) return NextResponse.json({ error: 'invitacionId requerido' }, { status: 400 })

    // Obtener la invitación
    const { data: inv } = await supabaseAdmin
      .from('project_invitations')
      .select('*, projects(*), courses(name)')
      .eq('id', invitacionId)
      .single()

    if (!inv) return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
    if (inv.estudiante_id !== user.id)
      return NextResponse.json({ error: 'Esta invitación no es tuya' }, { status: 403 })
    if (inv.estado !== 'pendiente')
      return NextResponse.json({ error: 'Esta invitación ya fue respondida' }, { status: 400 })

    const plantilla = inv.projects

    // Crear la copia del proyecto para este estudiante
    const { data: nuevoCopia, error: errCopia } = await supabaseAdmin
      .from('projects').insert({
        title: plantilla.title,
        description: plantilla.description,
        status: 'Borrador',
        type: plantilla.type,
        course_id: plantilla.course_id ?? inv.curso_id,
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
        owner_id: user.id,
        plantilla_id: plantilla.id,
        distribuido_por: inv.enviado_por,
        distribuido_at: new Date().toISOString(),
        es_copia_distribuida: true,
      }).select('id').single()

    if (errCopia) return NextResponse.json({ error: errCopia.message }, { status: 500 })

    // Actualizar la invitación como aceptada
    await supabaseAdmin.from('project_invitations').update({
      estado: 'aceptada',
      copia_proyecto_id: nuevoCopia.id,
      respondida_at: new Date().toISOString(),
    }).eq('id', invitacionId)

    return NextResponse.json({ ok: true, proyectoId: nuevoCopia.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
