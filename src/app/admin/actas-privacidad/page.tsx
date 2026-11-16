"use client"
import Link from "next/link"
import {useEffect,useState} from "react"
import {familyPurposes} from "@/lib/family-consent/config"
type Profile={full_name:string;email:string;role:string}
type Review={decision:string;reviewed_at:string;reviewer_id:string;note:string}
type Act={id:number|string;folio:string;user_id:string;version:string;choices:Record<string,boolean>;recorded_at:string;profile:Profile|null;own:boolean;review:Review|null}
type Age={user_id:string;birth_date:string;status:string;requested_at:string;profile:Profile|null;own:boolean}
const date=(value:string)=>new Date(value).toLocaleString("es-CL",{timeZone:"America/Santiago"})
export default function PrivacyActs(){
 const [acts,setActs]=useState<Act[]>([]),[ages,setAges]=useState<Age[]>([]),[next,setNext]=useState<string|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("")
 const [note,setNote]=useState(""),[reviewing,setReviewing]=useState<{kind:"age"|"privacy";id:string;decision:"approved"|"rejected"}|null>(null),[confirmed,setConfirmed]=useState(false)
 async function load(before?:string){
  setBusy(true);setError("")
  try{
   const res=await fetch("/api/admin/actas-privacidad"+(before?"?before="+encodeURIComponent(before):""),{cache:"no-store"})
   const data=await res.json()
   if(!res.ok)throw Error(data.error||"No se pudo cargar el archivo.")
   setActs(old=>before?[...old,...data.acts]:data.acts);setAges(data.ages);setNext(data.next)
  }catch(e){setError(e instanceof Error?e.message:"No se pudo cargar el archivo.")}
  finally{setBusy(false)}
 }
 useEffect(()=>{void load()},[])
 function start(kind:"age"|"privacy",id:string,decision:"approved"|"rejected"){setReviewing({kind,id,decision});setNote("");setConfirmed(false)}
 async function submit(){
  if(!reviewing||!confirmed||note.trim().length<3)return
  setBusy(true);setError("")
  try{
   const res=await fetch("/api/admin/actas-privacidad",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:reviewing.kind,[reviewing.kind==="age"?"userId":"eventId"]:reviewing.id,decision:reviewing.decision,note,confirmed})})
   const data=await res.json()
   if(!res.ok)throw Error(data.error||"No se pudo registrar la revisión.")
   setReviewing(null);await load()
  }catch(e){setError(e instanceof Error?e.message:"No se pudo revisar.")}
  finally{setBusy(false)}
 }
 return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8"><div className="mx-auto max-w-5xl space-y-5">
 <nav className="flex flex-wrap gap-4 text-sm text-blue-700"><Link href="/admin">← Administración</Link><Link href="/admin/actas-familiares">Actas familiares</Link><Link href="/admin/autorizaciones-familiares">Autorizaciones familiares</Link></nav>
 <header className="rounded-2xl bg-blue-950 p-6 text-white"><h1 className="text-2xl font-bold">Actas de privacidad y revisión de cuentas</h1><p className="mt-2 text-sm text-blue-100">Archivo privado. Las decisiones del titular son independientes de la aprobación institucional. No se convierten rechazos de permisos opcionales en aceptaciones.</p></header>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
 <section className="space-y-3 rounded-xl border bg-white p-4"><h2 className="font-bold">Fechas de nacimiento pendientes de verificar</h2>
 {!ages.length&&!busy&&<p className="text-sm text-slate-600">Sin solicitudes pendientes.</p>}
 {ages.map(a=><article key={a.user_id} className="rounded-lg border p-3"><p className="font-semibold">{a.profile?.full_name||"Cuenta registrada"} · {a.profile?.email||a.user_id}</p><p className="text-sm">Fecha declarada: {a.birth_date} · Solicitud: {date(a.requested_at)}</p>
 {a.own?<p className="text-xs text-slate-600">Otro administrador debe verificar tu fecha.</p>:<div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>start("age",a.user_id,"approved")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white">Verificar y aprobar edad</button><button disabled={busy} onClick={()=>start("age",a.user_id,"rejected")} className="rounded-lg border px-3 py-2 text-sm">Observar</button></div>}</article>)}
 </section>
 <section className="space-y-3"><h2 className="font-bold">Declaraciones registradas</h2>
 {acts.map(a=><article key={a.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-blue-900">{a.folio}</h3><span className="text-sm">{date(a.recorded_at)}</span></div><p className="mt-1 text-sm">{a.profile?.full_name||"Titular registrado"} · {a.profile?.email||a.user_id} · {a.profile?.role||"—"}</p><p className="text-xs text-slate-600">Versión {a.version} · {a.review?.decision==="approved"?"Revisada y aprobada":a.review?.decision==="rejected"?"Observada":"Pendiente de revisión"}</p>
 <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div>Condiciones necesarias: <strong>Sí</strong></div>{familyPurposes("sello").filter(p=>p.key!=="platform_access").map(p=><div key={p.key}>{p.title}: <strong>{a.choices?.[p.key]===true?"Sí":a.choices?.[p.key]===false?"No":"No consta"}</strong></div>)}</dl>
 {a.review?<p className="mt-3 text-xs text-slate-600">Revisión: {date(a.review.reviewed_at)} · Responsable: {a.review.reviewer_id} · {a.review.note}</p>:a.own?<p className="mt-3 text-xs text-slate-600">Otro administrador debe revisar esta acta. Tu rol no depende de autoaprobarla.</p>:<div className="mt-3 flex gap-2"><button disabled={busy} onClick={()=>start("privacy",String(a.id),"approved")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white">Aprobar acta</button><button disabled={busy} onClick={()=>start("privacy",String(a.id),"rejected")} className="rounded-lg border px-3 py-2 text-sm">Observar acta</button></div>}</article>)}
 {!acts.length&&!busy&&<p className="text-sm">No existen declaraciones registradas.</p>}{next&&<button disabled={busy} onClick={()=>void load(next)} className="rounded-lg border bg-white p-2">Cargar anteriores</button>}
 </section>{busy&&<p role="status">Consultando registros…</p>}
 {reviewing&&<div role="dialog" aria-modal="true" aria-label="Confirmar revisión" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={e=>{e.preventDefault();void submit()}} className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5"><h2 className="font-bold">{reviewing.decision==="approved"?"Confirmar aprobación":"Registrar observación"}</h2><label className="block text-sm">Referencia o motivo de revisión (sin datos sensibles)<textarea required value={note} onChange={e=>setNote(e.target.value)} className="mt-1 w-full rounded-lg border p-3" maxLength={180}/></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>{reviewing.kind==="age"?"He comprobado la identidad y fecha de nacimiento mediante un respaldo institucional.":"He revisado las decisiones registradas sin sustituirlas ni conceder finalidades rechazadas."}</span></label><div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>setReviewing(null)} className="rounded-lg border p-2">Cancelar</button><button disabled={busy||!confirmed||note.trim().length<3} className="rounded-lg bg-blue-700 p-2 text-white disabled:opacity-40">Registrar revisión</button></div></form></div>}
 </div></main>
}
