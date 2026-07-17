import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ShareRedirect from '@/components/share/ShareRedirect'
import { absoluteUrl, getStorySharePreview } from '@/lib/share-preview'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const preview = await getStorySharePreview(id)
  if (!preview) return { title: 'Historia no disponible' }

  const sharePath = `/historia/${id}`
  const imagePath = `${sharePath}/opengraph-image`

  return {
    title: preview.title,
    description: preview.description,
    alternates: { canonical: preview.destination },
    openGraph: {
      type: 'article',
      locale: 'es_CL',
      siteName: 'Sello Tecnológico — Colegio Providencia',
      url: absoluteUrl(sharePath),
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

export default async function StorySharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const preview = await getStorySharePreview(id)
  if (!preview) notFound()
  return <ShareRedirect destination={preview.destination} title={preview.title} />
}
