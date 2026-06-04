import ResponderEncuesta from '@/components/encuestas/ResponderEncuesta'

export default async function FormularioPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ResponderEncuesta slug={slug} />
}
