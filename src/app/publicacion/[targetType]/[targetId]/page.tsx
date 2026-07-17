import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ShareRedirect from '@/components/share/ShareRedirect'
import { absoluteUrl, getPublicationSharePreview } from '@/lib/share-preview'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ targetType: string; targetId: string }> }): Promise<Metadata> {
  const { targetType, targetId } = await params
  const preview = await getPublicationSharePreview(targetType, targetId)
  if (!preview) return { title: 'Publicación no disponible' }

  const sharePath = `/publicacion/${targetType}/${targetId}`
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

export default async function PublicationSharePage({ params }: { params: Promise<{ targetType: string; targetId: string }> }) {
  const { targetType, targetId } = await params
  const preview = await getPublicationSharePreview(targetType, targetId)
  if (!preview) notFound()
  return <ShareRedirect destination={preview.destination} title={preview.title} />
}
