import { createShareImage } from '@/lib/share-image'
import { getPageSharePreview } from '@/lib/share-preview'

export const runtime = 'nodejs'
export const alt = 'Página pública de Sello Tecnológico'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function PageOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const preview = await getPageSharePreview(slug)

  return createShareImage(preview ?? {
    title: 'Página no disponible',
    description: 'Esta página ya no se encuentra disponible.',
    label: 'Página de proyecto',
    destination: '/comunidad',
    mediaKind: 'page',
    theme: '#1d4ed8',
    accent: '#7c3aed',
  })
}
