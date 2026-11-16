'use client'
import {useState} from 'react'
import {createClient} from '@/lib/supabase'
import {CREATIVE_BUCKET,CREATIVE_MAX_BYTES,CREATIVE_MIMES,CREATIVE_EXTENSIONS,normalizeCreativeTags} from '@/lib/creative-space-public'
type Work={id:string;title:string;author:string;description:string;tags:string[];updatedAt:string}
export default function CreativeAdminEdit({work,onClose,onSaved}:{work:Work;onClose:()=>void;onSaved:()=>void}){
 const [title,setTitle]=useState(work.title),[author,setAuthor]=useState(work.author),[description,setDescription]=useState(work.description||''),[tagsText,setTagsText]=useState((work.tags||[]).join(', ')),[replacement,setReplacement]=useState<File|null>(null),[rights,setRights]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function save(){
  if(busy||!rights)return
  setBusy(true);setError('')
  try{
   const tags=tagsText.trim()?normalizeCreativeTags(tagsText.split(',')):[]
   if(!tags)throw Error('Usa hasta 8 etiquetas de 24 caracteres.')
   let nextFile=null
   if(replacement){
    const ext=replacement.name.split('.').pop()?.toLowerCase()||''
    if(!CREATIVE_MIMES[replacement.type]||!CREATIVE_EXTENSIONS[replacement.type]?.includes(ext)||replacement.size<=0||replacement.size>CREATIVE_MAX_BYTES)throw Error('Formato no compatible o archivo superior a 50 MB.')
    const client=createClient(),{data:{user},error:authError}=await client.auth.getUser()
    if(authError||!user)throw Error('Inicia sesión.')
    const path=user.id+'/'+crypto.randomUUID()+'.'+ext
    const {error:uploadError}=await client.storage.from(CREATIVE_BUCKET).upload(path,replacement,{contentType:replacement.type,upsert:false})
    if(uploadError)throw uploadError
    nextFile={path,mime:replacement.type,size:replacement.size,fileName:replacement.name}
   }
   const res=await fetch('/api/espacio-creativo/mis-obras',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:work.id,expectedUpdatedAt:work.updatedAt,title,author,description,tags,rightsConfirmed:rights,replacement:nextFile})})
   const data=await res.json();if(!res.ok)throw Error(data.error||'No se pudo guardar.')
   onSaved()
  }catch(e){setError(e instanceof Error?e.message:'Error al guardar.')}finally{setBusy(false)}
 }
 return <div role="dialog" aria-modal="true" aria-label="Editar evidencia" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-3"><form onSubmit={e=>{e.preventDefault();void save()}} className="max-h-[90dvh] w-full max-w-xl space-y-3 overflow-auto rounded-2xl bg-white p-5 text-slate-900"><h2 className="text-xl font-black">Editar evidencia</h2><label className="block text-sm">Título<input required minLength={2} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm">Autor o autores<input required minLength={2} maxLength={120} value={author} onChange={e=>setAuthor(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm">Descripción<textarea rows={4} maxLength={1200} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm">Etiquetas<input value={tagsText} onChange={e=>setTagsText(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm">Reemplazar archivo (opcional)<input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mp3,.m4a,.wav,.ogg,.oga" onChange={e=>setReplacement(e.target.files?.[0]||null)} className="mt-1 block w-full text-xs"/></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={rights} onChange={e=>setRights(e.target.checked)}/> Verifiqué la autoría, derechos y autorizaciones de la nueva versión.</label><p className="text-xs text-slate-500">Los cambios vuelven a revisión antes de publicarse. Se conserva el archivo anterior en el respaldo privado.</p>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border px-4 py-2">Cancelar</button><button disabled={busy||!rights} className="rounded-xl bg-blue-700 px-4 py-2 text-white disabled:opacity-40">{busy?'Guardando…':'Guardar cambios'}</button></div></form></div>
}
