import { requireAdminSession, AdminAuthorizationError } from "@/lib/admin-auth"
import { createFamilyAdminClient, privateResponse } from "@/lib/family-consent/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

export async function GET(request: Request) {
  try {
    await requireAdminSession()
    const url = new URL(request.url)
    const rawPage = Number(url.searchParams.get("page") || "0")
    const page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0
    const recordType = url.searchParams.get("type")
    const type = recordType === "aprobacion" || recordType === "borrador" ? recordType : null
    // Solo caracteres literales para evitar operadores de filtros PostgREST introducidos por el usuario.
    const search = (url.searchParams.get("q") || "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "").trim().slice(0, 80)
    const db = createFamilyAdminClient()
    let query = db.from("sello_family_approval_acts")
      .select("folio,record_type,request_id,student_name,guardian_name,guardian_relationship,institution_name,reviewer_user_id,approved_at,verified_method,evidence_reference,document_version,notes,created_at", { count: "exact" })
    if (type) query = query.eq("record_type", type)
    if (search) query = query.or(`folio.ilike.%${search}%,student_name.ilike.%${search}%,guardian_name.ilike.%${search}%`)
    const {data: acts, error, count} = await query
      .order("created_at", { ascending: false }).order("folio", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if(error) return privateResponse({error:"No se pudo consultar el registro de actas."},503)
    const list = acts || []
    const reviewerIds = [...new Set(list.map(a => a.reviewer_user_id).filter((v): v is string => typeof v === "string"))]
    const reqIds = list.map(a => a.request_id).filter((v): v is string => typeof v === "string")
    const [reviewersResult, requestsResult, officialResult, draftsResult] = await Promise.all([
      reviewerIds.length
        ? db.from("profiles").select("id,full_name,email").in("id",reviewerIds)
        : Promise.resolve({ data: [], error: null }),
      reqIds.length
        ? db.from("family_authorization_requests").select("id,status,revoked_at")
            .eq("platform","sello").in("id",reqIds)
        : Promise.resolve({ data: [], error: null }),
      db.from("sello_family_approval_acts").select("folio",{count:"exact",head:true}).eq("record_type","aprobacion"),
      db.from("sello_family_approval_acts").select("folio",{count:"exact",head:true}).eq("record_type","borrador"),
    ])
    if(reviewersResult.error || requestsResult.error || officialResult.error || draftsResult.error)
      return privateResponse({error:"No se pudo completar el archivo de actas."},503)
    const reviewerLookup = new Map((reviewersResult.data || []).map(v => [v.id,v.full_name || v.email || "Administrador"]))
    const byRequest = new Map((requestsResult.data || []).map(v => [v.id,v]))
    const total = count ?? 0
    return privateResponse({
      acts: list.map(a => ({
        ...a,
        reviewer_name: a.reviewer_user_id ? reviewerLookup.get(a.reviewer_user_id) || "Administrador" : "No corresponde · borrador",
        authorization_status: a.record_type === "borrador" ? "borrador" : byRequest.get(a.request_id)?.status || "no disponible",
        revoked_at: a.request_id ? byRequest.get(a.request_id)?.revoked_at || null : null,
      })),
      page, pageSize: PAGE_SIZE, total, hasMore: (page + 1) * PAGE_SIZE < total,
      officialCount: officialResult.count ?? 0, draftCount: draftsResult.count ?? 0,
    })
  } catch(error) {
    if(error instanceof AdminAuthorizationError) return privateResponse({error:error.message},error.status)
    return privateResponse({error:"Archivo de actas temporalmente no disponible."},503)
  }
}
