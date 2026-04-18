'use client'
import { useState } from 'react'

interface Props {
  proyecto: any
  evidencias?: any[]
  curso?: string
}

export default function ExportProyectoPDF({ proyecto, evidencias = [], curso }: Props) {
  const [loading, setLoading] = useState(false)

  const val = (v: any): string => {
    if (v === null || v === undefined || v === '') return 'No completado'
    if (Array.isArray(v)) return v.filter(Boolean).length > 0 ? v.filter(Boolean).join(', ') : 'No completado'
    return String(v).trim() || 'No completado'
  }

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
      const VACIO_BG = [255, 251, 235] as [number, number, number]
      const VACIO_TEXT = [180, 120, 40] as [number, number, number]
      const today = new Date().toLocaleDateString('es-CL')
      const pageW = 210

      const miniHeader = (titulo: string) => {
        doc.setFillColor(...AZUL)
        doc.rect(0, 0, pageW, 12, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.text(`Sello Tecnológico · ${proyecto.title ?? 'Proyecto'}`, 14, 8)
        doc.text(`Pág. ${doc.getNumberOfPages()}`, pageW - 14, 8, { align: 'right' })
      }

      const checkPage = (needed = 30) => {
        if (y + needed > 278) {
          doc.addPage()
          miniHeader(proyecto.title ?? '')
          y = 22
        }
      }

      // ── PORTADA ────────────────────────────────────────────────────────
      doc.setFillColor(...AZUL)
      doc.rect(0, 0, pageW, 65, 'F')
      doc.setFillColor(...AZUL_MED)
      doc.rect(0, 62, pageW, 4, 'F')

      doc.setFillColor(255, 255, 255)
      doc.roundedRect(14, 8, 22, 22, 3, 3, 'F')
      doc.setTextColor(...AZUL)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('CP', 25, 22, { align: 'center' })

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('COLEGIO PROVIDENCIA', 40, 14)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Sello Tecnológico', 40, 22)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Ficha de Proyecto Tecnológico — Expediente Oficial', 40, 29)

      doc.setFontSize(8)
      doc.text(`Generado: ${today}`, pageW - 14, 14, { align: 'right' })
      if (curso) doc.text(`Curso: ${curso}`, pageW - 14, 20, { align: 'right' })
      doc.text(`Estado: ${proyecto.status ?? 'Sin estado'}`, pageW - 14, 26, { align: 'right' })
      doc.text(`Evidencias: ${evidencias.length}`, pageW - 14, 32, { align: 'right' })

      // Título del proyecto
      doc.setTextColor(...AZUL)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(proyecto.title ?? 'Sin título', pageW - 28)
      doc.text(titleLines, 14, 80)
      let y = 80 + titleLines.length * 9

      // Tags
      const tags = [
        ...(Array.isArray(proyecto.tipo_proyecto) ? proyecto.tipo_proyecto : []),
        proyecto.semestre ? `${proyecto.semestre}° Sem.` : null,
        proyecto.metodologia ?? null,
        proyecto.organizacion_trabajo ?? null,
      ].filter(Boolean) as string[]

      if (tags.length > 0) {
        let tagX = 14
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        for (const tag of tags) {
          const tw = doc.getTextWidth(tag) + 6
          if (tagX + tw > pageW - 14) break
          doc.setFillColor(...AZUL_CLARO)
          doc.roundedRect(tagX, y + 2, tw, 6, 1, 1, 'F')
          doc.setTextColor(...AZUL)
          doc.text(tag, tagX + 3, y + 6.5)
          tagX += tw + 3
        }
        y += 12
      }

      if (proyecto.start_date || proyecto.end_date) {
        doc.setFontSize(8)
        doc.setTextColor(...GRIS)
        doc.text(`Período: ${proyecto.start_date ?? '—'}  →  ${proyecto.end_date ?? '—'}`, 14, y + 4)
        y += 10
      }

      doc.setDrawColor(...AZUL_MED)
      doc.setLineWidth(0.5)
      doc.line(14, y + 2, pageW - 14, y + 2)
      y += 10

      // ── FUNCIÓN addSection: muestra TODOS los campos, incluso vacíos ──
      const addSection = (titulo: string, campos: [string, any][]) => {
        checkPage(20 + campos.length * 15)

        // Header sección
        doc.setFillColor(...AZUL)
        doc.roundedRect(14, y, pageW - 28, 9, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(titulo, 18, y + 6)
        y += 13

        for (const [label, rawValue] of campos) {
          const isEmpty = !rawValue || rawValue === '' || (Array.isArray(rawValue) && rawValue.filter(Boolean).length === 0)
          const displayValue = val(rawValue)

          checkPage(18)

          // Label
          doc.setTextColor(...GRIS)
          doc.setFontSize(7)
          doc.setFont('helvetica', 'bold')
          doc.text(label.toUpperCase(), 16, y)
          y += 4

          // Valor
          doc.setFontSize(8.5)
          doc.setFont('helvetica', 'normal')
          const lines = doc.splitTextToSize(displayValue, pageW - 32)
          const boxH = lines.length * 5 + 5

          if (isEmpty) {
            doc.setFillColor(...VACIO_BG)
            doc.roundedRect(14, y, pageW - 28, boxH, 1, 1, 'F')
            doc.setTextColor(...VACIO_TEXT)
          } else {
            doc.setFillColor(...GRIS_CLARO)
            doc.roundedRect(14, y, pageW - 28, boxH, 1, 1, 'F')
            doc.setTextColor(31, 41, 55)
          }

          checkPage(boxH + 2)
          doc.text(lines, 17, y + 4)
          y += boxH + 5
        }
        y += 3
      }

      // ── A. Identificación ─────────────────────────────────────────────
      addSection('A. Identificación del proyecto', [
        ['Nombre del proyecto', proyecto.title],
        ['Año', proyecto.year ?? new Date().getFullYear()],
        ['Semestre', proyecto.semestre ? `${proyecto.semestre}° Semestre` : null],
        ['Curso', curso],
        ['Asignaturas involucradas', proyecto.asignaturas],
        ['Docentes responsables', proyecto.docentes_responsables],
        ['Tipo de proyecto', proyecto.tipo_proyecto],
        ['Estado actual', proyecto.status],
        ['Fecha de inicio', proyecto.start_date],
        ['Fecha de término', proyecto.end_date],
        ['Integrantes del equipo y roles', proyecto.integrantes_roles],
      ])

      // ── B. Curricular ─────────────────────────────────────────────────
      addSection('B. Fundamentación curricular (MINEDUC)', [
        ['Objetivos de Aprendizaje (OA)', proyecto.objetivos_aprendizaje],
        ['Indicador de evaluación trabajado', proyecto.indicador_oa],
        ['Habilidades trabajadas', proyecto.habilidades],
        ['Vinculación con el PEI y Sello Tecnológico', proyecto.vinculacion_pei],
      ])

      // ── C. Investigación y problema ───────────────────────────────────
      addSection('C. Investigación y problema', [
        ['Problema detectado', proyecto.problema_detectado],
        ['Evidencia del problema', proyecto.evidencia_problema],
        ['Pregunta guía del proyecto', proyecto.pregunta_guia],
        ['Preguntas de investigación', proyecto.preguntas_investigacion],
        ['Contexto del problema', proyecto.contexto_problema],
        ['Justificación del proyecto', proyecto.justificacion],
        ['Hipótesis del proyecto', proyecto.hipotesis],
      ])

      // ── D. Metodología ────────────────────────────────────────────────
      addSection('D. Metodología de trabajo', [
        ['Metodología utilizada', proyecto.metodologia],
        ['Organización del trabajo', proyecto.organizacion_trabajo],
        ['Herramientas tecnológicas', proyecto.herramientas_tecnologicas],
        ['Materiales físicos', proyecto.herramientas_materiales],
      ])

      // ── D. Etapas (tabla) ─────────────────────────────────────────────
      if (proyecto.etapas_metodologia && typeof proyecto.etapas_metodologia === 'object') {
        checkPage(40)
        doc.setFillColor(...AZUL)
        doc.roundedRect(14, y, pageW - 28, 9, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text('D. Etapas del proyecto', 18, y + 6)
        y += 11

        const etapasMap: Record<string, string> = {
          investigacion: '1. Investigación',
          diseno: '2. Diseño',
          desarrollo: '3. Desarrollo',
          evaluacion: '4. Evaluación',
          cierre: '5. Cierre',
        }
        const etapasRows = Object.entries(etapasMap).map(([key, nombre]) => {
          const e = (proyecto.etapas_metodologia as any)[key]
          if (!e) return [nombre, 'Sin datos', '—', '—', '—']
          return [
            nombre,
            e.estado ?? 'Pendiente',
            e.num_sesiones ? `${e.num_sesiones} ses.` : '—',
            e.fecha_inicio ? `${e.fecha_inicio} → ${e.fecha_fin ?? '—'}` : '—',
            e.descripcion ? e.descripcion.substring(0, 50) + (e.descripcion.length > 50 ? '…' : '') : 'Sin descripción',
          ]
        })

        autoTable(doc, {
          startY: y,
          head: [['Etapa', 'Estado', 'Sesiones', 'Período', 'Descripción']],
          body: etapasRows,
          headStyles: { fillColor: AZUL, textColor: 255, fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5 },
          alternateRowStyles: { fillColor: AZUL_CLARO },
          columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 22 }, 2: { cellWidth: 18 }, 3: { cellWidth: 28 } },
          margin: { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }

      // ── E. STEAM ──────────────────────────────────────────────────────
      addSection('E. Enfoque STEAM', [
        ['🔬 Ciencia (S)', proyecto.steam_ciencia],
        ['💻 Tecnología (T)', proyecto.steam_tecnologia],
        ['⚙️ Ingeniería (E)', proyecto.steam_ingenieria],
        ['🎨 Arte (A)', proyecto.steam_arte],
        ['📐 Matemática (M)', proyecto.steam_matematica],
        ['Uso de IA en el proyecto', proyecto.uso_ia],
        ['Estrategias de verificación y uso ético de IA', proyecto.estrategia_verificacion],
      ])

      // ── F. Diseño y producto ──────────────────────────────────────────
      addSection('F. Diseño y producto final', [
        ['Objetivo general del proyecto', proyecto.objetivo_general],
        ['Objetivos específicos', proyecto.objetivos_especificos],
        ['Solución propuesta', proyecto.solucion_propuesta],
        ['Descripción del boceto / diseño preliminar', proyecto.boceto_descripcion],
        ['Enlace al boceto o diseño', proyecto.boceto_url],
        ['Tipo de producto', proyecto.tipo_producto],
        ['Descripción del producto final', proyecto.description],
      ])

      // ── G. Evaluación ─────────────────────────────────────────────────
      addSection('G. Evaluación', [
        ['Instrumentos de evaluación', proyecto.instrumento_evaluacion],
        ['Criterios evaluados', proyecto.criterios_evaluados],
        ['Autoevaluación / Coevaluación', proyecto.autoevaluacion],
      ])

      // ── H. Reflexión final ────────────────────────────────────────────
      addSection('H. Reflexión final', [
        ['Aprendizajes logrados', proyecto.aprendizajes_logrados],
        ['Dificultades encontradas', proyecto.dificultades],
        ['Mejoras para futuras versiones', proyecto.mejoras],
        ['Impacto en la comunidad', proyecto.impacto_comunidad],
        ['Fuentes consultadas / Bibliografía', proyecto.fuentes_consultadas],
      ])

      // ── EVIDENCIAS ────────────────────────────────────────────────────
      checkPage(30)
      doc.setFillColor(...AZUL)
      doc.roundedRect(14, y, pageW - 28, 9, 1, 1, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(`I. Evidencias adjuntas (${evidencias.length})`, 18, y + 6)
      y += 13

      if (evidencias.length === 0) {
        doc.setFillColor(...VACIO_BG)
        doc.roundedRect(14, y, pageW - 28, 10, 1, 1, 'F')
        doc.setTextColor(...VACIO_TEXT)
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'normal')
        doc.text('Sin evidencias cargadas para este proyecto.', 17, y + 7)
        y += 15
      } else {
        // Tabla resumen de evidencias
        autoTable(doc, {
          startY: y,
          head: [['#', 'Título', 'Tipo', 'Etapa', 'Fecha de subida', 'Descripción']],
          body: evidencias.map((ev, i) => [
            String(i + 1),
            ev.title ?? '—',
            ev.type ?? ev.evidencia_tipo ?? '—',
            ev.evidencia_tipo ?? '—',
            ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-CL') : '—',
            ev.description ? ev.description.substring(0, 45) + (ev.description.length > 45 ? '…' : '') : '—',
          ]),
          headStyles: { fillColor: AZUL, textColor: 255, fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          alternateRowStyles: { fillColor: AZUL_CLARO },
          columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 38 }, 2: { cellWidth: 22 }, 3: { cellWidth: 22 }, 4: { cellWidth: 24 } },
          margin: { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 8

        // Detalle de cada evidencia
        evidencias.forEach((ev, i) => {
          checkPage(45)

          // Header mini de evidencia
          doc.setFillColor(30, 80, 180)
          doc.roundedRect(14, y, pageW - 28, 8, 1, 1, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.text(`Evidencia ${i + 1}: ${ev.title ?? 'Sin título'}`, 18, y + 5.5)
          y += 11

          const evCampos: [string, any][] = [
            ['Tipo de evidencia', ev.type ?? ev.evidencia_tipo],
            ['Etapa del proyecto', ev.evidencia_tipo ?? ev.etapa],
            ['Descripción', ev.description],
            ['Reflexión sobre el aprendizaje', ev.reflexion_aprendizaje],
            ['Fecha de subida', ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-CL') : null],
          ]

          if (ev.file_url) {
            evCampos.push(['URL / Enlace al archivo', ev.file_url])
          }

          for (const [label, rawValue] of evCampos) {
            const isEmpty = !rawValue || rawValue === ''
            const displayValue = val(rawValue)
            checkPage(15)

            doc.setTextColor(...GRIS)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.text(label.toUpperCase(), 16, y)
            y += 4

            const lines = doc.splitTextToSize(displayValue, pageW - 32)
            const boxH = lines.length * 4.5 + 4

            if (isEmpty) {
              doc.setFillColor(...VACIO_BG)
              doc.setTextColor(...VACIO_TEXT)
            } else {
              doc.setFillColor(245, 248, 255)
              doc.setTextColor(31, 41, 55)
            }
            doc.roundedRect(14, y, pageW - 28, boxH, 1, 1, 'F')
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            doc.text(lines, 17, y + 3.5)
            y += boxH + 4
          }
          y += 4
        })
      }

      // ── FOOTER en todas las páginas ───────────────────────────────────
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

      const fileName = `proyecto-${(proyecto.title ?? 'sin-titulo').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${today.replace(/\//g, '-')}.pdf`
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
      title="Exportar ficha completa como PDF — incluye todas las secciones y evidencias">
      {loading ? <>⏳ Generando PDF...</> : <>📄 Exportar PDF completo</>}
    </button>
  )
}
