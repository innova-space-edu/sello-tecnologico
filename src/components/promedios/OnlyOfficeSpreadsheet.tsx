'use client'

import NativeSpreadsheet from '@/components/promedios/NativeSpreadsheet'

type Props = { workbookId: string; title: string }

/**
 * Punto de entrada histórico de Promedios.
 *
 * Promedios utiliza el editor nativo del Sello Tecnológico. Se conserva el
 * nombre de este componente para no romper rutas antiguas, pero ONLYOFFICE ya
 * no participa en la ejecución del módulo.
 */
export default function OnlyOfficeSpreadsheet({ workbookId, title }: Props) {
  return <NativeSpreadsheet workbookId={workbookId} title={title} />
}
