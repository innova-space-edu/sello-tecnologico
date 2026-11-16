// The reserved marker identifies an admin-uploaded anonymized copy, not a consent.
export const TEMPORARY_EXAMPLE_TAG = 'Ejemplo temporal'
export const TEMPORARY_EXAMPLE_AUTHOR = 'Proyecto de egresados · ejemplo anónimo'
export function isTemporaryExample(tags: unknown): boolean {
 return Array.isArray(tags) && tags.some(tag=>typeof tag==='string'&&tag.trim().toLowerCase()===TEMPORARY_EXAMPLE_TAG.toLowerCase())
}
// Retention starts at the upload of the copy, not at reapproval. Clamp end of month.
export function exampleExpiresAt(createdAt: string): string | null {
 const start=new Date(createdAt)
 if(!Number.isFinite(start.getTime()))return null
 const end=new Date(start)
 const day=end.getUTCDate()
 end.setUTCDate(1)
 end.setUTCMonth(end.getUTCMonth()+6)
 const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate()
 end.setUTCDate(Math.min(day,last))
 return end.toISOString()
}
export function exampleRemainingSeconds(createdAt:string,now=Date.now()):number {
 const expiry=exampleExpiresAt(createdAt)
 return expiry?Math.max(0,Math.floor((Date.parse(expiry)-now)/1000)):0
}
