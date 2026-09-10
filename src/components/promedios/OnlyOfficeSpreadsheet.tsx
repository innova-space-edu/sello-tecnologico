'use client'

import LightSpreadsheet from '@/components/promedios/LightSpreadsheet'

type Props = { workbookId: string; title: string }

/**
 * Punto de entrada histórico de Promedios.
 *
 * Desde ahora la aplicación utiliza siempre el editor nativo del Sello
 * Tecnológico. Se conserva este componente para no romper las rutas que ya
 * lo importan, pero ONLYOFFICE deja de ser una dependencia de ejecución.
 */
export default function OnlyOfficeSpreadsheet({ workbookId, title }: Props) {
  return <LightSpreadsheet workbookId={workbookId} title={title} />
}
