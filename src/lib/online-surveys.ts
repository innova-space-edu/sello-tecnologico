import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const ONLINE_TYPES = ['short', 'long', 'single', 'multiple', 'scale', 'number', 'date'] as const
export type OnlineQuestionType = (typeof ONLINE_TYPES)[number]
export type OnlineQuestion = {
  id: string
  prompt: string
  type: OnlineQuestionType
  required: boolean
  options: string[]
  section: string
}
export type OnlineSurveyActor = { id: string; role: string }
export type OnlineSurveyInput = { title: string; description: string; questions: OnlineQuestion[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STAFF_ROLES = new Set(['admin', 'docente', 'coordinador', 'utp'])
const CREATOR_ROLES = new Set([...STAFF_ROLES, 'estudiante'])

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)
export const canPublishSurvey = (role: string) => STAFF_ROLES.has(role)

export async function getOnlineSurveyActor(): Promise<OnlineSurveyActor | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin.from('profiles')
    .select('id,role,blocked').eq('id', user.id).maybeSingle()
  if (!profile || profile.blocked || !CREATOR_ROLES.has(profile.role)) return null
  return { id: user.id, role: profile.role }
}

export function normalizeOnlineSurvey(body: unknown): { data?: OnlineSurveyInput; error?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Formulario inválido.' }
  const input = body as Record<string, unknown>
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (title.length < 3 || title.length > 160) return { error: 'El título debe tener entre 3 y 160 caracteres.' }
  if (description.length > 2000) return { error: 'La descripción no puede superar 2000 caracteres.' }
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 25) {
    return { error: 'Agrega entre 1 y 25 preguntas.' }
  }
  const ids = new Set<string>()
  const questions: OnlineQuestion[] = []
  for (const [index, raw] of input.questions.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Pregunta inválida.' }
    const q = raw as Record<string, unknown>
    const id = q.id
    const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : ''
    const type = q.type
    const section = typeof q.section === 'string' ? (q.section.trim() || 'General') : 'General'
    if (!isUuid(id) || ids.has(id)) return { error: 'La pregunta tiene un identificador inválido o duplicado.' }
    if (prompt.length < 3 || prompt.length > 240) return { error: 'Revisa el texto de la pregunta ' + (index + 1) + ' (3–240 caracteres).' }
    if (section.length > 80) return { error: 'El nombre de la sección supera 80 caracteres.' }
    if (typeof type !== 'string' || !ONLINE_TYPES.includes(type as OnlineQuestionType)) return { error: 'Tipo de pregunta no admitido.' }
    const options = ['single','multiple'].includes(type)
      ? (Array.isArray(q.options) ? q.options : []).map((value: unknown) => typeof value === 'string' ? value.trim() : '')
      : []
    if (['single', 'multiple'].includes(type)) {
      if (options.length < 2 || options.length > 12 || options.some((option: string) => !option || option.length > 140) ||
        new Set(options.map((option: string) => option.toLocaleLowerCase('es'))).size !== options.length) {
        return { error: 'La pregunta ' + (index + 1) + ' necesita 2–12 alternativas distintas y no vacías.' }
      }
    }
    ids.add(id)
    questions.push({ id, prompt, type: type as OnlineQuestionType, required: q.required === true, options, section })
  }
  return { data: { title, description, questions } }
}

export function validateOnlineAnswers(questions: OnlineQuestion[], raw: unknown): {
  answers?: Record<string, string | string[]>; error?: string
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Debes completar el formulario.' }
  const input = raw as Record<string, unknown>
  const answers: Record<string, string | string[]> = {}
  for (const question of questions) {
    const value = input[question.id]
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      if (question.required) return { error: 'Falta responder: ' + question.prompt }
      continue
    }
    if (question.type === 'multiple') {
      if (!Array.isArray(value) || value.length > question.options.length ||
        value.some(item => typeof item !== 'string' || !question.options.includes(item)) ||
        new Set(value).size !== value.length) return { error: 'Alternativas inválidas en ' + question.prompt }
      answers[question.id] = value
      continue
    }
    if (typeof value !== 'string') return { error: 'Formato de respuesta inválido en ' + question.prompt }
    const trimmed = value.trim()
    if (!trimmed) {
      if (question.required) return { error: 'Falta responder: ' + question.prompt }
      continue
    }
    if (question.type === 'short' && trimmed.length > 240) return { error: 'La respuesta corta excede 240 caracteres.' }
    if (question.type === 'long' && trimmed.length > 3000) return { error: 'La respuesta larga excede 3000 caracteres.' }
    if (question.type === 'single' && !question.options.includes(trimmed)) return { error: 'Alternativa no válida.' }
    if (question.type === 'scale' && !['1','2','3','4','5'].includes(trimmed)) return { error: 'Selecciona una escala de 1 a 5.' }
    if (question.type === 'number' && (!Number.isFinite(Number(trimmed)) || Number(trimmed) < -1000000000 || Number(trimmed) > 1000000000)) {
      return { error: 'Número fuera del rango permitido.' }
    }
    if (question.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
        Number.isNaN(Date.parse(trimmed)) || new Date(trimmed).toISOString().slice(0, 10) !== trimmed) {
        return { error: 'Fecha inválida.' }
      }
    }
    answers[question.id] = trimmed
  }
  return { answers }
}

export function makeOnlineSlug(title: string) {
  const base = title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,45) || 'encuesta'
  return base + '-' + crypto.randomUUID().replaceAll('-', '').slice(0,12)
}
