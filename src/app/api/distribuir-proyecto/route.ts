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
      .from('profiles').select('role').eq('id', user.id).single()

    if (!['admin', 'docente', 'coordinador'].includes(perfil?.role ?? '')) {
      return NextResponse.json({ error: 'Sin permisos para distribuir proyectos' }, { status: 403 })
    }

    const { proyectoId } = await req.json()
    if (!proyectoId) return NextResponse.json({ error: 'proyectoId requerido' }, { status: 400 })

    // Obtener la plantilla original
    const { data: plantilla, error: errPlantilla } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', proyectoId)
      .single()

    if (errPlantilla || !plantilla) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    if (!plantilla.course_id) {
      return NextResponse.json({ error: 'El proyecto no tiene un curso asignado' }, { status: 400 })
    }

    // Obtener todos los miembros del curso
    const { data: miembros } = await supabaseAdmin
      .from('course_members')
      .select('user_id, profiles(full_name, role)')
      .eq('course_id', plantilla.course_id)

    if (!miembros || miembros.length === 0) {
      return NextResponse.json({ error: 'El curso no tiene estudiantes' }, { status: 400 })
    }

    // Verificar si ya tiene copias distribuidas para no duplicar
    const { data: yaDistribuidos } = await supabaseAdmin
      .from('projects')
      .select('owner_id')
      .eq('plantilla_id', proyectoId)

    const yaDistribuidosIds = new Set((yaDistribuidos ?? []).map((p: any) => p.owner_id))

    // Crear copia para cada miembro que aún no tenga una
    const nuevascopias = miembros
      .filter((m: any) => !yaDistribuidosIds.has(m.user_id))
      .map((m: any) => ({
        // Datos del proyecto copiados de la plantilla
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
        // Metadatos de distribución
        owner_id: m.user_id,
        plantilla_id: proyectoId,
        distribuido_por: user.id,
        distribuido_at: new Date().toISOString(),
        es_copia_distribuida: true,
      }))

    if (nuevascopias.length === 0) {
      return NextResponse.json({
        ok: true,
        creados: 0,
        mensaje: 'Todos los estudiantes ya tienen su copia de este proyecto.'
      })
    }

    const { error: errInsert } = await supabaseAdmin
      .from('projects')
      .insert(nuevascopias)

    if (errInsert) {
      return NextResponse.json({ error: errInsert.message }, { status: 500 })
    }

    // Marcar la plantilla original como distribuida
    await supabaseAdmin
      .from('projects')
      .update({ es_plantilla: true })
      .eq('id', proyectoId)

    return NextResponse.json({
      ok: true,
      creados: nuevascopias.length,
      total_curso: miembros.length,
      ya_tenian: yaDistribuidosIds.size,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
