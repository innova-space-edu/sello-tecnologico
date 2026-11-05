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


/** Tags are user-editable labels, independent of the detected media type. */
export function normalizeCreativeTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 8) return null
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') return null
    const tag = item.trim().replace(/^#+/, '').replace(/\s+/g, ' ')
    if (!tag || tag.length > 24) return null
    const key = tag.toLocaleLowerCase('es-CL')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}
