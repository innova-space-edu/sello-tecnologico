import { createAdminSupabaseClient } from '@/lib/supabase-admin'

async function safeData<T>(request: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const result = await request
    if (result.error || !result.data) return fallback
    return result.data
  } catch {
    return fallback
  }
}

export async function buildStudentReport(studentId: string) {
  const admin = createAdminSupabaseClient()

  const profile = await safeData<any>(
    admin.from('profiles').select('*').eq('id', studentId).single(),
    null
  )

  const [
    ownedProjects,
    evidences,
    followups,
    surveyResponses,
    portfolios,
    selfEvaluations,
    sentMessages,
    receivedMessages,
    flaggedMessages,
    accessLogs,
  ] = await Promise.all([
    safeData<any[]>(
      admin
        .from('projects')
        .select('id, title, status, type, created_at, updated_at, course_id, courses(name)')
        .eq('owner_id', studentId)
        .order('created_at', { ascending: false })
        .limit(100),
      []
    ),
    safeData<any[]>(
      admin
        .from('evidences')
        .select('id, title, type, evidencia_tipo, created_at, project_id, projects(title)')
        .eq('created_by', studentId)
        .order('created_at', { ascending: false })
        .limit(100),
      []
    ),
    safeData<any[]>(
      admin
        .from('followup_participants')
        .select('user_id, project_followups(id, followup_date, subject, overall_status, score, observations, feedback, projects(title), courses(name))')
        .eq('user_id', studentId)
        .limit(100),
      []
    ),
    safeData<any[]>(
      admin
        .from('survey_responses')
        .select('id, survey_id, course_id, respondent_name, respondent_email, created_at, surveys(title)')
        .eq('registered_user_id', studentId)
        .order('created_at', { ascending: false })
        .limit(100),
      []
    ),
    safeData<any[]>(
      admin
        .from('portfolios')
        .select('id, user_id, year, created_at, updated_at')
        .eq('user_id', studentId)
        .order('updated_at', { ascending: false })
        .limit(20),
      []
    ),
    safeData<any[]>(
      admin
        .from('self_evaluations')
        .select('id, student_name, project_name, intervention_place, status, created_at, answers, courses(name)')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50),
      []
    ),
    safeData<any[]>(
      admin
        .from('messages')
        .select('id, content, read, created_at, receiver:profiles!messages_receiver_id_fkey(full_name, email, curso, role)')
        .eq('sender_id', studentId)
        .order('created_at', { ascending: false })
        .limit(100),
      []
    ),
    safeData<any[]>(
      admin
        .from('messages')
        .select('id, content, read, created_at, sender:profiles!messages_sender_id_fkey(full_name, email, curso, role)')
        .eq('receiver_id', studentId)
        .order('created_at', { ascending: false })
        .limit(100),
      []
    ),
    safeData<any[]>(
      admin
        .from('flagged_messages')
        .select('id, content, category, severity, confidence, action, matched_words, reviewed, created_at')
        .or(`sender_id.eq.${studentId},receiver_id.eq.${studentId}`)
        .order('created_at', { ascending: false })
        .limit(100),
      []
    ),
    safeData<any[]>(
      admin
        .from('user_access_logs')
        .select('id, event_type, pathname, created_at, metadata')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false })
        .limit(200),
      []
    ),
  ])

  const timeline = [
    ...ownedProjects.map(item => ({
      type: 'Proyecto',
      date: item.created_at,
      title: item.title,
      detail: item.status ?? 'Sin estado',
    })),
    ...evidences.map(item => ({
      type: 'Evidencia',
      date: item.created_at,
      title: item.title,
      detail: item.evidencia_tipo ?? item.type ?? 'Sin tipo',
    })),
    ...followups.map((item: any) => {
      const followup = Array.isArray(item.project_followups) ? item.project_followups[0] : item.project_followups
      return {
        type: 'Seguimiento',
        date: followup?.followup_date,
        title: followup?.projects?.title ?? 'Seguimiento',
        detail: followup?.overall_status ?? 'Sin estado',
      }
    }),
    ...surveyResponses.map(item => ({
      type: 'Encuesta',
      date: item.created_at,
      title: item.surveys?.title ?? 'Encuesta respondida',
      detail: item.respondent_name ?? profile?.full_name ?? 'Respuesta',
    })),
    ...portfolios.map(item => ({
      type: 'Portafolio',
      date: item.updated_at ?? item.created_at,
      title: `Portafolio ${item.year ?? ''}`.trim(),
      detail: 'Actualizado',
    })),
    ...selfEvaluations.map(item => ({
      type: 'Autoevaluación',
      date: item.created_at,
      title: item.project_name ?? 'Autoevaluación STEAM',
      detail: item.status ?? 'Enviada',
    })),
    ...flaggedMessages.map(item => ({
      type: 'Alerta convivencia',
      date: item.created_at,
      title: item.category ?? 'Alerta',
      detail: item.reviewed ? 'Revisada' : 'Pendiente',
    })),
  ]
    .filter(item => item.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return {
    profile,
    stats: {
      projects: ownedProjects.length,
      evidences: evidences.length,
      followups: followups.length,
      surveyResponses: surveyResponses.length,
      portfolios: portfolios.length,
      selfEvaluations: selfEvaluations.length,
      sentMessages: sentMessages.length,
      receivedMessages: receivedMessages.length,
      flaggedMessages: flaggedMessages.length,
      accessLogs: accessLogs.length,
    },
    ownedProjects,
    evidences,
    followups,
    surveyResponses,
    portfolios,
    selfEvaluations,
    sentMessages,
    receivedMessages,
    flaggedMessages,
    accessLogs,
    timeline,
  }
}
