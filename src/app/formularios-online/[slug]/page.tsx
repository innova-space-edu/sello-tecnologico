import type { Metadata } from 'next'
import OnlineSurveyPublic from '@/components/encuestas/OnlineSurveyPublic'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Encuesta pública | CreaLab',
  description: 'Responde una encuesta de proyectos de CreaLab sin registrarte.',
  robots: { index: false, follow: false },
}

export default async function FormularioOnlinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <OnlineSurveyPublic slug={slug} />
}
