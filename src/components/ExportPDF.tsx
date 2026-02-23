'use client'
import { useState } from 'react'

export default function ExportPDF({ data }: {
  data: {
    cursos: number
    proyectos: number
    evidencias: number
    usuarios: number
    porEstado: Record<string, number>
    porRol: Record<string, number>
  }
}) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF()
    const today = new Date().toLocaleDateString('es-CL')

    // Header
    doc.setFillColor(30, 58, 138)
    doc.rect(0, 0, 210, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Sello Tecnológico', 14, 15)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Colegio Providencia', 14, 23)
    doc.text(`Reporte generado: ${today}`, 14, 30)

    // Resumen general
    doc.setTextColor(30, 58, 138)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumen General', 14, 48)

    autoTable(doc, {
      startY: 52,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total de cursos', data.cursos],
        ['Total de proyectos', data.proyectos],
        ['Total de evidencias', data.evidencias],
        ['Total de usuarios', data.usuarios],
      ],
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      styles: { fontSize: 11 },
    })

    // Proyectos por estado
    const y1 = (doc as any).lastAutoTable.finalY + 12
    doc.setTextColor(30, 58, 138)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Proyectos por Estado', 14, y1)

    autoTable(doc, {
      startY: y1 + 4,
      head: [['Estado', 'Cantidad', 'Porcentaje']],
      body: Object.entries(data.porEstado).map(([estado, cantidad]) => [
        estado,
        cantidad,
        `${Math.round((cantidad / data.proyectos) * 100)}%`
      ]),
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      styles: { fontSize: 11 },
    })

    // Usuarios por rol
    const y2 = (doc as any).lastAutoTable.finalY + 12
    doc.setTextColor(30, 58, 138)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Usuarios por Rol', 14, y2)

    autoTable(doc, {
      startY: y2 + 4,
      head: [['Rol', 'Cantidad', 'Porcentaje']],
      body: Object.entries(data.porRol).map(([rol, cantidad]) => [
        rol,
        cantidad,
        `${Math.round((cantidad / data.usuarios) * 100)}%`
      ]),
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      styles: { fontSize: 11 },
    })

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Innova Space Education 2026 · Página ${i} de ${pageCount}`, 14, 290)
    }

    doc.save(`reporte-sello-tecnologico-${today}.pdf`)
    setLoading(false)
  }

  return (
    <button onClick={handleExport} disabled={loading}
      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
      {loading ? '⏳ Generando...' : '📄 Exportar PDF'}
    </button>
  )
}
