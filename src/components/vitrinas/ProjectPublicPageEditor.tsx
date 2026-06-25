'use client'

import { createClient } from '@/lib/supabase'
import { useEffect, useMemo, useRef, useState } from 'react'

type Project = {
  id: string
  title: string
  course_id?: string | null
  courses?: { name?: string | null } | null
}

type PublicPage = {
  id: string
  project_id: string
  course_id?: string | null
  created_by?: string | null
  title: string
  slug: string
  description?: string | null
  theme_color?: string | null
  accent_color?: string | null
  layout_style?: string | null
  background_style?: string | null
  font_style?: string | null
  hero_badge?: string | null
  call_to_action_label?: string | null
  call_to_action_url?: string | null
  show_author?: boolean | null
  show_trending?: boolean | null
  status: string
  is_public: boolean
  published_at?: string | null
}

type Block = {
  id?: string
  type: string
  title: string
  content: string
  sort_order: number
}

type Asset = {
  id: string
  file_name: string
  file_type: string
  mime_type?: string | null
  file_size?: number | null
  title?: string | null
  description?: string | null
  created_at?: string | null
}

const BLOCK_TYPES = [
  { value: 'text', label: 'Texto / descripción' },
  { value: 'post', label: 'Post o bitácora' },
  { value: 'podcast_episode', label: 'Episodio de podcast' },
  { value: 'audio', label: 'Bloque de audio' },
  { value: 'video', label: 'Bloque de video' },
  { value: 'gallery', label: 'Galería' },
  { value: 'call_to_action', label: 'Botón / enlace' },
  { value: 'credits', label: 'Créditos' },
]

const QUICK_BLOCKS: Record<string, Block> = {
  podcast: {
    type: 'podcast_episode',
    title: 'Nuevo episodio del podcast',
    content: 'Resumen del episodio, participantes, tema principal y conclusiones de la conversación.',
    sort_order: 0,
  },
  post: {
    type: 'post',
    title: 'Nueva publicación del equipo',
    content: 'Cuenta qué realizaron, qué aprendieron y qué evidencia agregaron.',
    sort_order: 0,
  },
  gallery: {
    type: 'gallery',
    title: 'Galería del proceso',
    content: 'Describe las imágenes o evidencias visuales que están compartiendo.',
    sort_order: 0,
  },
  cta: {
    type: 'call_to_action',
    title: 'Visita nuestro recurso',
    content: 'https://',
    sort_order: 0,
  },
}

const DEFAULT_BLOCKS: Block[] = [
  {
    type: 'post',
    title: 'Sobre nuestro proyecto',
    content: 'Describe brevemente el objetivo del proyecto, el problema que aborda y por qué es importante para la comunidad escolar.',
    sort_order: 0,
  },
  {
    type: 'podcast_episode',
    title: 'Episodio 1: conversación inicial',
    content: 'Resumen del episodio, integrantes que participaron y principales ideas conversadas.',
    sort_order: 1,
  },
]

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

function cleanTitle(value: string) {
  return value.replace(/^Vitrina:\s*/i, '').trim()
}

function assetType(file: File) {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type === 'application/pdf') return 'pdf'
  return 'file'
}

