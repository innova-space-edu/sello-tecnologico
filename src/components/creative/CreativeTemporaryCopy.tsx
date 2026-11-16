'use client'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase'
import {CREATIVE_BUCKET,CREATIVE_MAX_BYTES} from '@/lib/creative-space-public'
import {TEMPORARY_EXAMPLE_AUTHOR} from '@/lib/creative-temporary-example'
type Source={id:string;title:string;url:string|null}
async function prepareImage(blob:Blob):Promise<Blob>{
 if(blob.size<=0||blob.size>CREATIVE_MAX_BYTES)throw Error('Selecciona una imagen de hasta 50 MB.')
 const bitmap=await createImageBitmap(blob)
 try{
  const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height))
  const canvas=document.createElement('canvas')
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
  const context=canvas.getContext('2d');if(!context)throw Error('No se pudo preparar la fotografía.')
  context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height)
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(Error('No se pudo generar la copia.')),'image/jpeg',0.9))
 }finally{bitmap.close()}
}
export default function CreativeTemporaryCopy({source,onClose,onSaved}:{source:Source;onClose:()=>void;onSaved:()=>void}){
 const [title,setTitle]=useState(''),[photo,setPhoto]=useState<Blob|null>(null),[preview,setPreview]=useState(''),[verified,setVerified]=useState(false),[rights,setRights]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{if(!photo){setPreview('');return}const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url)},[photo])
 async function load(blob:Blob){setPhoto(null);setVerified(false);setRights(false);setPhoto(await prepareImage(blob))}
 async function select(file:File){setBusy(true);setError('');try{await load(file)}catch(e){setError(e instanceof Error?e.message:'No se pudo abrir la imagen.')}finally{setBusy(false)}}
 async function reuse(){if(!source.url)return;setBusy(true);setError('');setVerified(false);setRights(false);setPhoto(null);try{const res=await fetch(source.url);if(!res.ok)throw Error('La vista previa expiró. Actualiza la página o selecciona un archivo.');await load(await res.blob())}catch(e){setError(e instanceof Error?e.message:'No se pudo abrir el original.')}finally{setBusy(false)}}
 async function publish(){
  if(!photo||!verified||!rights||title.trim().length<2||busy)return
  setBusy(true);setError('')
  try{
   const client=createClient(),{data:{user},error:authError}=await client.auth.getUser()
   if(authError||!user)throw Error('Inicia sesión como administrador.')
   const path=user.id+'/'+crypto.randomUUID()+'.jpg'
   const {error:uploadError}=await client.storage.from(CREATIVE_BUCKET).upload(path,photo,{contentType:'image/jpeg',upsert:false})
   if(uploadError)throw uploadError
   const res=await fetch('/api/espacio-creativo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceId:source.id,temporaryExample:true,anonymizedCopyVerified:verified,authorshipAndPermissionsVerified:rights,rightsConfirmed:rights,author:TEMPORARY_EXAMPLE_AUTHOR,title:title.trim(),description:'',tags:[],mime:'image/jpeg',path,size:photo.size,fileName:'ejemplo-temporal.jpg'})})
   const data=await res.json();if(!res.ok)throw Error(data.error||'No se pudo publicar.')
   onSaved()
  }catch(e){setError(e instanceof Error?e.message:'No se pudo publicar.')}finally{setBusy(false)}
 }
 return <div role="dialog" aria-modal="true" aria-label="Crear ejemplo temporal" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3"><form onSubmit={e=>{e.preventDefault();void publish()}} className="max-h-[92dvh] w-full max-w-2xl space-y-4 overflow-auto rounded-2xl bg-white p-5 text-slate-900"><h2 className="text-xl font-black">Crear ejemplo temporal de egresados</h2><p className="text-sm text-slate-600">Crea una copia separada. El original y su autoría permanecen privados. La copia se exhibirá por seis meses.</p><label className="block text-sm font-semibold">Título público, sin nombres personales<input required minLength={2} maxLength={160} value={title} onChange={e=>{setTitle(e.target.value);setVerified(false)}} placeholder="Ej.: Maqueta de reciclaje" className="mt-1 w-full rounded-xl border p-3"/></label><div className="flex flex-wrap gap-2"><button type="button" disabled={busy||!source.url} onClick={()=>void reuse()} className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">Preparar copia de la fotografía original</button><label className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold">Seleccionar foto corregida<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-1 block max-w-full text-xs" onChange={e=>{const file=e.target.files?.[0];if(file)void select(file)}}/></label></div><p className="text-xs text-slate-600">La preparación convierte la fotografía en JPEG sin los metadatos originales. No borra rostros, textos ni datos visibles: si aparecen personas, nombres, cuentas o códigos, selecciona una versión previamente anonimizada.</p>{preview&&<div className="rounded-xl border bg-slate-50 p-2"><img src={preview} alt="Vista previa exacta de la copia a publicar" className="mx-auto max-h-[45dvh] max-w-full object-contain"/></div>}<p className="text-sm">Atribución pública: <strong>{TEMPORARY_EXAMPLE_AUTHOR}</strong></p><label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={!photo||busy} required checked={verified} onChange={e=>setVerified(e.target.checked)}/> Revisé la imagen completa y el título: no contienen personas identificables, nombres, cuentas ni otros datos personales.</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={!photo||busy} required checked={rights} onChange={e=>setRights(e.target.checked)}/> Verifiqué los derechos de exhibición y que la atribución anónima está permitida.</label>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border px-4 py-2">Cancelar</button><button disabled={busy||!photo||!verified||!rights||title.trim().length<2} className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-40">{busy?'Procesando…':'Publicar ejemplo por 6 meses'}</button></div></form></div>
}
