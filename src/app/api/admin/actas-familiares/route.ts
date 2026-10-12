import { requireAdminSession, AdminAuthorizationError } from "@/lib/admin-auth"
import { createFamilyAdminClient, privateResponse } from "@/lib/family-consent/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireAdminSession()
    const db=createFamilyAdminClient()
    const {data: acts,error}=await db.from("sello_family_approval_acts")
      .select("folio,record_type,request_id,student_name,guardian_name,guardian_relationship,institution_name,reviewer_user_id,approved_at,verified_method,evidence_reference,document_version,notes,created_at")
      .order("created_at",{ascending:false}).limit(300)
    if(error)return privateResponse({error:"No se pudo consultar el registro de actas."},503)
    const list=acts||[]
    const reviewerIds=[...new Set(list.map(a=>a.reviewer_user_id).filter((v):v is string=>typeof v==="string"))]
    const reqIds=list.map(a=>a.request_id).filter((v):v is string=>typeof v==="string")
    const {data:reviewers,error:reError}=reviewerIds.length
      ? await db.from("profiles").select("id,full_name,email").in("id",reviewerIds)
      : {data:[],error:null}
    const {data:requests,error:rqError}=reqIds.length
      ? await db.from("family_authorization_requests").select("id,status,revoked_at")
          .eq("platform","sello").in("id",reqIds)
      : {data:[],error:null}
    if(reError||rqError)return privateResponse({error:"No se pudo completar la información del archivo."},503)
    const reviewers=new Map((reviewers||[]).map(v=>[v.id,v.full_name||v.email||"Administrador"]))
    const byRequest=new Map((requests||[]).map(v=>[v.id,v]))
    return privateResponse({
      acts:list.map(a=>({
        ...a, reviewer_name:a.reviewer_user_id?reviewers.get(a.reviewer_user_id)||"Administrador":"No corresponde · borrador",
        authorization_status:a.record_type==="borrador"?"borrador":byRequest.get(a.request_id)?.status||"no disponible",
        revoked_at:a.request_id?byRequest.get(a.request_id)?.revoked_at||null:null
      })),
      hasMore:list.length===300,
      officialCount:list.filter(a=>a.record_type==="aprobacion").length,
      draftCount:list.filter(a=>a.record_type==="borrador").length
    })
  } catch(e) {
    if(e instanceof AdminAuthorizationError)return privateResponse({error:e.message},e.status)
    return privateResponse({error:"Archivo de actas temporalmente no disponible."},503)
  }
}
