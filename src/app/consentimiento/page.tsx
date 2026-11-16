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
 const [ready,setReady]=useState(false)
 const [unknownAge,setUnknownAge]=useState(false)
 const [choices,setChoices]=useState<Record<string,boolean>>(optionalDefault())
 useEffect(()=>{
  let live=true
  const init=async()=>{
   const db=createClient()
   const {data:{user},error:sessionError}=await db.auth.getUser()
   if(sessionError||!user){router.replace("/login");return}
   try{
     const res=await fetch("/api/privacy/self",{cache:"no-store"})
     const status=await res.json()
     if(!res.ok)throw Error(status.error||"No se pudo consultar tu cuenta.")
     if(!live)return
     setMinor(status.age!=="adult");setUnknownAge(status.age==="unknown");setReady(true)
     setChoices({...optionalDefault(),...status.choices})
     const resubmit=new URLSearchParams(window.location.search).get("review")==="1"&&status.approval==="rejected"
     if(status.accepted&&!resubmit){router.replace(status.next);return}
   }catch(e){if(live)setError(e instanceof Error?e.message:"No pudimos verificar las preferencias de la cuenta.")}
   setLoading(false)
  }
  void init()
  return ()=>{live=false}
 },[router])
 async function save(event:React.FormEvent){
  event.preventDefault()
  if(!ready||!terms){setError("Debes reconocer las condiciones necesarias.");return}
  setSaving(true);setError("")
  const db=createClient()
  const {error:writeError}=await db.rpc("record_sello_privacy_choices",{
    p_policy_version:VERSION,p_terms_acknowledged:true,
    p_choices:minor?optionalDefault():choices,
  })
  if(writeError){setError("No fue posible guardar la aceptación. Intenta nuevamente.");setSaving(false);return}
  const verified=await fetch("/api/privacy/self",{cache:"no-store"}).then(async res=>res.ok?res.json():null).catch(()=>null)
  if(!verified?.accepted){setError("No se pudo confirmar el registro.");setSaving(false);return}
  router.replace(verified.next)
  router.refresh()
 }
 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
  <div className="mx-auto max-w-xl space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
   <Link href="/proteccion-datos" className="text-sm text-blue-700 underline">Política de datos personales</Link>
   <h1 className="text-2xl font-bold text-blue-900">Condiciones y preferencias iniciales</h1>
   <p className="text-sm text-slate-600">Registra las condiciones una vez por versión. Administración podrá revisar el acta con tus decisiones. No se vuelven a solicitar al iniciar sesión si ya fueron registradas.</p>
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
    {minor&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{unknownAge?"Tu fecha de nacimiento aún no está verificada en la plataforma. Puedes registrar las condiciones necesarias y regularizar la edad por separado.":"Las finalidades opcionales de menores requieren autorización familiar separada."}</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={saving||!ready||!terms} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-40">
      {saving?"Guardando…":"Guardar aceptación y continuar"}
    </button>
   </form>}
   {loading&&error&&<p role="alert" className="text-red-700">{error}</p>}
  </div>
 </main>
}
