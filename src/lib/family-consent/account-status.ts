import { createFamilyAdminClient } from "@/lib/family-consent/server"
import { hasLegacyConsentGrace,shouldEnforceFamilyConsent } from "@/lib/family-consent/transition"
import type { User } from "@supabase/supabase-js"
export const SELLO_PRIVACY_VERSION="sello-2026-10-v1"
export function ageCategory(raw:unknown,now=new Date()):"unknown"|"minor"|"adult"{
 const s=typeof raw==="string"?raw:""
 const d=new Date(s+"T00:00:00Z")
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s||d>now||d.getUTCFullYear()<1900)return "unknown"
 const threshold=new Date(Date.UTC(now.getUTCFullYear()-18,now.getUTCMonth(),now.getUTCDate()))
 return d>threshold?"minor":"adult"
}
export async function getAccountStatus(user:User){
 const db=createFamilyAdminClient()
 const [profile,age,consent]=await Promise.all([
  db.from("profiles").select("role,blocked").eq("id",user.id).maybeSingle(),
  db.from("family_age_status").select("declared_birth_date,captured_at").eq("user_id",user.id).maybeSingle(),
  db.from("sello_privacy_choices").select("version,terms_acknowledged_at,choices").eq("user_id",user.id).maybeSingle()
 ])
 if(profile.error||age.error||consent.error||!profile.data)throw Error("No se pudo comprobar el estado de la cuenta.")
 const isAdmin=profile.data.role==="admin"&&!profile.data.blocked
 const category=ageCategory(age.data?.declared_birth_date)
 const accepted=consent.data?.version===SELLO_PRIVACY_VERSION&&Boolean(consent.data.terms_acknowledged_at)
 const legacy=hasLegacyConsentGrace(user.created_at)
 let approval="pending",ageRequest="none",familyApproved=false
 if(category==="unknown"&&!isAdmin){
  const r=await db.from("sello_age_review_requests").select("status").eq("user_id",user.id).maybeSingle()
  if(r.error)throw Error("No se pudo comprobar la edad.")
  ageRequest=r.data?.status||"none"
 }else if(category==="unknown"&&isAdmin){
  // Optional metadata must not deny administrative access if its lookup fails.
  const r=await db.from("sello_age_review_requests").select("status").eq("user_id",user.id).maybeSingle()
  if(!r.error)ageRequest=r.data?.status||"none"
 }
 if(accepted&&!isAdmin){
  const [approved,latest]=await Promise.all([
   db.from("sello_privacy_reviews").select("event_id").eq("user_id",user.id).eq("version",SELLO_PRIVACY_VERSION).eq("decision","approved").limit(1).maybeSingle(),
   db.from("sello_privacy_choice_events").select("id").eq("user_id",user.id).eq("version",SELLO_PRIVACY_VERSION).order("id",{ascending:false}).limit(1).maybeSingle()
  ])
  if(approved.error||latest.error)throw Error("No se pudo comprobar la revisión de condiciones.")
  if(approved.data)approval="approved"
  else if(latest.data){
   const r=await db.from("sello_privacy_reviews").select("decision").eq("event_id",latest.data.id).maybeSingle()
   if(r.error)throw Error("No se pudo consultar la revisión.")
   approval=r.data?.decision||"pending"
  }
 }
 const familyRequired=category==="minor"&&(!legacy||shouldEnforceFamilyConsent(user.created_at,age.data?.captured_at,process.env.SELLO_FAMILY_CONSENT_ENFORCE==="true"))
 if(familyRequired){
  const r=await db.from("family_authorization_requests").select("status,decisions,document_version").eq("student_user_id",user.id).eq("platform","sello").in("status",["approved","revoked"]).order("updated_at",{ascending:false}).limit(1).maybeSingle()
  if(r.error)throw Error("No se pudo verificar autorización familiar.")
  familyApproved=r.data?.status==="approved"&&r.data.document_version==="family-2026-10-v1"&&r.data.decisions?.platform_access===true
 }
 const next=profile.data.blocked?"/bloqueado":!accepted&&!legacy?"/consentimiento":isAdmin&&!familyRequired?"/dashboard":category==="unknown"&&!isAdmin&&!legacy?"/autorizacion-pendiente":familyRequired&&!familyApproved?"/autorizacion-pendiente":!isAdmin&&!legacy&&approval!=="approved"?"/autorizacion-pendiente":"/dashboard"
 return {accepted,choices:consent.data?.choices||{},acceptedAt:consent.data?.terms_acknowledged_at||null,isAdmin,role:profile.data.role,blocked:Boolean(profile.data.blocked),age:category,ageRequest,approval,familyRequired,familyApproved,next}
}
