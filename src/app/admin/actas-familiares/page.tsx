"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type Act = {folio:string;record_type:"borrador"|"aprobacion";request_id:string|null;
 student_name:string|null;guardian_name:string|null;guardian_relationship:string|null;
 institution_name:string|null;reviewer_name:string;approved_at:string|null;
 verified_method:string|null;evidence_reference:string|null;document_version:string|null;
 authorization_status:string;created_at:string;notes:string|null;revoked_at:string|null}
function localDate(t:string|null) {
 if(!t)return "—"
 return new Date(t).toLocaleString("es-CL",{timeZone:"America/Santiago",dateStyle:"medium",timeStyle:"short"})
}
export default function SelloActasPage(){
 const [acts,setActs]=useState<Act[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [search,setSearch]=useState("")
 const [filter,setFilter]=useState("all")
 const [hasMore,setHasMore]=useState(false)
 useEffect(()=>{
  let active=true
  fetch("/api/admin/actas-familiares",{cache:"no-store",credentials:"same-origin"})
    .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"No autorizado");return data})
    .then(r=>{if(active){setActs(r.acts||[]);setHasMore(r.hasMore===true)}})
    .catch(e=>{if(active)setError(e instanceof Error?e.message:"No se pudo cargar el archivo")})
    .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[])
 const visible=useMemo(()=>acts.filter(a=>
   (filter==="all"||a.record_type===filter)&&
   [a.folio,a.student_name,a.guardian_name,a.reviewer_name].some(v=>
     String(v||"").toLocaleLowerCase("es-CL").includes(search.toLocaleLowerCase("es-CL")))
 ),[acts,filter,search])
 const official=acts.filter(a=>a.record_type==="aprobacion").length
 const drafts=acts.filter(a=>a.record_type==="borrador").length
 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
  <div className="mx-auto max-w-6xl space-y-5">
   <nav className="flex flex-wrap gap-4 text-sm text-blue-700">
    <Link href="/admin">← Administración</Link>
    <Link href="/admin/autorizaciones-familiares">Revisar autorizaciones</Link>
   </nav>
   <header className="rounded-2xl bg-blue-950 p-6 text-white">
    <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Archivo privado · Sello Tecnológico</p>
    <h1 className="mt-2 text-2xl font-bold">Actas de autorización familiar</h1>
    <p className="mt-3 text-sm text-blue-100">Archivo institucional con fecha, hora, folio, estudiante, apoderado y responsable. Solo administradores pueden consultarlo.</p>
   </header>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <div className="rounded-xl border bg-white p-4"><p className="text-2xl font-bold">{official}</p><p className="text-sm">Aprobaciones reales</p></div>
    <div className="rounded-xl border bg-white p-4"><p className="text-2xl font-bold">{drafts}</p><p className="text-sm">Borradores ficticios</p></div>
    <div className="col-span-2 rounded-xl border bg-white p-4 sm:col-span-1"><p className="text-2xl font-bold">ACTA</p><p className="text-sm">Folios oficiales automáticos</p></div>
   </div>
   <section className="rounded-xl border bg-white p-5">
    <div className="flex flex-wrap items-center gap-3">
     <input aria-label="Buscar actas" value={search} onChange={e=>setSearch(e.target.value)}
      placeholder="Buscar por folio, estudiante o nombre"
      className="w-full flex-1 rounded-lg border border-slate-300 p-3 text-sm sm:min-w-64"/>
     <select aria-label="Tipo de acta" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-slate-300 p-3 text-sm">
      <option value="all">Todas</option><option value="aprobacion">Actas oficiales</option>
      <option value="borrador">Borradores</option>
     </select>
    </div>
    {loading&&<p className="mt-4 text-sm">Cargando actas…</p>}
    {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {hasMore&&<p className="mt-4 text-sm text-amber-700">Se muestran solo las 300 más recientes; las anteriores permanecen archivadas.</p>}
    {!loading&&!error&&!visible.length&&<p className="mt-4 text-sm text-slate-600">No hay actas en esta categoría.</p>}
    <div className="mt-4 space-y-4">
     {visible.map(a=><article key={a.folio} className={"rounded-xl border p-5 "+(a.record_type==="borrador"?"border-amber-300 bg-amber-50":"border-slate-200 bg-white")}>
      <div className="flex flex-wrap justify-between gap-3">
       <div><h2 className="text-lg font-bold">{a.folio}</h2>
        <p className="mt-1 text-sm text-slate-700">{a.record_type==="borrador"?"Creación del ejemplo: ":"Aprobación institucional: "}{localDate(a.approved_at||a.created_at)} (Chile)</p>
       </div>
       <span className={"h-fit rounded-full px-3 py-1 text-xs font-bold "+(a.record_type==="borrador"?"bg-amber-200 text-amber-950":"bg-emerald-100 text-emerald-800")}>
        {a.record_type==="borrador"?"BORRADOR · SIN VALIDEZ":"ACTA OFICIAL"}</span>
      </div>
      {a.record_type==="borrador"&&<p className="mt-3 rounded-lg border border-amber-300 p-3 text-sm font-semibold text-amber-950">
        Documento ficticio de demostración. No existe firma, verificación del apoderado ni aprobación institucional. No habilita cuentas.
      </p>}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
       <div><dt className="text-xs text-slate-500">Estudiante</dt><dd>{a.student_name||"—"}</dd></div>
       <div><dt className="text-xs text-slate-500">Apoderado</dt><dd>{a.guardian_name||"—"} · {a.guardian_relationship||"—"}</dd></div>
       <div><dt className="text-xs text-slate-500">Administrador revisor</dt><dd>{a.reviewer_name}</dd></div>
       <div><dt className="text-xs text-slate-500">Estado</dt><dd>{a.authorization_status}</dd></div>
       <div><dt className="text-xs text-slate-500">Método de verificación</dt><dd>{a.verified_method||"No corresponde"}</dd></div>
       <div><dt className="text-xs text-slate-500">Referencia de evidencia</dt><dd>{a.evidence_reference||"No corresponde"}</dd></div>
      </dl>
      {a.revoked_at&&<p className="mt-3 text-xs text-red-700">Revocada: {localDate(a.revoked_at)}. Se conserva el registro histórico.</p>}
      {a.notes&&<p className="mt-3 text-xs text-amber-900">{a.notes}</p>}
     </article>)}
    </div>
   </section>
  </div>
 </main>
}
