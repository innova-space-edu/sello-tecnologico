'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import CreativeEvidenceCatalog from '@/components/creative/CreativeEvidenceCatalog'
import CreativeAdminEdit from '@/components/creative/CreativeAdminEdit'

type Work = {
  id: string
  title: string
  author: string
  description: string
  tags: string[]
  type: 'image' | 'video' | 'audio'
  status: 'pending' | 'published' | 'rejected'
  updatedAt:string
  date: string
  publicationBasis: 'personal' | 'institutional'
  canMarkInstitutional: boolean
  canMarkTemporary:boolean
  temporaryExample:boolean
  expiresAt:string|null
  url: string | null
}

export default function RevisarEspacioCreativo() {
  const [works, setWorks] = useState<Work[]>([])
  const [editing,setEditing]=useState<Work|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [institutionalDeclarations, setInstitutionalDeclarations] = useState<Record<string, boolean>>({})
  const [consentHelp, setConsentHelp] = useState(false)
  const [temporaryDeclarations,setTemporaryDeclarations]=useState<Record<string,boolean>>({})

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/espacio-creativo/revision', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar la revisión.')
      setWorks(data.works || [])
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar la revisión.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const review = async (work: Work, action: 'publish' | 'reject' | 'restore') => {
    if(action==='publish'&&!window.confirm('¿Verificaste la autoría, los derechos y la autorización de todas las personas identificables, incluidos menores, cuando corresponda?'))return
    if(action==='reject'&&!window.confirm('¿Retirar esta obra de la galería pública? Se conservará en el archivo privado.'))return
    setBusyId(work.id)
    setError('')
    setConsentHelp(false)
    try {
      const response = await fetch('/api/espacio-creativo/revision', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: work.id,
          action,
          authorshipAndPermissionsVerified: action === 'publish',
          institutionalNoPersonalData: action === 'publish' && institutionalDeclarations[work.id] === true,
          temporaryExample:action==='publish'&&temporaryDeclarations[work.id]===true,
          anonymizedCopyVerified:action==='publish'&&temporaryDeclarations[work.id]===true,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setConsentHelp(data.code === 'PUBLIC_SHOWCASE_CONSENT_REQUIRED')
        throw new Error(data.error || 'No se pudo guardar la revisión.')
      }
      setInstitutionalDeclarations(current => ({ ...current, [work.id]: false }))
      setTemporaryDeclarations(current=>({...current,[work.id]:false}))
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la revisión.')
    } finally {
      setBusyId('')
    }
  }

  const pending = works.filter(work => work.status === 'pending'&&!(work.temporaryExample&&work.expiresAt&&Date.parse(work.expiresAt)<=Date.now()))
  const expired=works.filter(work=>work.temporaryExample&&work.expiresAt&&Date.parse(work.expiresAt)<=Date.now())
  const published = works.filter(work => work.status === 'published'&&!expired.some(e=>e.id===work.id))
  const rejected = works.filter(work=>work.status==='rejected'&&!expired.some(e=>e.id===work.id))

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 lg:ml-64 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-blue-950">Revisión · Espacio creativo</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                Revisa archivos, atribución y privacidad antes de aprobar su exhibición. La publicación exige autorización vigente para visibilidad pública.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin" className="inline-flex items-center rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-800 shadow-sm hover:bg-blue-50">← Volver a Administración</Link>
              <Link href="/espacio-creativo" className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">Ver galería / agregar evidencia</Link>
            </div>
          </div>

          <div className="my-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><strong>Ejemplos de egresados · 6 meses</strong><p>Agrega desde la galería una copia nueva de la fotografía del proyecto, sin personas, nombres, voces ni otros identificadores. Usa como autor «Proyecto de egresados · ejemplo anónimo». Verifica los derechos de publicación y marca la opción de exhibición temporal en esta página. No se modifica ningún consentimiento personal.</p></div>
          <CreativeEvidenceCatalog onImported={()=>void reload()}/>
          {editing&&<CreativeAdminEdit key={editing.id} work={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);void reload()}}/>}
          <div className="my-7 flex flex-wrap gap-3">
            <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-bold text-amber-900">Pendientes: {pending.length}</span>
            <span className="rounded-full bg-emerald-100 px-5 py-2 text-sm font-bold text-emerald-900">Publicadas: {published.length}</span>
            <span className="rounded-full bg-slate-100 px-5 py-2 text-sm font-bold">Retiradas: {rejected.length}</span>
            <button type="button" onClick={() => void reload()} className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-bold">Actualizar</button>
          </div>
          {error && (
            <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p>{error}</p>
              {consentHelp && (
                <p className="mt-2">
                  Para obras propias de adultos, revisa el permiso «Vitrina y comunidad pública» en{' '}
                  <Link href="/configuracion/privacidad" className="font-bold underline">Mis consentimientos</Link>.
                  Si se trata de una obra institucional sin datos personales, usa la declaración específica de su tarjeta.
                </p>
              )}
            </div>
          )}
          {loading ? <p role="status" className="p-8 text-slate-500">Cargando obras…</p> : works.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">No hay obras pendientes ni publicadas.</div>
          ) : (
            <div className="space-y-10">
              {[{ heading: 'Pendientes de revisión', rows: pending }, { heading: 'Obras en exhibición', rows: published },{heading:'Retiradas o rechazadas',rows:rejected},{heading:'Ejemplos vencidos (no públicos)',rows:expired}].map(section => (
                <section key={section.heading}>
                  <h2 className="mb-4 text-xl font-black text-slate-800">{section.heading}</h2>
                  {section.rows.length === 0 ? <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Sin obras en esta categoría.</p> : (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {section.rows.map(work => (
                        <article key={work.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="flex aspect-video items-center justify-center bg-slate-900 text-white">
                            {!work.url ? <span>Vista previa no disponible</span> : work.type === 'image' ? (
                              <img src={work.url} alt={work.title} className="h-full w-full object-contain" />
                            ) : work.type === 'video' ? (
                              <video src={work.url} controls preload="metadata" className="h-full w-full" />
                            ) : (
                              <audio src={work.url} controls className="w-[90%]" />
                            )}
                          </div>
                          <div className="space-y-3 p-5">
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">{work.type === 'audio' ? 'Podcast' : work.type === 'image' ? 'Imagen' : 'Video'}</p>
                            <h3 className="break-words text-lg font-black">{work.title}</h3>
                            <p className="text-sm font-semibold">Autor: {work.author}</p>
                            <p className="break-words text-sm text-slate-600">{work.description || 'Sin descripción.'}</p>
                            {!!work.tags?.length && <div className="flex flex-wrap gap-2">{work.tags.map(tag => <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">#{tag}</span>)}</div>}
                            <p className="text-xs text-slate-400">{new Date(work.date).toLocaleDateString('es-CL')}</p>
                            {work.status === 'pending' && work.canMarkInstitutional && (
                              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950">
                                <input type="checkbox" className="mt-0.5 shrink-0"
                                  disabled={busyId === work.id}
                                  checked={institutionalDeclarations[work.id] === true}
                                  onChange={event => setInstitutionalDeclarations(current => ({
                                    ...current, [work.id]: event.target.checked,
                                  }))} />
                                <span>
                                  <strong className="block">Publicar como obra institucional</strong>
                                  Certifico que esta obra pertenece a la institución, tengo derechos para publicarla y
                                  no contiene nombres, imágenes, voces ni otros datos personales de estudiantes
                                  o terceros identificables. No usar para trabajos de menores: esos necesitan
                                  autorización familiar vigente.
                                </span>
                              </label>
                            )}
                            {work.canMarkTemporary && <label className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs"><input type="checkbox" checked={temporaryDeclarations[work.id]===true} onChange={e=>setTemporaryDeclarations(current=>({...current,[work.id]:e.target.checked}))}/><span><strong className="block">Ejemplo temporal de egresados (6 meses)</strong>Certifico que es una copia nueva anonimizada, sin datos identificables, con derechos de exhibición comprobados. No equivale a consentimiento personal.</span></label>}
                            {work.temporaryExample&&work.expiresAt&&<p className="text-xs font-semibold text-blue-800">{Date.parse(work.expiresAt)<=Date.now()?'Exhibición vencida':'Exhibición hasta'}: {new Date(work.expiresAt).toLocaleDateString('es-CL')}</p>}
                            {work.publicationBasis === 'institutional' && work.status === 'published' && (
                              <p className="text-xs font-semibold text-indigo-700">Publicación institucional certificada por el administrador.</p>
                            )}
                            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                              {work.status === 'pending' && (
                                <button type="button" disabled={busyId === work.id} onClick={() => void review(work, 'publish')}
                                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Aprobar</button>
                              )}
                              <button type="button" disabled={!!busyId} onClick={()=>setEditing(work)} className="rounded-full bg-blue-100 px-4 py-2 text-xs font-bold text-blue-800">Editar</button>
                              {work.status==='rejected'?<button type="button" disabled={!!busyId} onClick={()=>void review(work,'restore')} className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold">Recuperar</button>:<button type="button" disabled={busyId === work.id} onClick={() => void review(work, 'reject')}
                                className="rounded-full bg-rose-100 px-4 py-2 text-xs font-bold text-rose-800 disabled:opacity-50">
                                {work.status === 'published' ? 'Eliminar de galería' : 'Rechazar'}
                              </button>}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
