import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export type SurveyActor = {
  id: string
  role: string
  curso?: string | null
  full_name?: string | null
  email?: string | null
}

export async function getSurveyActor(): Promise<SurveyActor | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, curso, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  return profile as SurveyActor
}

export function canManageSurveys(actor: SurveyActor | null) {
  return Boolean(actor && ['admin', 'docente'].includes(actor.role))
}

export async function canReadSurvey(actor: SurveyActor | null, surveyId: string) {
  if (!actor || !canManageSurveys(actor)) return false
  if (actor.role === 'admin') return true

  const admin = createAdminSupabaseClient()
  const { data: survey } = await admin
    .from('surveys')
    .select('id, creator_id')
    .eq('id', surveyId)
    .single()

  if (!survey) return false
  if (survey.creator_id === actor.id) return true

  const { count } = await admin
    .from('survey_course_staff')
    .select('*', { count: 'exact', head: true })
    .eq('survey_id', surveyId)
    .eq('teacher_id', actor.id)

  return (count ?? 0) > 0
}

export async function canEditSurvey(actor: SurveyActor | null, surveyId: string) {
  if (!actor || !canManageSurveys(actor)) return false
  if (actor.role === 'admin') return true

  const admin = createAdminSupabaseClient()
  const { data: survey } = await admin
    .from('surveys')
    .select('creator_id')
    .eq('id', surveyId)
    .single()

  return survey?.creator_id === actor.id
}
