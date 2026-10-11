"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { familyPurposes } from "@/lib/family-consent/config"
import Link from "next/link"

const optional = familyPurposes("sello").filter(p => p.key !== "platform_access")
export default function PrivacySettings() {
 const [choices,setChoices] = useState<Record<string,boolean>>(Object.fromEntries(optional.map(p=>[p.key,false])))
 const [minor,setMinor] = useState(true)
 const [status,setStatus] = useState("Cargando…")
 const [busy,setBusy] = useState(false)
 useEffect(()=>{
  const load = async () => {
   const db=createClient()
   const {data:{user}}=await db.auth.getUser()
   if(!user){setStatus("Inicia sesión para consultar tus opciones.");return}
   const dob=String(user.user_metadata?.birth_date||"")
   const d=new Date(dob+"T00:00:00"), now=new Date()
   const isMinor=!dob||Number.isNaN(d.getTime())||d>new Date(now.getFullYear()-18,now.getMonth(),now.getDate())
   setMinor(isMinor)
   const {data,error}=await db.from("sello_privacy_choices").select("choices").eq("user_id",user.id).maybeSingle()
   if(error){setStatus("No se pudieron consultar los permisos. Solicita apoyo.");return}
   if(data?.choices && typeof data.choices==="object")setChoices(Object.fromEntries(optional.map(p=>[p.key,data.choices[p.key]===true])))
   setStatus(isMinor?"Los permisos de cuentas menores se determinan mediante el formulario familiar aprobado.":"Cambia o retira cada permiso voluntario.")
  }
  void load()
 },[])
 async function save(){
  setBusy(true);setStatus("")
  const db=createClient()
  const {error}=await db.rpc("record_sello_privacy_choices",{
   p_policy_version:"sello-2026-10-v1",p_terms_acknowledged:true,
   p_choices:minor?Object.fromEntries(optional.map(p=>[p.key,false])):choices,
  })
  setBusy(false)
  setStatus(error?"No se pudieron guardar las preferencias.":"Las decisiones quedaron registradas y pueden modificarse nuevamente.")
 }
 return <main className="min-h-screen bg-slate-50 px-4 py-8">
  <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border bg-white p-6 text-slate-900">
   <h1 className="text-2xl font-bold">Mis consentimientos — Sello Tecnológico</h1>
   <p className="text-sm">Las respuestas se asocian a tu cuenta con registro de fecha y versión. Las autorizaciones familiares se administran por separado y requieren una firma y aprobación institucional.</p>
   {optional.map(p=><label key={p.key} className="flex items-start gap-3 rounded-xl border p-3 text-sm">
    <input type="checkbox" className="mt-1" disabled={minor} checked={!minor&&choices[p.key]} onChange={e=>setChoices({...choices,[p.key]:e.target.checked})}/>
    <span><strong className="block">{p.title}</strong><span className="text-xs">{p.description}</span></span>
   </label>)}
   <p role="status" className="text-sm">{status}</p>
   <button type="button" onClick={save} disabled={minor||busy} className="rounded-xl bg-blue-700 px-4 py-3 text-white disabled:opacity-40">
    {busy?"Guardando…":"Guardar decisiones y revocaciones"}
   </button>
   <div><Link className="text-sm text-blue-700 underline" href="/proteccion-datos">Protección de datos</Link></div>
  </div>
 </main>
}