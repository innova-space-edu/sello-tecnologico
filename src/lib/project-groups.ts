import { createClient } from '@/lib/supabase'

// ─── Normalización de texto ───────────────────────────────────────────────────

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractMemberName(raw: string): string {
  if (!raw) return ''
  // Separar por guion, dash largo, barra o dos puntos para quitar el rol
  const parts = raw.split(/[-–—|:]/)
  return normalizeText(parts[0] ?? raw)
}

export function buildGroupSignature(courseId: string, integrantes: string[]): string {
  const names = integrantes
    .map(extractMemberName)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  if (names.length === 0) return ''
  return `course:${courseId}|${names.join('|')}`
}

// ─── Crear o recuperar grupo ──────────────────────────────────────────────────

export async function ensureProjectGroup(params: {
  courseId: string
  integrantes: string[]
  createdBy?: string | null
  groupName?: string | null
}): Promise<{ groupId: string; signature: string } | null> {
  if (!params.courseId || params.integrantes.length === 0) return null

  const supabase = createClient()
  const signature = buildGroupSignature(params.courseId, params.integrantes)
  if (!signature || signature === `course:${params.courseId}|`) return null

  // Buscar grupo existente con la misma firma
  const { data: existing } = await supabase
    .from('project_groups')
    .select('id')
    .eq('normalized_signature', signature)
    .maybeSingle()

  let groupId = existing?.id ?? null

  // Si no existe, crear uno nuevo
  if (!groupId) {
    const { data: created, error } = await supabase
      .from('project_groups')
      .insert({
        course_id: params.courseId,
        group_name: params.groupName ?? null,
        normalized_signature: signature,
        created_by: params.createdBy ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[project-groups] Error creando grupo:', error.message)
      return null
    }
    groupId = created.id
  }

  // Sincronizar miembros (sin duplicar)
  const uniqueRaw = Array.from(
    new Set(params.integrantes.map(i => i.trim()).filter(Boolean))
  )

  for (const raw of uniqueRaw) {
    const normalized = extractMemberName(raw)
    if (!normalized) continue

    const { data: exists } = await supabase
      .from('project_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('normalized_name', normalized)
      .maybeSingle()

    if (!exists) {
      await supabase.from('project_group_members').insert({
        group_id: groupId,
        full_name: raw,
        normalized_name: normalized,
        course_id: params.courseId,
      })
    }
  }

  return { groupId, signature }
}
