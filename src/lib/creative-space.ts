import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export const CREATIVE_BUCKET = 'creative-space'
export const CREATIVE_MAX_BYTES = 50 * 1024 * 1024

export const CREATIVE_MIMES: Record<string, 'image' | 'video' | 'audio'> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'video/mp4': 'video', 'video/webm': 'video',
  'audio/mpeg': 'audio', 'audio/mp4': 'audio', 'audio/wav': 'audio',
  'audio/ogg': 'audio', 'audio/webm': 'audio',
}

export const CREATIVE_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/gif': ['gif'],
  'video/mp4': ['mp4'], 'video/webm': ['webm'],
  'audio/mpeg': ['mp3'], 'audio/mp4': ['m4a', 'mp4'],
  'audio/wav': ['wav'], 'audio/ogg': ['ogg', 'oga'], 'audio/webm': ['webm'],
}

export function shortText(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
}

// Public exhibition is opt-in. Re-check on every gallery request, so revocations
// take effect without relying on an asynchronous cleanup job.
export async function eligiblePublicAuthors(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  ids: string[],
): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (!unique.length) return new Set()
  const [ages, choices, requests] = await Promise.all([
    admin.from('family_age_status').select('user_id,declared_birth_date').in('user_id', unique),
    admin.from('sello_privacy_choices').select('user_id,choices').in('user_id', unique),
    admin.from('family_authorization_requests')
      .select('student_user_id,status,decisions,document_version,updated_at')
      .eq('platform', 'sello').in('student_user_id', unique)
      .in('status', ['approved', 'revoked'])
      .order('updated_at', { ascending: false }),
  ])
  if (ages.error || choices.error || requests.error) return new Set()

  const birthday = new Map((ages.data ?? []).map(row => [row.user_id, row.declared_birth_date]))
  const ownChoices = new Map((choices.data ?? []).map(row => [row.user_id, row.choices]))
  const latestFamily = new Map<string, {status: string, decisions: Record<string, unknown> | null, document_version: string}>()
  for (const row of requests.data ?? []) {
    if (!latestFamily.has(row.student_user_id)) latestFamily.set(row.student_user_id, row)
  }

  const now = new Date()
  const adultCutoff = Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate())
  const allowed = new Set<string>()
  for (const id of unique) {
    const birth = birthday.get(id)
    const birthdayMs = birth ? Date.parse(String(birth) + 'T00:00:00Z') : NaN
    const isMinor = Number.isFinite(birthdayMs) && birthdayMs > adultCutoff
    const isAdult = Number.isFinite(birthdayMs) && birthdayMs <= adultCutoff
    if (isMinor) {
      const guardian = latestFamily.get(id)
      if (guardian?.status === 'approved' &&
          guardian.document_version === 'family-2026-10-v1' &&
          guardian.decisions?.public_showcase === true) allowed.add(id)
    } else if (isAdult || !Number.isFinite(birthdayMs)) {
      // The official privacy RPC forbids a minor (or unknown age) from setting
      // true on their own, so this is an independently recorded adult opt-in.
      const preferences = ownChoices.get(id) as Record<string, unknown> | undefined
      if (preferences?.public_showcase === true) allowed.add(id)
    }
  }
  return allowed
}
