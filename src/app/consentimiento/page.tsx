"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { familyPurposes } from "@/lib/family-consent/config"

const VERSION="sello-2026-10-v1"
const purposes=familyPurposes("sello").filter(p=>p.key!=="platform_access")
const optionalDefault=()=>Object.fromEntries(purposes.map(p=>[p.key,false]))
export default function SelloFirstConsentPage(){
 const router=useRouter()
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState("")
 const [terms,setTerms]=useState(false)
 const [minor,setMinor]=useState(true)
 const [choices,setChoices]=useState<Record<string,boolean>>(optionalDefault())
 useEffect(()=>{
  let live=true
  const init=async()=>{
   const db=createClient()
   const {data:{user},error:sessionError}=await db.auth.getUser()
   if(sessionError||!user){router.replace("/login");return}
   const birth=String(user.user_metadata?.birth_date||"")
   const dob=new Date(birth+"T00:00:00"),now=new Date()
   const under18=!birth||Number.isNaN(dob.getTime())||
     dob>new Date(now.getFullYear()-18,now.getMonth(),now.getDate())
   if(live)setMinor(under18)
   const {data:record,error:readError}=await db.from("sello_privacy_choices")
     .select("version,terms_acknowledged_at").eq("user_id",user.id).maybeSingle()
   if(!live)return
   if(readError){setError("No pudimos verificar las preferencias de la cuenta.");setLoading(false);return}
   if(record?.version===VERSION&&record.terms_acknowledged_at){
     router.replace(under18?"/autorizacion-pendiente":"/dashboard")
     return
   }
   setLoading(false)
  }
  void init()
  return ()=>{live=false}
 },[router])
 async function save(event:React.FormEvent){
  event.preventDefault()
  if(!terms){setError("Debes reconocer las condiciones necesarias.");return}
  setSaving(true);setError("")
  const db=createClient()
  const {error:writeError}=await db.rpc("record_sello_privacy_choices",{
    p_policy_version:VERSION,p_terms_acknowledged:true,
    p_choices:minor?optionalDefault():choices,
  })
  if(writeError){setError("No fue posible guardar la aceptación. Intenta nuevamente.");setSaving(false);return}
  router.replace(minor?"/autorizacion-pendiente":"/dashboard")
  router.refresh()
 }
 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
  <div className="mx-auto max-w-xl space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
   <Link href="/proteccion-datos" className="text-sm text-blue-700 underline">Política de datos personales</Link>
   <h1 className="text-2xl font-bold text-blue-900">Condiciones y preferencias iniciales</h1>
   <p className="text-sm text-slate-600">Este formulario solo se solicita cuando no existe una aceptación registrada de la versión vigente. Tus decisiones y la fecha original se conservarán en tu cuenta.</p>
   {loading?<p className="text-sm">Consultando el registro…</p>:<form onSubmit={save} className="space-y-4">
    <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
     <input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} className="mt-1"/>
     <span>Declaro que he leído y reconozco las condiciones necesarias de Sello Tecnológico. Esto no autoriza finalidades opcionales.</span>
    </label>
    <h2 className="font-semibold">Decisiones opcionales independientes</h2>
    {purposes.map(p=><label key={p.key} className="flex items-start gap-3 rounded-xl border p-3 text-sm">
      <input type="checkbox" disabled={minor} checked={!minor&&choices[p.key]===true}
       onChange={e=>setChoices({...choices,[p.key]:e.target.checked})} className="mt-1"/>
      <span><strong className="block">{p.title}</strong><span className="text-xs text-slate-600">{p.description}</span></span>
    </label>)}
    {minor&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Las finalidades opcionales de menores requieren autorización familiar separada. Registrar estas condiciones no habilita el acceso.</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={saving||!terms} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-40">
      {saving?"Guardando…":"Guardar aceptación y continuar"}
    </button>
   </form>}
   {loading&&error&&<p role="alert" className="text-red-700">{error}</p>}
  </div>
 </main>
}
