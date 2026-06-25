'use client'
import { useState } from 'react'

type ReportData = {
  isAdmin?: boolean
  cursos: number
  proyectos: number
  proyectosRevisados?: number
  evidencias: number
  usuarios: number
  mensajes?: number
  incidencias?: number
  incidenciasPendientes?: number
  usuariosBloqueados?: number
  portafolios?: number
  proyectosActivos?: number
  mensajesNoLeidos?: number
  ingresosRegistrados?: number
  visitasEduAI?: number
  descargasPDF?: number
  porEstado: Record<string, number>
  porRol: Record<string, number>
  evidenciasTipo?: Record<string, number>
  evidenciasEtapa?: Record<string, number>
  flaggedCategory?: Record<string, number>
  invitationsStatus?: Record<string, number>
  accessEvents?: Record<string, number>
  accessPages?: Record<string, number>
  recientes?: Record<string, any[]>
}

const trunc = (value: unknown, max = 80) => {
  const text = String(value ?? '—')
  return text.length > max ? `${text.slice(0, max)}...` : text
}

const pct = (value: number, total: number) => total ? `${Math.round((value / total) * 100)}%` : '0%'

async function imageToDataUrl(src: string) {
  const response = await fetch(src)
  const blob = await response.blob()
  return await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

export default function ExportPDF({ data }: { data: ReportData }) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const today = new Date().toLocaleString('es-CL')
      const fileDate = new Date().toISOString().slice(0, 10)

      const BLUE = [30, 58, 138] as [number, number, number]
      const CYAN = [14, 165, 233] as [number, number, number]
      const INDIGO = [79, 70, 229] as [number, number, number]
      const LIGHT = [248, 250, 252] as [number, number, number]
      const TEXT = [15, 23, 42] as [number, number, number]

      doc.setFillColor(...BLUE)
      doc.rect(0, 0, 210, 42, 'F')
      doc.setFillColor(...CYAN)
      doc.rect(0, 36, 210, 6, 'F')

      try {
        const logo = await imageToDataUrl('/logo-empresa.png')
        doc.addImage(logo, 'PNG', 166, 8, 24, 23)
      } catch {}

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('Reporte Sello Tecnológico', 14, 16)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Colegio Providencia · Innova Space Education', 14, 24)
      doc.text(`Generado: ${today}`, 14, 31)

      doc.setTextColor(...TEXT)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text(data.isAdmin ? 'Resumen administrativo completo' : 'Resumen general', 14, 54)

      autoTable(doc, {
        startY: 60,
        head: [['Indicador', 'Valor', 'Lectura rápida']],
        body: [
          ['Usuarios', data.usuarios, 'Cuentas registradas en la plataforma'],
          ['Proyectos', data.proyectos, 'Fichas y trabajos creados'],
          ['Proyectos revisados', data.proyectosRevisados ?? data.porEstado?.Revisado ?? 0, 'Proyectos marcados como revisados desde la sección Proyectos'],
          ['Evidencias', data.evidencias, 'Archivos o registros subidos'],
          ['Cursos', data.cursos, 'Cursos disponibles'],
          ...(data.isAdmin ? [
            ['Mensajes', data.mensajes ?? 0, 'Mensajes directos monitoreados'],
            ['Incidencias', data.incidencias ?? 0, 'Mensajes peligrosos o alertas'],
            ['Incidencias pendientes', data.incidenciasPendientes ?? 0, 'Requieren revisión administrativa'],
            ['Usuarios bloqueados', data.usuariosBloqueados ?? 0, 'Cuentas con bloqueo activo'],
            ['Portafolios', data.portafolios ?? 0, 'Portafolios creados o actualizados'],
            ['Ingresos registrados', data.ingresosRegistrados ?? 0, 'Eventos de inicio de sesión capturados'],
            ['Visitas a EduAI', data.visitasEduAI ?? 0, 'Aperturas de la integración EduAI'],
            ['Descargas PDF', data.descargasPDF ?? 0, 'Exportaciones del reporte administrativo'],
          ] : []),
        ],
        headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: LIGHT },
        styles: { fontSize: 9.5, cellPadding: 3, textColor: TEXT },
        columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } },
      })

      let y = (doc as any).lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...BLUE)
      doc.text('Distribuciones principales', 14, y)

      const distributionRows = [
        ...Object.entries(data.porRol).map(([k, v]) => ['Usuarios por rol', k, v, pct(v, data.usuarios)]),
        ...Object.entries(data.porEstado).map(([k, v]) => ['Proyectos por estado', k, v, pct(v, data.proyectos)]),
        ...Object.entries(data.evidenciasTipo ?? {}).map(([k, v]) => ['Evidencias por tipo', k, v, pct(v, data.evidencias)]),
        ...Object.entries(data.evidenciasEtapa ?? {}).map(([k, v]) => ['Evidencias por etapa', k, v, pct(v, data.evidencias)]),
        ...Object.entries(data.flaggedCategory ?? {}).map(([k, v]) => ['Incidencias por categoría', k, v, pct(v, data.incidencias ?? 0)]),
        ...Object.entries(data.accessEvents ?? {}).map(([k, v]) => ['Accesos por evento', k, v, pct(v, Object.values(data.accessEvents ?? {}).reduce((a, b) => a + b, 0))]),
        ...Object.entries(data.accessPages ?? {}).slice(0, 10).map(([k, v]) => ['Páginas visitadas', k, v, pct(v, Object.values(data.accessPages ?? {}).reduce((a, b) => a + b, 0))]),
      ]

      autoTable(doc, {
        startY: y + 5,
        head: [['Área', 'Categoría', 'Cantidad', '%']],
        body: distributionRows.length ? distributionRows : [['Sin datos', '—', 0, '0%']],
        headStyles: { fillColor: INDIGO, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        styles: { fontSize: 9, cellPadding: 2.8, textColor: TEXT },
        columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' } },
      })

      if (data.isAdmin) {
        y = (doc as any).lastAutoTable.finalY + 10
        if (y > 230) { doc.addPage(); y = 20 }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...BLUE)
        doc.text('Proyectos recientes', 14, y)

        const proyectos = data.recientes?.proyectos ?? []
        autoTable(doc, {
          startY: y + 5,
          head: [['Proyecto', 'Estado', 'Tipo', 'Curso', 'Fecha']],
          body: proyectos.length ? proyectos.map((p: any) => [
            trunc(p.title, 48),
            p.status ?? '—',
            trunc(p.type, 26),
            p.courses?.name ?? '—',
            p.created_at ? new Date(p.created_at).toLocaleDateString('es-CL') : '—',
          ]) : [['Sin proyectos recientes', '—', '—', '—', '—']],
          headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: LIGHT },
          styles: { fontSize: 8, cellPadding: 2.2, overflow: 'linebreak', textColor: TEXT },
        })
      }

      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setDrawColor(226, 232, 240)
        doc.line(14, 282, 196, 282)
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text(`Sello Tecnológico · Reporte de análisis · Página ${i} de ${pageCount}`, 14, 288)
      }

      await fetch('/api/report-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: data.isAdmin ? 'admin_full' : 'general',
          summary: { proyectos: data.proyectos, proyectosRevisados: data.proyectosRevisados ?? data.porEstado?.Revisado ?? 0, usuarios: data.usuarios, evidencias: data.evidencias },
        }),
      }).catch(() => null)

      doc.save(`reporte-sello-tecnologico-${fileDate}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? 'Generando PDF…' : '📄 Exportar PDF'}
    </button>
  )
}