function formatSize(size?: number | null) {
  if (!size) return '—'
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default function ProjectPublicPageEditor({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [page, setPage] = useState<PublicPage | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS)
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    theme_color: '#111827',
    accent_color: '#7c3aed',
    layout_style: 'magazine',
    background_style: 'soft_gradient',
    font_style: 'modern',
    hero_badge: '',
    call_to_action_label: '',
    call_to_action_url: '',
    show_author: true,
    show_trending: true,
  })

  const publicUrl = page?.slug && typeof window !== 'undefined'
    ? `${window.location.origin}/p/${page.slug}`
    : page?.slug ? `/p/${page.slug}` : ''

  const isStaff = ['admin', 'docente', 'coordinador', 'utp'].includes(role)
  const canPublish = isStaff || role === 'estudiante'

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      setError('')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Debes iniciar sesión para editar la página pública del proyecto.')
        setLoading(false)
        return
      }
      setUserId(user.id)

      const [{ data: perfil }, { data: proyecto }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase.from('projects').select('id, title, course_id, courses(name)').eq('id', projectId).single(),
      ])

      setRole(perfil?.role ?? '')
      setProject((proyecto ?? null) as unknown as Project | null)

      const { data: existingPage } = await supabase
        .from('project_public_pages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingPage) {
        const currentPage = existingPage as PublicPage
        setPage(currentPage)
        setForm({
          title: cleanTitle(currentPage.title ?? ''),
          slug: currentPage.slug ?? '',
          description: currentPage.description ?? '',
          theme_color: currentPage.theme_color ?? '#111827',
          accent_color: currentPage.accent_color ?? '#7c3aed',
          layout_style: currentPage.layout_style ?? 'magazine',
          background_style: currentPage.background_style ?? 'soft_gradient',
          font_style: currentPage.font_style ?? 'modern',
          hero_badge: currentPage.hero_badge ?? '',
          call_to_action_label: currentPage.call_to_action_label ?? '',
          call_to_action_url: currentPage.call_to_action_url ?? '',
          show_author: currentPage.show_author !== false,
          show_trending: currentPage.show_trending !== false,
        })

        const [{ data: currentBlocks }, { data: currentAssets }] = await Promise.all([
          supabase.from('project_public_blocks').select('*').eq('page_id', currentPage.id).order('sort_order'),
          supabase.from('project_public_assets').select('*').eq('page_id', currentPage.id).order('created_at', { ascending: false }),
        ])
        setBlocks((currentBlocks ?? []).length > 0
          ? (currentBlocks ?? []).map((block: any, index: number) => ({
              id: block.id,
              type: block.type ?? 'text',
              title: block.title ?? '',
              content: block.content ?? '',
              sort_order: block.sort_order ?? index,
            }))
          : DEFAULT_BLOCKS)
        setAssets((currentAssets ?? []) as Asset[])
      } else if (proyecto) {
        const baseTitle = proyecto.title
        const baseSlug = `${slugify(proyecto.title)}-${Math.random().toString(36).slice(2, 7)}`
        setForm(prev => ({ ...prev, title: baseTitle, slug: baseSlug, hero_badge: proyecto.courses?.name ?? '' }))
      }

      setLoading(false)
    }

    cargar()
  }, [projectId, supabase])

  const ensurePage = async () => {
    if (!userId || !project) throw new Error('No hay usuario o proyecto válido.')
    const cleanPageTitle = cleanTitle(form.title)
    const cleanSlug = slugify(form.slug || form.title)
    if (!cleanPageTitle || !cleanSlug) throw new Error('Completa título y enlace público.')

    const payload = {
      project_id: project.id,
      course_id: project.course_id ?? null,
      created_by: page?.created_by ?? userId,
      title: cleanPageTitle,
      slug: cleanSlug,
      description: form.description.trim() || null,
      theme_color: form.theme_color || '#111827',
      accent_color: form.accent_color || '#7c3aed',
      layout_style: form.layout_style,
      background_style: form.background_style,
      font_style: form.font_style,
      hero_badge: form.hero_badge.trim() || null,
      call_to_action_label: form.call_to_action_label.trim() || null,
      call_to_action_url: form.call_to_action_url.trim() || null,
      show_author: form.show_author,
      show_trending: form.show_trending,
      status: page?.status ?? 'draft',
      is_public: page?.is_public ?? false,
      updated_at: new Date().toISOString(),
    }

    if (page?.id) {
      const { data, error: updateError } = await supabase
        .from('project_public_pages')
        .update(payload)
        .eq('id', page.id)
        .select('*')
        .single()
      if (updateError || !data) throw updateError ?? new Error('No se pudo actualizar la página.')
      const updated = data as PublicPage
      setPage(updated)
      setForm(prev => ({ ...prev, title: cleanTitle(updated.title), slug: updated.slug }))
      return updated
    }

    const { data, error: insertError } = await supabase
      .from('project_public_pages')
      .insert(payload)
      .select('*')
      .single()
    if (insertError || !data) throw insertError ?? new Error('No se pudo crear la página.')
    const created = data as PublicPage
    setPage(created)
    setForm(prev => ({ ...prev, title: cleanTitle(created.title), slug: created.slug }))
    return created
  }

  const guardar = async () => {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const currentPage = await ensurePage()
      await supabase.from('project_public_blocks').delete().eq('page_id', currentPage.id)
      const validBlocks = blocks
        .filter(block => block.title.trim() || block.content.trim())
        .map((block, index) => ({
          page_id: currentPage.id,
          type: block.type || 'text',
          title: block.title.trim() || null,
          content: block.content.trim() || null,
          sort_order: index,
          settings: {},
        }))

      if (validBlocks.length > 0) {
        const { error: blocksError } = await supabase.from('project_public_blocks').insert(validBlocks)
        if (blocksError) throw blocksError
      }

      const { data: refreshedBlocks } = await supabase
        .from('project_public_blocks')
        .select('*')
        .eq('page_id', currentPage.id)
        .order('sort_order')

      setBlocks((refreshedBlocks ?? []).map((block: any, index: number) => ({
        id: block.id,
        type: block.type ?? 'text',
        title: block.title ?? '',
        content: block.content ?? '',
        sort_order: block.sort_order ?? index,
      })))
      setMessage('Página guardada correctamente.')
      return currentPage
    } catch (err: any) {
      setError(err?.message ?? 'No fue posible guardar la página.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const publicar = async () => {
    if (!canPublish) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const currentPage = await guardar()
      if (!currentPage) return
      const { data, error: publishError } = await supabase
        .from('project_public_pages')
        .update({ status: 'published', is_public: true, published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', currentPage.id)
        .select('*')
        .single()
      if (publishError || !data) throw publishError ?? new Error('No se pudo publicar.')
      setPage(data as PublicPage)
      setMessage('Página publicada. Ya puedes compartir el link público.')
    } catch (err: any) {
      setError(err?.message ?? 'No fue posible publicar la página.')
    } finally {
      setSaving(false)
    }
  }

  const despublicar = async () => {
    if (!page?.id) return
    setSaving(true)
    setError('')
    try {
      const { data, error: unpublishError } = await supabase
        .from('project_public_pages')
        .update({ status: 'draft', is_public: false, updated_at: new Date().toISOString() })
        .eq('id', page.id)
        .select('*')
        .single()
      if (unpublishError || !data) throw unpublishError ?? new Error('No se pudo despublicar.')
      setPage(data as PublicPage)
      setMessage('Página despublicada. El link público queda oculto.')
    } catch (err: any) {
      setError(err?.message ?? 'No fue posible despublicar.')
    } finally {
      setSaving(false)
    }
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError('')
    try {
      const currentPage = await ensurePage()
      for (const file of Array.from(files)) {
        if (file.size > 500 * 1024 * 1024) throw new Error(`${file.name} supera el máximo de 500 MB.`)
        const cleanName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-')
        const path = `${currentPage.id}/${Date.now()}-${cleanName}`
        const { error: uploadError } = await supabase.storage
          .from('project-public-assets')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError

        const { error: metadataError } = await supabase.from('project_public_assets').insert({
          page_id: currentPage.id,
          project_id: project?.id ?? null,
          uploaded_by: userId,
          file_name: file.name,
          file_type: assetType(file),
          mime_type: file.type,
          file_size: file.size,
          storage_bucket: 'project-public-assets',
          storage_path: path,
          title: file.name,
          description: null,
        })
        if (metadataError) throw metadataError
      }

      const { data: refreshedAssets } = await supabase
        .from('project_public_assets')
        .select('*')
        .eq('page_id', currentPage.id)
        .order('created_at', { ascending: false })
      setAssets((refreshedAssets ?? []) as Asset[])
      setMessage('Archivos subidos correctamente.')
    } catch (err: any) {
      setError(err?.message ?? 'No fue posible subir archivos.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const updateBlock = (index: number, patch: Partial<Block>) => {
    setBlocks(prev => prev.map((block, currentIndex) => currentIndex === index ? { ...block, ...patch } : block))
  }

  const addBlock = (template?: keyof typeof QUICK_BLOCKS) => {
    setBlocks(prev => [...prev, { ...(template ? QUICK_BLOCKS[template] : { type: 'text', title: '', content: '', sort_order: 0 }), sort_order: prev.length }])
  }

  const removeBlock = (index: number) => {
    setBlocks(prev => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">Cargando editor de página pública…</div>
  }

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">⚠️ {error}</div>}
      {message && <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">✅ {message}</div>}

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <div className="flex flex-wrap justify-between gap-3 items-start mb-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Página pública</p>
            <h2 className="text-xl font-bold text-blue-900 mt-1">{project?.title ?? 'Proyecto'}</h2>
            <p className="text-sm text-gray-500 mt-1">Diseña una página pública con podcast, videos, imágenes, posts, comentarios, likes y trending.</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${page?.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {page?.is_public ? 'Publicado' : 'Borrador'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700">
            Título público *
            <input value={form.title} onChange={event => setForm({ ...form, title: cleanTitle(event.target.value) })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Link único / slug *
            <div className="mt-1 flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-400">
              <span className="bg-gray-50 text-gray-400 px-3 py-2.5 text-sm">/p/</span>
              <input value={form.slug} onChange={event => setForm({ ...form, slug: slugify(event.target.value) })}
                className="flex-1 px-3 py-2.5 focus:outline-none" />
            </div>
          </label>
          <label className="text-sm font-medium text-gray-700 md:col-span-2">
            Descripción corta
            <textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}
              rows={3}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Etiqueta superior opcional
            <input value={form.hero_badge} onChange={event => setForm({ ...form, hero_badge: event.target.value })}
              placeholder="Ej: Podcast medioambiental"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Fuente
            <select value={form.font_style} onChange={event => setForm({ ...form, font_style: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="modern">Moderna</option>
              <option value="classic">Clásica</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
          <label className="text-sm font-medium text-gray-700">
            Color principal
            <input type="color" value={form.theme_color} onChange={event => setForm({ ...form, theme_color: event.target.value })}
              className="mt-1 h-12 w-full border border-gray-300 rounded-lg px-2 py-1" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Color secundario
            <input type="color" value={form.accent_color} onChange={event => setForm({ ...form, accent_color: event.target.value })}
              className="mt-1 h-12 w-full border border-gray-300 rounded-lg px-2 py-1" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Fondo
            <select value={form.background_style} onChange={event => setForm({ ...form, background_style: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="soft_gradient">Gradiente suave</option>
              <option value="solid">Limpio blanco</option>
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Diseño
            <select value={form.layout_style} onChange={event => setForm({ ...form, layout_style: event.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="magazine">Revista / podcast</option>
              <option value="gallery">Galería</option>
              <option value="campaign">Campaña</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <label className="text-sm font-medium text-gray-700">
            Botón principal opcional
            <input value={form.call_to_action_label} onChange={event => setForm({ ...form, call_to_action_label: event.target.value })}
              placeholder="Ej: Ver informe completo"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            URL del botón
            <input value={form.call_to_action_url} onChange={event => setForm({ ...form, call_to_action_url: event.target.value })}
              placeholder="https://"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </label>
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <label className="inline-flex items-center gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <input type="checkbox" checked={form.show_author} onChange={event => setForm({ ...form, show_author: event.target.checked })} />
            Mostrar creador
          </label>
          <label className="inline-flex items-center gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <input type="checkbox" checked={form.show_trending} onChange={event => setForm({ ...form, show_trending: event.target.checked })} />
            Mostrar panel trending/comentarios
          </label>
        </div>

        <div className="mt-5 rounded-2xl p-5 border" style={{ background: `linear-gradient(135deg, ${form.theme_color}18, ${form.accent_color}24)`, borderColor: `${form.accent_color}33` }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: form.accent_color }}>Vista previa rápida</p>
          <h3 className="text-3xl font-black mt-2" style={{ color: form.theme_color }}>{form.title || 'Título de la página'}</h3>
          <p className="text-sm text-gray-600 mt-2">Aquí se aplican el color principal y secundario seleccionados.</p>
        </div>

        {publicUrl && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
            <p className="font-semibold">Link público:</p>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="underline break-all">{publicUrl}</a>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <div className="flex flex-wrap justify-between gap-3 items-center mb-4">
          <div>
            <h2 className="font-bold text-blue-900">🧩 Herramientas y secciones</h2>
            <p className="text-sm text-gray-500">Agrega bloques rápidos para armar la versión publicable.</p>
          </div>
          <button type="button" onClick={() => addBlock()} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-semibold">
            + Bloque vacío
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <button type="button" onClick={() => addBlock('podcast')} className="px-3 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-semibold">+ Episodio podcast</button>
          <button type="button" onClick={() => addBlock('post')} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold">+ Post</button>
          <button type="button" onClick={() => addBlock('gallery')} className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-semibold">+ Galería</button>
          <button type="button" onClick={() => addBlock('cta')} className="px-3 py-2 rounded-lg bg-orange-50 text-orange-700 text-sm font-semibold">+ Botón/enlace</button>
        </div>

        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div key={`${block.id ?? 'new'}-${index}`} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-[190px_1fr_auto] gap-3 items-start">
                <select value={block.type} onChange={event => updateBlock(index, { type: event.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white">
                  {BLOCK_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <input value={block.title} onChange={event => updateBlock(index, { title: event.target.value })}
                  placeholder="Título del bloque"
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white" />
                <button type="button" onClick={() => removeBlock(index)} className="text-red-600 text-sm px-3 py-2 hover:bg-red-50 rounded-lg">
                  Eliminar
                </button>
              </div>
              <textarea value={block.content} onChange={event => updateBlock(index, { content: event.target.value })}
                placeholder="Contenido, resumen, guion, descripción del episodio, URL o mensaje para visitantes."
                rows={4}
                className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <div className="flex flex-wrap justify-between gap-3 items-center mb-4">
          <div>
            <h2 className="font-bold text-blue-900">🎙️ Archivos y materiales</h2>
            <p className="text-sm text-gray-500">Sube audios, videos, imágenes, PDF o archivos del proyecto.</p>
          </div>
          <div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,audio/*,video/*,application/pdf" className="hidden" onChange={event => uploadFiles(event.target.files)} />
            <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
              className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60">
              {uploading ? 'Subiendo…' : '+ Subir archivos'}
            </button>
          </div>
        </div>

        {assets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assets.map(asset => (
              <div key={asset.id} className="border border-gray-200 rounded-xl p-4 flex gap-3 items-start">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-xl shrink-0">
                  {asset.file_type === 'audio' ? '🎧' : asset.file_type === 'video' ? '🎬' : asset.file_type === 'image' ? '🖼️' : asset.file_type === 'pdf' ? '📄' : '📎'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800 truncate">{asset.title ?? asset.file_name}</p>
                  <p className="text-xs text-gray-400">{asset.file_type} · {formatSize(asset.file_size)}</p>
                  <a href={`/api/vitrinas/assets/${asset.id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    Abrir archivo
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400">
            Todavía no hay archivos subidos.
          </div>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-3 sticky bottom-4 bg-white/90 backdrop-blur rounded-xl p-3 shadow-sm border border-gray-100">
        <button type="button" onClick={guardar} disabled={saving || uploading} className="px-5 py-2.5 rounded-xl border border-blue-200 text-blue-700 text-sm font-semibold disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar borrador'}
        </button>
        {page?.is_public && (
          <button type="button" onClick={despublicar} disabled={saving} className="px-5 py-2.5 rounded-xl border border-orange-200 text-orange-700 text-sm font-semibold disabled:opacity-60">
            Ocultar página
          </button>
        )}
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold">
            Vista pública
          </a>
        )}
        <button type="button" onClick={publicar} disabled={saving || uploading} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60">
          {saving ? 'Publicando…' : 'Publicar y generar link'}
        </button>
      </div>
    </div>
  )
}
