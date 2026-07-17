import 'server-only'

import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export type ShareMediaKind = 'image' | 'video' | 'audio' | 'document' | 'page' | 'story' | 'post'

export type SharePreview = {
  title: string
  description: string
  label: string
  author?: string | null
  destination: string
  imageUrl?: string | null
  mediaKind: ShareMediaKind
  theme?: string | null
  accent?: string | null
}

const FALLBACK_URL = 'https://sello-tecnologico.vercel.app'

export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (production) return `https://${production.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  return FALLBACK_URL
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

function clean(value: unknown, fallback = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim() || fallback
}

function cleanPageTitle(value: unknown) {
  return clean(value, 'Página Sello Tecnológico').replace(/^Vitrina:\s*/i, '').trim()
}

async function signedStorageUrl(bucket?: string | null, path?: string | null) {
  if (!bucket || !path) return null
  const admin = createAdminSupabaseClient()
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 15)
  return data?.signedUrl ?? null
}

async function pageImage(pageId: string, coverAssetId?: string | null) {
  const admin = createAdminSupabaseClient()
  let asset: any = null

  if (coverAssetId) {
    const { data } = await admin
      .from('project_public_assets')
      .select('storage_bucket, storage_path, file_type')
      .eq('id', coverAssetId)
      .eq('page_id', pageId)
      .maybeSingle()
    if (data?.file_type === 'image') asset = data
  }

  if (!asset) {
    const { data } = await admin
      .from('project_public_assets')
      .select('storage_bucket, storage_path, file_type')
      .eq('page_id', pageId)
      .eq('file_type', 'image')
      .order('sort_order')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    asset = data
  }

  return asset ? signedStorageUrl(asset.storage_bucket, asset.storage_path) : null
}

async function pageAuthor(createdBy?: string | null) {
  if (!createdBy) return null
  const admin = createAdminSupabaseClient()
  const { data } = await admin.from('profiles').select('full_name').eq('id', createdBy).maybeSingle()
  return clean(data?.full_name) || null
}

export async function getStorySharePreview(id: string): Promise<SharePreview | null> {
  const admin = createAdminSupabaseClient()
  const now = new Date().toISOString()
  const { data: story } = await admin
    .from('community_stories')
    .select('id, title, caption, author_id, visibility_status, is_featured, expires_at')
    .eq('id', id)
    .eq('visibility_status', 'published')
    .or(`is_featured.eq.true,expires_at.gt.${now}`)
    .maybeSingle()

  if (!story) return null

  const [{ data: author }, { data: item }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', story.author_id).maybeSingle(),
    admin
      .from('community_story_items')
      .select('media_type, storage_bucket, storage_path, file_name')
      .eq('story_id', id)
      .order('sort_order')
      .limit(1)
      .maybeSingle(),
  ])

  const mediaKind: ShareMediaKind = item?.media_type === 'video' ? 'video' : item?.media_type === 'image' ? 'image' : 'story'
  const imageUrl = item?.media_type === 'image'
    ? await signedStorageUrl(item.storage_bucket, item.storage_path)
    : null
  const authorName = clean(author?.full_name, 'Comunidad Sello Tecnológico')
  const title = clean(story.title, mediaKind === 'video' ? 'Video de la comunidad' : 'Historia de la comunidad')
  const description = clean(story.caption, `Publicado por ${authorName} en la Comunidad Sello Tecnológico.`)

  return {
    title,
    description,
    label: mediaKind === 'video' ? 'Video' : 'Historia',
    author: authorName,
    destination: `/comunidad?historia=${id}`,
    imageUrl,
    mediaKind,
    theme: '#2563eb',
    accent: '#7c3aed',
  }
}

export async function getPageSharePreview(slug: string): Promise<SharePreview | null> {
  const admin = createAdminSupabaseClient()
  const { data: page } = await admin
    .from('project_public_pages')
    .select('id, title, slug, description, cover_asset_id, created_by, theme_color, accent_color')
    .eq('slug', slug)
    .eq('is_public', true)
    .eq('status', 'published')
    .maybeSingle()

  if (!page) return null

  const [imageUrl, author] = await Promise.all([
    pageImage(page.id, page.cover_asset_id),
    pageAuthor(page.created_by),
  ])

  return {
    title: cleanPageTitle(page.title),
    description: clean(page.description, 'Conoce este proyecto y sus publicaciones en Sello Tecnológico.'),
    label: 'Página de proyecto',
    author,
    destination: `/p/${page.slug}`,
    imageUrl,
    mediaKind: 'page',
    theme: page.theme_color,
    accent: page.accent_color,
  }
}

function youtubeThumbnail(content?: string | null) {
  const value = String(content ?? '')
  const match = value.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i)
  return match?.[1] ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null
}

function blockDescription(content?: string | null) {
  return clean(String(content ?? '').replace(/https?:\/\/\S+/g, ''), 'Publicación de Sello Tecnológico.')
}

export async function getPublicationSharePreview(targetType: string, targetId: string): Promise<SharePreview | null> {
  const admin = createAdminSupabaseClient()

  if (targetType === 'page') {
    const { data: page } = await admin.from('project_public_pages').select('slug').eq('id', targetId).maybeSingle()
    return page?.slug ? getPageSharePreview(page.slug) : null
  }

  if (targetType === 'asset') {
    const { data: asset } = await admin
      .from('project_public_assets')
      .select('id, page_id, title, description, file_name, file_type, storage_bucket, storage_path')
      .eq('id', targetId)
      .maybeSingle()
    if (!asset) return null

    const { data: page } = await admin
      .from('project_public_pages')
      .select('id, title, slug, description, cover_asset_id, created_by, theme_color, accent_color')
      .eq('id', asset.page_id)
      .eq('is_public', true)
      .eq('status', 'published')
      .maybeSingle()
    if (!page) return null

    const ownImage = asset.file_type === 'image'
      ? await signedStorageUrl(asset.storage_bucket, asset.storage_path)
      : null
    const [fallbackImage, author] = await Promise.all([
      ownImage ? Promise.resolve(null) : pageImage(page.id, page.cover_asset_id),
      pageAuthor(page.created_by),
    ])
    const kind: ShareMediaKind = asset.file_type === 'video'
      ? 'video'
      : asset.file_type === 'audio'
        ? 'audio'
        : asset.file_type === 'image'
          ? 'image'
          : 'document'

    return {
      title: clean(asset.title, clean(asset.file_name, cleanPageTitle(page.title))),
      description: clean(asset.description, clean(page.description, `Contenido publicado en ${cleanPageTitle(page.title)}.`)),
      label: kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : kind === 'image' ? 'Imagen' : 'Documento',
      author,
      destination: `/p/${page.slug}#archivo-${asset.id}`,
      imageUrl: ownImage ?? fallbackImage,
      mediaKind: kind,
      theme: page.theme_color,
      accent: page.accent_color,
    }
  }

  if (targetType === 'block') {
    const { data: block } = await admin
      .from('project_public_blocks')
      .select('id, page_id, type, title, content')
      .eq('id', targetId)
      .maybeSingle()
    if (!block) return null

    const { data: page } = await admin
      .from('project_public_pages')
      .select('id, title, slug, description, cover_asset_id, created_by, theme_color, accent_color')
      .eq('id', block.page_id)
      .eq('is_public', true)
      .eq('status', 'published')
      .maybeSingle()
    if (!page) return null

    const uploadedAssetId = String(block.content ?? '').match(/\/api\/vitrinas\/assets\/([a-zA-Z0-9-]+)/)?.[1]
    let linkedImage: string | null = null
    if (uploadedAssetId) {
      const { data: linked } = await admin
        .from('project_public_assets')
        .select('file_type, storage_bucket, storage_path')
        .eq('id', uploadedAssetId)
        .eq('page_id', page.id)
        .maybeSingle()
      if (linked?.file_type === 'image') linkedImage = await signedStorageUrl(linked.storage_bucket, linked.storage_path)
    }

    const youtubeImage = youtubeThumbnail(block.content)
    const [fallbackImage, author] = await Promise.all([
      linkedImage || youtubeImage ? Promise.resolve(null) : pageImage(page.id, page.cover_asset_id),
      pageAuthor(page.created_by),
    ])
    const kind: ShareMediaKind = block.type === 'video'
      ? 'video'
      : block.type === 'audio' || block.type === 'podcast_episode'
        ? 'audio'
        : block.type === 'file_download'
          ? 'document'
          : 'post'

    return {
      title: clean(block.title, kind === 'video' ? 'Video del proyecto' : kind === 'audio' ? 'Audio del proyecto' : 'Publicación del proyecto'),
      description: blockDescription(block.content) || clean(page.description),
      label: kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : kind === 'document' ? 'Documento' : 'Publicación',
      author,
      destination: `/p/${page.slug}#publicacion-${block.id}`,
      imageUrl: linkedImage ?? youtubeImage ?? fallbackImage,
      mediaKind: kind,
      theme: page.theme_color,
      accent: page.accent_color,
    }
  }

  return null
}
