import { createShareImage } from '@/lib/share-image'
import { getStorySharePreview } from '@/lib/share-preview'

export const runtime = 'nodejs'
export const alt = 'Historia de Sello Tecnológico'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function StoryOpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const preview = await getStorySharePreview(id)

  return createShareImage(preview ?? {
    title: 'Historia no disponible',
    description: 'Este contenido ya no se encuentra disponible.',
    label: 'Historia',
    destination: '/comunidad',
    mediaKind: 'story',
    theme: '#1d4ed8',
    accent: '#7c3aed',
  })
}
