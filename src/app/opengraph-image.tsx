import { createShareImage } from '@/lib/share-image'

export const runtime = 'nodejs'
export const alt = 'CreaLab — Innova Space Education'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return createShareImage({
    title: 'CreaLab — Innova Space Education',
    description: 'Proyectos, historias, publicaciones y páginas creadas por nuestra comunidad educativa.',
    label: 'Comunidad educativa',
    destination: '/',
    mediaKind: 'page',
    theme: '#1d4ed8',
    accent: '#7c3aed',
  })
}
