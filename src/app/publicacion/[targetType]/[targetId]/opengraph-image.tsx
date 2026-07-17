import { createShareImage } from '@/lib/share-image'
import { getPublicationSharePreview } from '@/lib/share-preview'

export const runtime = 'nodejs'
export const alt = 'Publicación de Sello Tecnológico'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function PublicationOpenGraphImage({ params }: { params: Promise<{ targetType: string; targetId: string }> }) {
  const { targetType, targetId } = await params
  const preview = await getPublicationSharePreview(targetType, targetId)

  return createShareImage(preview ?? {
    title: 'Publicación no disponible',
    description: 'Este contenido ya no se encuentra disponible.',
    label: 'Publicación',
    destination: '/comunidad',
    mediaKind: 'post',
    theme: '#1d4ed8',
    accent: '#7c3aed',
  })
}
