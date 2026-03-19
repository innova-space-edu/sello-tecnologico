'use client'
import { useState } from 'react'

interface Props {
  proyecto: any
  evidencias?: any[]
  curso?: string
}

export default function ExportProyectoPDF({ proyecto, evidencias = [], curso }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const AZUL = [30, 58, 138] as [number, number, number]
      const AZUL_CLARO = [239, 246, 255] as [number, number, number]
      const AZUL_MED = [96, 165, 250] as [number, number, number]
      const GRIS = [107, 114, 128] as [number, number, number]
      const GRIS_CLARO = [249, 250, 251] as [number, number, number]
      const today = new Date().toLocaleDateString('es-CL')
      const pageW = 210

      // ── PORTADA ─────────────────────────────────────────────────────────
      // Fondo header azul
      doc.setFillColor(...AZUL)
      doc.rect(0, 0, pageW, 60, 'F')

      // Línea decorativa
      doc.setFillColor(...AZUL_MED)
      doc.rect(0, 57, pageW, 4, 'F')

      // Logo / inicial del colegio
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(14, 8, 22, 22, 3, 3, 'F')
      doc.setTextColor(...AZUL)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('CP', 25, 22, { align: 'center' })

      // Título institución
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('COLEGIO PROVIDENCIA', 40, 14)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Sello Tecnológico', 40, 22)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Ficha de Proyecto Tecnológico', 40, 29)

      // Info rápida en header
      doc.setFontSize(8)
      doc.text(`Generado: ${today}`, pageW - 14, 14, { align: 'right' })
      if (curso) doc.text(`Curso: ${curso}`, pageW - 14, 20, { align: 'right' })
      doc.text(`Estado: ${proyecto.status ?? '—'}`, pageW - 14, 26, { align: 'right' })

      // Título del proyecto
      doc.setTextColor(...AZUL)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(proyecto.title ?? 'Sin título', pageW - 28)
      doc.text(titleLines, 14, 75)

      let y = 75 + titleLines.length * 8

      // Tags del proyecto
      if (proyecto.tipo_proyecto?.length || proyecto.semestre || proyecto.metodologia) {
        const tags = [
          ...(proyecto.tipo_proyecto ?? []),
          proyecto.semestre ? `${proyecto.semestre}° Sem.` : null,
          proyecto.metodologia ?? null,
          proyecto.organizacion_trabajo ?? null,
        ].filter(Boolean) as string[]

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        let tagX = 14
        const tagY = y + 2
        for (const tag of tags) {
          const tw = doc.getTextWidth(tag) + 6
          if (tagX + tw > pageW - 14) break
          doc.setFillColor(...AZUL_CLARO)
          doc.roundedRect(tagX, tagY, tw, 6, 1, 1, 'F')
          doc.setTextColor(...AZUL)
          doc.text(tag, tagX + 3, tagY + 4)
          tagX += tw + 3
        }
        y = tagY + 10
      }

      // Fechas
      if (proyecto.start_date || proyecto.end_date) {
        doc.setFontSize(8)
        doc.setTextColor(...GRIS)
        doc.text(`📅 ${proyecto.start_date ?? '—'} → ${proyecto.end_date ?? '—'}`, 14, y + 2)
        y += 8
      }

      // Línea separadora
      doc.setDrawColor(...AZUL_MED)
      doc.setLineWidth(0.5)
      doc.line(14, y + 2, pageW - 14, y + 2)
      y += 8

      // ── SECCIONES ─────────────────────────────────────────────────────
      const addSection = (titulo: string, campos: [string, string | null | undefined][]) => {
        const validos = campos.filter(([, v]) => v)
        if (validos.length === 0) return

        // Verificar espacio
        if (y > 250) {
          doc.addPage()
          y = 20
          // Mini header en páginas siguientes
          doc.setFillColor(...AZUL)
          doc.rect(0, 0, pageW, 12, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(8)
          doc.text(`Sello Tecnológico · ${proyecto.title}`, 14, 8)
          doc.text(`Pág. ${doc.getNumberOfPages()}`, pageW - 14, 8, { align: 'right' })
          y = 20
        }

        // Header sección
        doc.setFillColor(...AZUL)
        doc.roundedRect(14, y, pageW - 28, 8, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(titulo, 18, y + 5.5)
        y += 12

        for (const [label, value] of validos) {
          if (!value) continue
          if (y > 265) {
            doc.addPage()
            y = 20
            doc.setFillColor(...AZUL)
            doc.rect(0, 0, pageW, 12, 'F')
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(8)
            doc.text(`Sello Tecnológico · ${proyecto.title}`, 14, 8)
            doc.text(`Pág. ${doc.getNumberOfPages()}`, pageW - 14, 8, { align: 'right' })
            y = 20
          }

          // Label
          doc.setTextColor(...GRIS)
          doc.setFontSize(7.5)
          doc.setFont('helvetica', 'bold')
          doc.text(label.toUpperCase(), 16, y)
          y += 4

          // Valor
          doc.setTextColor(31, 41, 55)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          const lines = doc.splitTextToSize(String(value), pageW - 32)
          doc.setFillColor(...GRIS_CLARO)
          doc.roundedRect(14, y, pageW - 28, lines.length * 5 + 4, 1, 1, 'F')
          doc.text(lines, 17, y + 4)
          y += lines.length * 5 + 8
        }
        y += 2
      }

      // A. Identificación
      addSection('A. Identificación del proyecto', [
        ['Nombre del proyecto', proyecto.title],
        ['Año', String(proyecto.year ?? new Date().getFullYear())],
        ['Semestre', proyecto.semestre ? `${proyecto.semestre}° Semestre` : null],
        ['Curso', curso],
        ['Asignaturas', Array.isArray(proyecto.asignaturas) ? proyecto.asignaturas.join(', ') : proyecto.asignaturas],
        ['Docentes responsables', Array.isArray(proyecto.docentes_responsables) ? proyecto.docentes_responsables.join(', ') : proyecto.docentes_responsables],
        ['Tipo de proyecto', Array.isArray(proyecto.tipo_proyecto) ? proyecto.tipo_proyecto.join(', ') : proyecto.tipo_proyecto],
        ['Estado', proyecto.status],
        ['Fecha inicio', proyecto.start_date],
        ['Fecha término', proyecto.end_date],
      ])

      // B. Curricular
      addSection('B. Fundamentación curricular (MINEDUC)', [
        ['Objetivos de Aprendizaje (OA)', proyecto.objetivos_aprendizaje],
        ['Habilidades trabajadas', Array.isArray(proyecto.habilidades) ? proyecto.habilidades.join(', ') : proyecto.habilidades],
        ['Vinculación con el PEI y Sello Tecnológico', proyecto.vinculacion_pei],
      ])

      // C. Problema
      addSection('C. Problema o desafío', [
        ['Pregunta guía del proyecto', proyecto.pregunta_guia],
        ['Contexto del problema', proyecto.contexto_problema],
        ['Justificación del proyecto', proyecto.justificacion],
      ])

      // D. Metodología
      addSection('D. Metodología de trabajo', [
        ['Metodología utilizada', proyecto.metodologia],
        ['Organización del trabajo', proyecto.organizacion_trabajo],
        ['Herramientas tecnológicas', Array.isArray(proyecto.herramientas_tecnologicas) ? proyecto.herramientas_tecnologicas.join(', ') : proyecto.herramientas_tecnologicas],
        ['Materiales físicos', Array.isArray(proyecto.herramientas_materiales) ? proyecto.herramientas_materiales.join(', ') : proyecto.herramientas_materiales],
      ])

      // D. Etapas (tabla)
      if (proyecto.etapas_metodologia && typeof proyecto.etapas_metodologia === 'object') {
        const etapasMap: Record<string, string> = {
          investigacion: '1. Investigación',
          diseno: '2. Diseño',
          desarrollo: '3. Desarrollo',
          evaluacion: '4. Evaluación',
          cierre: '5. Cierre',
        }
        const etapasRows = Object.entries(etapasMap).map(([key, nombre]) => {
          const e = (proyecto.etapas_metodologia as any)[key]
          if (!e) return [nombre, '—', '—', '—']
          return [
            nombre,
            e.estado ?? 'Pendiente',
            e.num_sesiones ? `${e.num_sesiones} sesiones` : '—',
            e.descripcion ? e.descripcion.substring(0, 60) + (e.descripcion.length > 60 ? '…' : '') : '—',
          ]
        })

        if (y > 230) { doc.addPage(); y = 20 }

        doc.setFillColor(...AZUL)
        doc.roundedRect(14, y, pageW - 28, 8, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text('D. Etapas del proyecto', 18, y + 5.5)
        y += 10

        autoTable(doc, {
          startY: y,
          head: [['Etapa', 'Estado', 'Sesiones', 'Descripción']],
          body: etapasRows,
          headStyles: { fillColor: AZUL, textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: AZUL_CLARO },
          columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 25 }, 2: { cellWidth: 25 } },
          margin: { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }

      // E. Tecnología e IA
      addSection('E. Uso de tecnología e IA', [
        ['Uso de IA en el proyecto', Array.isArray(proyecto.uso_ia) ? proyecto.uso_ia.join(', ') : proyecto.uso_ia],
        ['Estrategias de verificación y uso ético', proyecto.estrategia_verificacion],
      ])

      // F. Producto
      addSection('F. Producto final', [
        ['Tipo de producto', Array.isArray(proyecto.tipo_producto) ? proyecto.tipo_producto.join(', ') : proyecto.tipo_producto],
        ['Descripción del producto', proyecto.description],
      ])

      // G. Evaluación
      addSection('G. Evaluación', [
        ['Instrumentos de evaluación', Array.isArray(proyecto.instrumento_evaluacion) ? proyecto.instrumento_evaluacion.join(', ') : proyecto.instrumento_evaluacion],
        ['Criterios evaluados', Array.isArray(proyecto.criterios_evaluados) ? proyecto.criterios_evaluados.join(', ') : proyecto.criterios_evaluados],
        ['Autoevaluación / Coevaluación', proyecto.autoevaluacion],
      ])

      // H. Reflexión
      addSection('H. Reflexión final', [
        ['Aprendizajes logrados', proyecto.aprendizajes_logrados],
        ['Dificultades encontradas', proyecto.dificultades],
        ['Mejoras para futuras versiones', proyecto.mejoras],
        ['Impacto en la comunidad', proyecto.impacto_comunidad],
      ])

      // ── EVIDENCIAS ─────────────────────────────────────────────────────
      if (evidencias.length > 0) {
        if (y > 220) { doc.addPage(); y = 20 }
        doc.setFillColor(...AZUL)
        doc.roundedRect(14, y, pageW - 28, 8, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(`F. Evidencias adjuntas (${evidencias.length})`, 18, y + 5.5)
        y += 10

        autoTable(doc, {
          startY: y,
          head: [['Título', 'Tipo', 'Etapa', 'Fecha', 'Reflexión']],
          body: evidencias.map(ev => [
            ev.title ?? '—',
            ev.type ?? '—',
            ev.evidencia_tipo ?? '—',
            ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-CL') : '—',
            ev.reflexion_aprendizaje ? ev.reflexion_aprendizaje.substring(0, 40) + '…' : '—',
          ]),
          headStyles: { fillColor: AZUL, textColor: 255, fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5 },
          alternateRowStyles: { fillColor: AZUL_CLARO },
          margin: { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }

      // ── FOOTER en todas las páginas ─────────────────────────────────
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFillColor(...AZUL)
        doc.rect(0, 287, pageW, 10, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7)
        doc.text('Colegio Providencia · Sello Tecnológico · Innova Space Education 2026', 14, 293)
        doc.text(`Página ${i} de ${totalPages}`, pageW - 14, 293, { align: 'right' })
      }

      const fileName = `proyecto-${(proyecto.title ?? 'sin-titulo').toLowerCase().replace(/\s+/g, '-')}-${today.replace(/\//g, '-')}.pdf`
      doc.save(fileName)
    } catch (err) {
      console.error('Error generando PDF:', err)
      alert('Error al generar el PDF. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
      title="Exportar ficha completa como PDF">
      {loading ? (
        <>⏳ Generando PDF...</>
      ) : (
        <>📄 Exportar PDF</>
      )}
    </button>
  )
}
