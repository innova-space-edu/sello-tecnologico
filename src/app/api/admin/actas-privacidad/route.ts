import { NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createFamilyAdminClient, privateResponse, safeText } from "@/lib/family-consent/server"

async function adminSession(){
 const session=await createServerSupabaseClient()
 const {data:{user},error}=await session.auth.getUser()
 if(error||!user)return null
 const db=createFamilyAdminClient()
 const {data:profile,error:roleError}=await db.from("profiles").select("role,blocked").eq("id",user.id).maybeSingle()
 if(roleError||profile?.role!=="admin"||profile.blocked)return null
 return {user,db}
}
export async function GET(request:NextRequest){
 try{
  const admin=await adminSession()
  if(!admin)return privateResponse({error:"Acceso exclusivo de administración."},403)
  const {db,user}=admin
  const before=request.nextUrl.searchParams.get("before")
  if(before&&!/^\d{1,18}$/.test(before))return privateResponse({error:"Paginación inválida."},400)
  let query=db.from("sello_privacy_choice_events").select("id,user_id,version,choices,recorded_at").order("id",{ascending:false}).limit(101)
  if(before)query=query.lt("id",before)
  const [events,ages]=await Promise.all([query,db.from("sello_age_review_requests").select("user_id,birth_date,status,requested_at,reviewed_at,evidence_ref").eq("status","pending").order("requested_at",{ascending:true}).limit(200)])
  if(events.error||ages.error)return privateResponse({error:"No fue posible consultar los registros."},503)
  const rows=(events.data||[]).slice(0,100)
  const ids=[...new Set([...rows.map(r=>r.user_id),...(ages.data||[]).map(r=>r.user_id)])]
  const [profiles,reviews]=await Promise.all([
   ids.length?db.from("profiles").select("id,full_name,email,role").in("id",ids):Promise.resolve({data:[],error:null}),
   rows.length?db.from("sello_privacy_reviews").select("event_id,decision,reviewed_at,reviewer_id,note").in("event_id",rows.map(r=>r.id)):Promise.resolve({data:[],error:null})
  ])
  if(profiles.error||reviews.error)return privateResponse({error:"No se pudo completar el registro."},503)
  const names=new Map((profiles.data||[]).map(p=>[p.id,p]))
  const decisions=new Map((reviews.data||[]).map(r=>[String(r.event_id),r]))
  return privateResponse({acts:rows.map(r=>({...r,folio:"ACTA-PRIV-"+r.id,profile:names.get(r.user_id)||null,review:decisions.get(String(r.id))||null,own:r.user_id===user.id})),ages:(ages.data||[]).map(r=>({...r,profile:names.get(r.user_id)||null,own:r.user_id===user.id})),next:(events.data||[]).length>100?String(rows[rows.length-1]?.id):null})
 }catch{return privateResponse({error:"No se pudo consultar el archivo privado."},503)}
}
export async function POST(request:NextRequest){
 try{
  const admin=await adminSession()
  if(!admin)return privateResponse({error:"Acceso exclusivo de administración."},403)
  const {db,user}=admin
  const body=await request.json().catch(()=>null)
  if(!body||!["approved","rejected"].includes(body.decision)||body.confirmed!==true)return privateResponse({error:"Confirma expresamente la revisión."},400)
  const note=safeText(body.note,180)
  if(note.length<3)return privateResponse({error:"Registra un motivo o referencia de verificación."},400)
  if(body.kind==="age"){
   const target=safeText(body.userId,40)
   if(!/^[0-9a-f-]{36}$/i.test(target)||target===user.id)return privateResponse({error:"La edad debe ser revisada por otro administrador."},403)
   const {error}=await db.rpc("sello_review_missing_age",{p_user:target,p_reviewer:user.id,p_approve:body.decision==="approved",p_evidence:note})
   if(error)return privateResponse({error:"No se pudo guardar la revisión de edad. Comprueba que siga pendiente."},409)
   return privateResponse({ok:true})
  }
  if(body.kind!=="privacy"||!/^\d{1,18}$/.test(String(body.eventId)))return privateResponse({error:"Acta inválida."},400)
  const event=await db.from("sello_privacy_choice_events").select("id,user_id,version").eq("id",String(body.eventId)).maybeSingle()
  if(event.error||!event.data)return privateResponse({error:"Acta no encontrada."},404)
  if(event.data.user_id===user.id)return privateResponse({error:"Otro administrador debe revisar tu propia acta."},403)
  const {error}=await db.from("sello_privacy_reviews").insert({event_id:event.data.id,user_id:event.data.user_id,version:event.data.version,reviewer_id:user.id,decision:body.decision,note})
  if(error)return privateResponse({error:"El acta ya fue revisada o no pudo guardarse."},409)
  return privateResponse({ok:true})
 }catch{return privateResponse({error:"No se pudo registrar la revisión."},503)}
}
