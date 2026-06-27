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
  background_color?: string | null
  text_color?: string | null
  card_color?: string | null
  layout_style?: string | null
  background_style?: string | null
  font_style?: string | null
  surface_style?: string | null
  button_style?: string | null
  header_style?: string | null
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

type PagePreset = {
  name: string
  description: string
  theme: string
  accent: string
  background: string
  text: string
  card: string
  backgroundStyle: string
  surfaceStyle: string
  buttonStyle: string
  headerStyle: string
  layoutStyle: string
  fontStyle: string
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

const PAGE_PRESETS: PagePreset[] = [
  {
    name: 'Podcast morado',
    description: 'Estilo social con morado, rosado y tarjetas blancas.',
    theme: '#9d0fd4',
    accent: '#e600ff',
    background: '#f7b7f2',
    text: '#111827',
    card: '#ffffff',
    backgroundStyle: 'solid',
    surfaceStyle: 'floating',
    buttonStyle: 'solid',
    headerStyle: 'compact',
    layoutStyle: 'magazine',
    fontStyle: 'modern',
  },
  {
    name: 'Instagram limpio',
    description: 'Fondo blanco, tarjetas limpias y acento rosado/naranja.',
    theme: '#111827',
    accent: '#e1306c',
    background: '#fafafa',
    text: '#111827',
    card: '#ffffff',
    backgroundStyle: 'solid',
    surfaceStyle: 'flat',
    buttonStyle: 'solid',
    headerStyle: 'compact',
    layoutStyle: 'magazine',
    fontStyle: 'modern',
  },
  {
    name: 'Facebook azul',
    description: 'Azul social, fondo gris claro y tarjetas blancas.',
    theme: '#1877f2',
    accent: '#42b72a',
    background: '#f0f2f5',
    text: '#050505',
    card: '#ffffff',
    backgroundStyle: 'solid',
    surfaceStyle: 'flat',
    buttonStyle: 'solid',
    headerStyle: 'compact',
    layoutStyle: 'magazine',
    fontStyle: 'modern',
  },
  {
    name: 'Verde blanco',
    description: 'Tonalidad verde con fondo blanco para proyectos ambientales.',
    theme: '#15803d',
    accent: '#22c55e',
    background: '#ffffff',
    text: '#052e16',
    card: '#f0fdf4',
    backgroundStyle: 'solid',
    surfaceStyle: 'bordered',
    buttonStyle: 'solid',
    headerStyle: 'large',
    layoutStyle: 'campaign',
    fontStyle: 'modern',
  },
  {
    name: 'Medio ambiente',
    description: 'Verde suave, natural y claro.',
    theme: '#166534',
    accent: '#86efac',
    background: '#ecfdf5',
    text: '#052e16',
    card: '#ffffff',
    backgroundStyle: 'paper',
    surfaceStyle: 'glass',
    buttonStyle: 'soft',
    headerStyle: 'large',
    layoutStyle: 'campaign',
    fontStyle: 'modern',
  },
  {
    name: 'Calma azul',
    description: 'Azules tranquilos para lectura y baja saturación.',
    theme: '#1d4ed8',
    accent: '#38bdf8',
    background: '#eff6ff',
    text: '#0f172a',
    card: '#ffffff',
    backgroundStyle: 'paper',
    surfaceStyle: 'glass',
    buttonStyle: 'soft',
    headerStyle: 'large',
    layoutStyle: 'gallery',
    fontStyle: 'modern',
  },
  {
    name: 'Colegio azul',
    description: 'Azul institucional, formal y ordenado.',
    theme: '#1e3a8a',
    accent: '#2563eb',
    background: '#f8fafc',
    text: '#0f172a',
    card: '#ffffff',
    backgroundStyle: 'solid',
    surfaceStyle: 'bordered',
    buttonStyle: 'solid',
    headerStyle: 'large',
    layoutStyle: 'magazine',
    fontStyle: 'modern',
  },
  {
    name: 'Energía naranja',
    description: 'Cálido, activo y llamativo.',
    theme: '#c2410c',
    accent: '#fb923c',
    background: '#fff7ed',
    text: '#1f2937',
    card: '#ffffff',
    backgroundStyle: 'diagonal',
    surfaceStyle: 'floating',
    buttonStyle: 'gradient',
    headerStyle: 'cover',
    layoutStyle: 'campaign',
    fontStyle: 'modern',
  },
  {
    name: 'Elegante oscuro',
    description: 'Oscuro premium con acento violeta.',
    theme: '#7c3aed',
    accent: '#d946ef',
    background: '#020617',
    text: '#f8fafc',
    card: '#111827',
    backgroundStyle: 'dark',
    surfaceStyle: 'glass',
    buttonStyle: 'gradient',
    headerStyle: 'cover',
    layoutStyle: 'magazine',
    fontStyle: 'modern',
  },
  {
    name: 'Minimal blanco',
    description: 'Blanco, negro y gris para máxima limpieza visual.',
    theme: '#111827',
    accent: '#6b7280',
    background: '#ffffff',
    text: '#111827',
    card: '#ffffff',
    backgroundStyle: 'solid',
    surfaceStyle: 'flat',
    buttonStyle: 'solid',
    headerStyle: 'compact',
    layoutStyle: 'magazine',
    fontStyle: 'modern',
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

function previewBackground(form: { background_style: string; theme_color: string; accent_color: string; background_color: string }) {
  if (form.background_style === 'solid') return form.background_color
  if (form.background_style === 'paper') return `linear-gradient(180deg, ${form.background_color}, #ffffff 78%)`
  if (form.background_style === 'dark') return `radial-gradient(circle at top left, ${form.theme_color}66, transparent 30%), linear-gradient(135deg, #020617, #111827)`
  if (form.background_style === 'aurora') return `radial-gradient(circle at 10% 10%, ${form.theme_color}44, transparent 32%), radial-gradient(circle at 90% 0%, ${form.accent_color}55, transparent 34%), ${form.background_color}`
  if (form.background_style === 'diagonal') return `linear-gradient(135deg, ${form.theme_color}20, ${form.background_color} 45%, ${form.accent_color}25)`
  return `radial-gradient(circle at top left, ${form.theme_color}28, transparent 32%), radial-gradient(circle at top right, ${form.accent_color}30, transparent 35%), ${form.background_color}`
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
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    theme_color: '#111827',
    accent_color: '#7c3aed',
    background_color: '#f8fafc',
    text_color: '#0f172a',
    card_color: '#ffffff',
    layout_style: 'magazine',
    background_style: 'solid',
    font_style: 'modern',
    surface_style: 'flat',
    button_style: 'solid',
    header_style: 'large',
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
          background_color: currentPage.background_color ?? '#f8fafc',
          text_color: currentPage.text_color ?? '#0f172a',
          card_color: currentPage.card_color ?? '#ffffff',
          layout_style: currentPage.layout_style ?? 'magazine',
          background_style: currentPage.background_style ?? 'solid',
          font_style: currentPage.font_style ?? 'modern',
          surface_style: currentPage.surface_style ?? 'flat',
          button_style: currentPage.button_style ?? 'solid',
          header_style: currentPage.header_style ?? 'large',
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
        const baseSlug = `${slugify(proyecto.title)}-${Math.random().toString(36).slice(2, 7)}`
        setForm(prev => ({ ...prev, title: proyecto.title, slug: baseSlug, hero_badge: proyecto.courses?.name ?? '' }))
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
      background_color: form.background_color || '#f8fafc',
      text_color: form.text_color || '#0f172a',
      card_color: form.card_color || '#ffffff',
      layout_style: form.layout_style,
      background_style: form.background_style,
      font_style: form.font_style,
      surface_style: form.surface_style,
      button_style: form.button_style,
      header_style: form.header_style,
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

  const applyPreset = (preset: PagePreset) => {
    setForm(prev => ({
      ...prev,
      theme_color: preset.theme,
      accent_color: preset.accent,
      background_color: preset.background,
      text_color: preset.text,
      card_color: preset.card,
      background_style: preset.backgroundStyle,
      surface_style: preset.surfaceStyle,
      button_style: preset.buttonStyle,
      header_style: preset.headerStyle,
      layout_style: preset.layoutStyle,
      font_style: preset.fontStyle,
    }))
  }

  const copyPublicUrl = async () => {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl).catch(() => null)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
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
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <div className="mb-4">
          <h2 className="font-bold text-blue-900">🎨 Tonos sugeridos para páginas</h2>
          <p className="text-sm text-gray-500">Elige una paleta completa ya configurada. Después puedes ajustar manualmente en personalización avanzada.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
          {PAGE_PRESETS.map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              className="text-left rounded-2xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-gray-900">{preset.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{preset.description}</p>
                </div>
                <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-500">Aplicar</span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {[preset.theme, preset.accent, preset.background, preset.text, preset.card].map((color, index) => (
                  <span key={`${preset.name}-${index}`} className="h-7 rounded-lg border border-gray-200" style={{ background: color }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold text-gray-400">
                <span>Fondo: {preset.backgroundStyle}</span>
                <span>·</span>
                <span>Tarjeta: {preset.surfaceStyle}</span>
                <span>·</span>
                <span>Botón: {preset.buttonStyle}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-gray-200 p-4">
          <div className="mb-4">
            <h3 className="font-bold text-gray-800">Personalización avanzada</h3>
            <p className="text-xs text-gray-400">Usa esto solo si quieres ajustar un color o estilo después de elegir una paleta sugerida.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <label className="text-sm font-medium text-gray-700">
              Principal
              <input type="color" value={form.theme_color} onChange={event => setForm({ ...form, theme_color: event.target.value })}
                className="mt-1 h-12 w-full border border-gray-300 rounded-lg px-2 py-1" />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Secundario
              <input type="color" value={form.accent_color} onChange={event => setForm({ ...form, accent_color: event.target.value })}
                className="mt-1 h-12 w-full border border-gray-300 rounded-lg px-2 py-1" />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Fondo
              <input type="color" value={form.background_color} onChange={event => setForm({ ...form, background_color: event.target.value })}
                className="mt-1 h-12 w-full border border-gray-300 rounded-lg px-2 py-1" />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Texto
              <input type="color" value={form.text_color} onChange={event => setForm({ ...form, text_color: event.target.value })}
                className="mt-1 h-12 w-full border border-gray-300 rounded-lg px-2 py-1" />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Tarjetas
              <input type="color" value={form.card_color} onChange={event => setForm({ ...form, card_color: event.target.value })}
                className="mt-1 h-12 w-full border border-gray-300 rounded-lg px-2 py-1" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-5">
            <label className="text-sm font-medium text-gray-700">
              Fondo visual
              <select value={form.background_style} onChange={event => setForm({ ...form, background_style: event.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="solid">Limpio sin gradiente</option>
                <option value="soft_gradient">Gradiente suave</option>
                <option value="aurora">Aurora moderna</option>
                <option value="diagonal">Diagonal editorial</option>
                <option value="paper">Papel suave</option>
                <option value="dark">Oscuro elegante</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Tarjetas
              <select value={form.surface_style} onChange={event => setForm({ ...form, surface_style: event.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="glass">Cristal suave</option>
                <option value="floating">Flotante</option>
                <option value="bordered">Borde marcado</option>
                <option value="flat">Plano simple</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Botones
              <select value={form.button_style} onChange={event => setForm({ ...form, button_style: event.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="solid">Color sólido</option>
                <option value="gradient">Gradiente</option>
                <option value="soft">Suave</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Encabezado
              <select value={form.header_style} onChange={event => setForm({ ...form, header_style: event.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="large">Grande</option>
                <option value="compact">Compacto</option>
                <option value="cover">Portada amplia</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Diseño
              <select value={form.layout_style} onChange={event => setForm({ ...form, layout_style: event.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="magazine">Revista / podcast</option>
                <option value="gallery">Galería en tarjetas</option>
                <option value="campaign">Campaña</option>
              </select>
            </label>
          </div>
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
            Mostrar panel general de interacciones
          </label>
        </div>

        <div className="mt-5 rounded-2xl p-5 border" style={{ background: previewBackground(form), borderColor: `${form.accent_color}33` }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: form.accent_color }}>Vista previa rápida</p>
          <div className="mt-3 rounded-2xl border p-4" style={{ background: form.card_color, color: form.text_color, borderColor: `${form.accent_color}33` }}>
            <h3 className="text-3xl font-black" style={{ color: form.theme_color }}>{form.title || 'Título de la página'}</h3>
            <p className="text-sm mt-2">Así se verán el fondo, texto, tarjetas y botones en la publicación pública.</p>
            <button type="button" className="mt-4 rounded-full px-4 py-2 text-sm font-black text-white" style={{ background: form.button_style === 'gradient' ? `linear-gradient(135deg, ${form.theme_color}, ${form.accent_color})` : form.theme_color }}>
              Botón de ejemplo
            </button>
          </div>
        </div>

        {publicUrl && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 flex flex-wrap gap-3 items-center justify-between">
            <div>
              <p className="font-semibold">Link público:</p>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="underline break-all">{publicUrl}</a>
            </div>
            <button type="button" onClick={copyPublicUrl} className="px-3 py-2 rounded-lg bg-white border border-blue-200 text-blue-700 font-semibold">
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6">
        <div className="flex flex-wrap justify-between gap-3 items-center mb-4">
          <div>
            <h2 className="font-bold text-blue-900">🧩 Publicaciones y secciones</h2>
            <p className="text-sm text-gray-500">Cada bloque tendrá sus propios me gusta, comentarios y botón de compartir.</p>
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
