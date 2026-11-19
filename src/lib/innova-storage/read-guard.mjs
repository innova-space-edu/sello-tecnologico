// Only a trusted registry entry may identify an R2 object.
// Never derive a private object's key solely from mutable evidence URLs.
export function matchesEvidence(row, entry, userId, role) {
  if (!row || !entry || entry.enabled !== true || !userId) return false
  // Preview intentionally permits only the original author and a validated admin.
  // Project collaborators and archived references require separate authorization review.
  if (role !== 'admin' && userId !== entry.created_by) return false
  return typeof entry.source_key === 'string' && entry.source_key.length > 0
    && row.id === entry.evidence_id && row.project_id === entry.project_id
    && row.created_by === entry.created_by && row.file_url === entry.legacy_url
    && Number(row.file_size) === Number(entry.size_bytes)
    && row.file_type === entry.mime_type
    && Number.isSafeInteger(Number(entry.size_bytes))
    && Number(entry.size_bytes) > 0 && Number(entry.size_bytes) <= 1000000
    && /^[a-f0-9]{64}$/.test(entry.sha256)
}
export function safeMediaType(mime) {
  return ['image/png','image/jpeg','image/webp','image/gif'].includes(mime)
    ? mime : 'application/octet-stream'
}
