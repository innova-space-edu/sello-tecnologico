import fs from 'node:fs'

function patchFile(path, transform) {
  const source = fs.readFileSync(path, 'utf8')
  const next = transform(source)
  if (next !== source) fs.writeFileSync(path, next)
}

patchFile('src/components/stories/StoryViewer.tsx', source => {
  const oldValue = "    () => typeof window === 'undefined' ? '' : `${window.location.origin}/comunidad?historia=${story.id}`,"
  const newValue = "    () => typeof window === 'undefined' ? '' : `${window.location.origin}/historia/${story.id}`,"
  if (source.includes(newValue)) return source
  if (!source.includes(oldValue)) throw new Error('No se encontró la URL compartida de historias')
  return source.replace(oldValue, newValue)
})

patchFile('src/components/vitrinas/VitrinaInlineInteraction.tsx', source => {
  const oldBlock = `  useEffect(() => {
    const baseUrl = window.location.href.split('#')[0]
    setShareUrl(anchorId ? \`${'${baseUrl}'}#${'${anchorId}'}\` : baseUrl)
  }, [anchorId])`
  const newBlock = `  useEffect(() => {
    const origin = window.location.origin
    if (targetType === 'page' || !targetId) {
      setShareUrl(\`${'${origin}'}/p/${'${slug}'}\`)
      return
    }
    setShareUrl(\`${'${origin}'}/publicacion/${'${targetType}'}/${'${targetId}'}\`)
  }, [slug, targetId, targetType])`
  if (source.includes(newBlock)) return source
  if (!source.includes(oldBlock)) throw new Error('No se encontró la URL compartida de publicaciones')
  return source.replace(oldBlock, newBlock)
})

patchFile('src/app/p/[slug]/page.tsx', source => {
  let next = source
  if (!next.includes("import type { Metadata } from 'next'")) {
    next = next.replace(
      "import { createAdminSupabaseClient } from '@/lib/supabase-admin'",
      "import type { Metadata } from 'next'\nimport { createAdminSupabaseClient } from '@/lib/supabase-admin'\nimport { absoluteUrl, getPageSharePreview } from '@/lib/share-preview'",
    )
  }

  if (!next.includes('export async function generateMetadata')) {
    const marker = 'export default async function PublicProjectPage'
    if (!next.includes(marker)) throw new Error('No se encontró el componente de página pública')
    const metadata = `export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const preview = await getPageSharePreview(slug)
  if (!preview) return { title: 'Página no disponible' }
  const imagePath = \`/p/${'${slug}'}/opengraph-image\`
  return {
    title: preview.title,
    description: preview.description,
    alternates: { canonical: preview.destination },
    openGraph: {
      type: 'website',
      locale: 'es_CL',
      siteName: 'Sello Tecnológico — Colegio Providencia',
      url: absoluteUrl(preview.destination),
      title: preview.title,
      description: preview.description,
      images: [{ url: imagePath, width: 1200, height: 630, alt: preview.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: preview.title,
      description: preview.description,
      images: [imagePath],
    },
  }
}

`
    next = next.replace(marker, metadata + marker)
  }
  return next
})
