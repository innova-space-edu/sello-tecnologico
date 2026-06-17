import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function buildStudentReport(studentId: string) {
  const admin = createAdminSupabaseClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, curso, role')
    .eq('id', studentId)
    .single()

  return {
    profile,
    stats: {
      projects: 0,
      evidences: 0,
      followups: 0,
      surveyResponses: 0,
      portfolios: 0,
      selfEvaluations: 0,
      sentMessages: 0,
      receivedMessages: 0,
      flaggedMessages: 0,
      accessLogs: 0,
    },
    ownedProjects: [],
    evidences: [],
    followups: [],
    surveyResponses: [],
    portfolios: [],
    selfEvaluations: [],
    sentMessages: [],
    receivedMessages: [],
    flaggedMessages: [],
    accessLogs: [],
    timeline: [],
  }
}
