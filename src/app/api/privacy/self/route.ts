import { NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createFamilyAdminClient, privateResponse } from "@/lib/family-consent/server"
import { ageCategory,getAccountStatus } from "@/lib/family-consent/account-status"

export const dynamic="force-dynamic"
export async function GET(){
 try{
  const session=await createServerSupabaseClient()
  const {data:{user},error}=await session.auth.getUser()
  if(error||!user)return privateResponse({error:"Inicia sesión."},401)
  const status=await getAccountStatus(user)
  return privateResponse(status)
 }catch{return privateResponse({error:"No se pudo consultar tu cuenta."},503)}
}
export async function POST(request:NextRequest){
 try{
  const session=await createServerSupabaseClient()
  const {data:{user},error}=await session.auth.getUser()
  if(error||!user)return privateResponse({error:"Inicia sesión."},401)
  const status=await getAccountStatus(user)
  if(status.blocked||status.age!=="unknown"||status.ageRequest==="pending")return privateResponse({error:"No se puede modificar una edad registrada o en revisión."},409)
  const body=await request.json().catch(()=>null)
  const birth=body?.birthDate
  if(ageCategory(birth)==="unknown")return privateResponse({error:"Indica una fecha de nacimiento válida."},400)
  const db=createFamilyAdminClient()
  const row={user_id:user.id,birth_date:birth,status:"pending",requested_at:new Date().toISOString(),reviewed_at:null,reviewed_by:null,evidence_ref:null}
  // Only a rejected request may be resubmitted. No client can replace a pending review.
  const previous=await db.from("sello_age_review_requests").select("status").eq("user_id",user.id).maybeSingle()
  if(previous.error)return privateResponse({error:"No se pudo comprobar tu solicitud."},503)
  const result=previous.data
    ?await db.from("sello_age_review_requests").update(row).eq("user_id",user.id).eq("status","rejected").select("user_id").maybeSingle()
    :await db.from("sello_age_review_requests").insert(row).select("user_id").single()
  if(result.error||!result.data)return privateResponse({error:"No se pudo registrar la solicitud; verifica su estado."},409)
  return privateResponse({ok:true,message:"Fecha declarada enviada a revisión. No se activaron permisos."})
 }catch{return privateResponse({error:"No se pudo registrar la solicitud."},503)}
}
