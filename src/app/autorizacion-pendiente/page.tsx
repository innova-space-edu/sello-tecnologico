"use client"
import {useCallback,useEffect,useRef,useState} from "react"
import {useRouter} from "next/navigation"
import Link from "next/link"
import {createClient} from "@/lib/supabase"
type Status={age:string;ageRequest:string;approval:string;accepted:boolean;isAdmin:boolean;familyRequired:boolean;familyApproved:boolean;next:string}
export default function FamilyAuthorizationPending(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[status,setStatus]=useState<Status|null>(null),[birthDate,setBirthDate]=useState("")
 const router=useRouter(),automaticRequestStarted=useRef(false)
 const check=useCallback(async()=>{
  const res=await fetch("/api/privacy/self",{cache:"no-store"})
  const data=await res.json()
  if(!res.ok)throw Error(data.error||"No se pudo consultar tu cuenta.")
  setStatus(data)
  if(data.next==="/consentimiento"||data.next==="/bloqueado"||(data.next==="/dashboard"&&!(data.isAdmin&&data.age==="unknown"))){router.replace(data.next);router.refresh()}
  return data as Status
 },[router])
 const verifyOrSend=useCallback(async()=>{
  setBusy(true);setMessage("")
  try{
   const current=await check()
   // Never send family invitations to adults or accounts of unknown age.
   if(current.age==="minor"&&current.familyRequired&&!current.familyApproved){
    const result=await fetch("/api/family-consent/self/invite",{method:"POST",cache:"no-store"})
    const data=await result.json().catch(()=>({}))
    if(!result.ok){setMessage(data.error||"No se pudo solicitar el envío.");return}
    setMessage(data.message||"Autorización familiar pendiente.")
    if(data.status==="approved")await check()
   }
  }catch(e){setMessage(e instanceof Error?e.message:"No se pudo contactar al servidor.")}
  finally{setBusy(false)}
 },[check])
 useEffect(()=>{if(automaticRequestStarted.current)return;automaticRequestStarted.current=true;void verifyOrSend()},[verifyOrSend])
 async function requestAge(){
  setBusy(true);setMessage("")
  try{
   const res=await fetch("/api/privacy/self",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({birthDate})})
   const data=await res.json()
   if(!res.ok)throw Error(data.error||"No se pudo guardar.")
   setMessage(data.message);await check()
  }catch(e){setMessage(e instanceof Error?e.message:"No se pudo enviar la solicitud.")}
  finally{setBusy(false)}
 }
 return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 text-slate-900">
 <div className="w-full max-w-xl space-y-4 rounded-3xl border bg-white p-8 shadow-sm">
 <p className="text-xs font-bold uppercase tracking-widest text-blue-700">CreaLab · verificación de cuenta</p>
 {!status?<h1 className="text-2xl font-bold">Consultando estado de acceso</h1>:status.age==="unknown"?<>
  <h1 className="text-2xl font-bold">Regularizar fecha de nacimiento</h1>
  <p className="text-sm leading-6">Tu cuenta no tiene una fecha registrada. Esto no significa que seas menor de edad. Declara la fecha para que administración la verifique de forma independiente.</p>
  {status.ageRequest==="pending"?<p className="rounded-xl bg-amber-50 p-3 text-sm">Solicitud pendiente de revisión institucional.</p>:<form className="space-y-3" onSubmit={e=>{e.preventDefault();void requestAge()}}><label className="block text-sm font-medium">Fecha de nacimiento<input type="date" required value={birthDate} onChange={e=>setBirthDate(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label><button disabled={busy} className="w-full rounded-xl bg-blue-700 p-3 font-semibold text-white disabled:opacity-50">Enviar fecha a revisión</button></form>}
  {status.isAdmin&&<Link href="/dashboard" className="block text-sm font-semibold text-blue-700 underline">Continuar como administrador</Link>}
 </>:status.familyRequired&&!status.familyApproved?<><h1 className="text-2xl font-bold">Autorización familiar pendiente</h1><p className="text-sm leading-6">Un representante debe firmar y la institución verificar identidad y representación. El acceso se habilita tras la aprobación institucional.</p></>:<>
  <h1 className="text-2xl font-bold">{status.approval==="rejected"?"Revisión de condiciones observada":"Condiciones en revisión"}</h1>
  <p className="text-sm leading-6">Tus decisiones se registraron. Administración revisará el acta antes de habilitar el acceso. No necesitas aceptar nuevamente en cada sesión.</p>
  {status.approval==="rejected"&&<Link href="/consentimiento?review=1" className="block font-semibold text-blue-700 underline">Revisar y reenviar mis decisiones</Link>}
 </>}
 <button type="button" onClick={()=>void verifyOrSend()} disabled={busy} className="w-full rounded-xl border border-blue-300 p-3 text-sm font-semibold text-blue-700 disabled:opacity-50">{busy?"Verificando…":"Actualizar estado de revisión"}</button>
 {message&&<p role="status" className="rounded-xl border bg-slate-100 p-3 text-sm">{message}</p>}
 <button type="button" onClick={async()=>{await createClient().auth.signOut();router.replace("/login");router.refresh()}} className="text-sm text-slate-600 underline">Cerrar sesión</button>
 </div></main>
}
