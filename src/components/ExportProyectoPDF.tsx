'use client'
import { useState } from 'react'

// ── Constantes institucionales (modificar aquí si cambia el colegio) ─────────
const INST = {
  nombre: 'COLEGIO PROVIDENCIA',
  subtitulo: 'Sello Tecnológico',
  descripcion: 'Ficha de Proyecto Tecnológico — Expediente Oficial',
  footer: 'Colegio Providencia · Sello Tecnológico · Innova Space Education 2026',
}

// ── Logo del colegio en base64 (JPEG 225×225) ────────────────────────────────
const LOGO_B64 = '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'

interface Props {
  proyecto: any
  evidencias?: any[]
  curso?: string
}

const isImageUrl = (url: string) =>
  /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(url)

async function fetchImageAsBase64(url: string): Promise<{ data: string; format: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const format = blob.type.includes('png') ? 'PNG' : 'JPEG'
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve({ data: result.split(',')[1], format })
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
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
      const AZUL       = [30,  58,  138] as [number,number,number]
      const AZUL_CLARO = [239, 246, 255] as [number,number,number]
      const AZUL_MED   = [96,  165, 250] as [number,number,number]
      const GRIS       = [107, 114, 128] as [number,number,number]
      const GRIS_CLARO = [249, 250, 251] as [number,number,number]
      const VACIO_BG   = [255, 251, 235] as [number,number,number]
      const VACIO_TEXT = [180, 120,  40] as [number,number,number]
      const today = new Date().toLocaleDateString('es-CL')
      const pageW = 210
      let y = 0

      // ── miniHeader: logo pequeño + datos en páginas internas ─────────
      const miniHeader = () => {
        doc.setFillColor(...AZUL)
        doc.rect(0, 0, pageW, 13, 'F')
        // Logo pequeño (10×10 mm)
        try {
          doc.addImage(LOGO_B64, 'JPEG', 3, 1.5, 10, 10)
        } catch { /* si falla el logo, continúa sin él */ }
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.text(INST.subtitulo, 15, 6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(proyecto.title ?? 'Proyecto', 15, 11, { maxWidth: pageW - 50 })
        doc.text(`Pág. ${doc.getNumberOfPages()}`, pageW - 14, 8, { align: 'right' })
      }

      const checkPage = (needed = 30) => {
        if (y + needed > 278) {
          doc.addPage()
          miniHeader()
          y = 20
        }
      }

      // ── PORTADA ────────────────────────────────────────────────────────
      // Banda azul de cabecera
      doc.setFillColor(...AZUL)
      doc.rect(0, 0, pageW, 68, 'F')
      doc.setFillColor(...AZUL_MED)
      doc.rect(0, 65, pageW, 3, 'F')

      // Logo real del colegio (grande: 28×28 mm)
      try {
        doc.addImage(LOGO_B64, 'JPEG', 12, 7, 28, 28)
      } catch {
        // Fallback: cuadro blanco con iniciales
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(12, 7, 28, 28, 3, 3, 'F')
        doc.setTextColor(...AZUL)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('CP', 26, 24, { align: 'center' })
      }

      // Nombre institucional
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(INST.nombre, 44, 16)
      doc.setFontSize(16)
      doc.text(INST.subtitulo, 44, 25)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(INST.descripcion, 44, 32)

      // Info rápida (derecha)
      doc.setFontSize(7.5)
      doc.text(`Generado: ${today}`,           pageW - 14, 14, { align: 'right' })
      if (curso) doc.text(`Curso: ${curso}`,   pageW - 14, 20, { align: 'right' })
      doc.text(`Estado: ${proyecto.status ?? 'Sin estado'}`, pageW - 14, 26, { align: 'right' })
      doc.text(`Evidencias: ${evidencias.length}`,           pageW - 14, 32, { align: 'right' })

      // Título del proyecto
      doc.setTextColor(...AZUL)
      doc.setFontSize(19)
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(proyecto.title ?? 'Sin título', pageW - 28)
      doc.text(titleLines, 14, 82)
      y = 82 + titleLines.length * 9

      // Tags
      const tags = [
        ...(Array.isArray(proyecto.tipo_proyecto) ? proyecto.tipo_proyecto : []),
        proyecto.semestre ? `${proyecto.semestre}° Sem.` : null,
        proyecto.metodologia ?? null,
        proyecto.organizacion_trabajo ?? null,
      ].filter(Boolean) as string[]
      if (tags.length > 0) {
        let tagX = 14
        doc.setFontSize(7.5)
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

      // ── addSection: muestra TODOS los campos (vacíos → ámbar "No completado") ──
      const addSection = (titulo: string, campos: [string, any][]) => {
        checkPage(22 + campos.length * 14)

        doc.setFillColor(...AZUL)
        doc.roundedRect(14, y, pageW - 28, 9, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(titulo, 18, y + 6)
        y += 13

        for (const [label, rawValue] of campos) {
          const isEmpty = !rawValue || rawValue === '' ||
            (Array.isArray(rawValue) && rawValue.filter(Boolean).length === 0)
          const displayValue = val(rawValue)
          checkPage(18)

          doc.setTextColor(...GRIS)
          doc.setFontSize(7)
          doc.setFont('helvetica', 'bold')
          doc.text(label.toUpperCase(), 16, y)
          y += 4

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
        ['Nombre del proyecto',           proyecto.title],
        ['Año',                           proyecto.year ?? new Date().getFullYear()],
        ['Semestre',                      proyecto.semestre ? `${proyecto.semestre}° Semestre` : null],
        ['Curso',                         curso],
        ['Asignaturas involucradas',      proyecto.asignaturas],
        ['Docentes responsables',         proyecto.docentes_responsables],
        ['Tipo de proyecto',              proyecto.tipo_proyecto],
        ['Estado actual',                 proyecto.status],
        ['Fecha de inicio',               proyecto.start_date],
        ['Fecha de término',              proyecto.end_date],
        ['Integrantes del equipo y roles',proyecto.integrantes_roles],
      ])

      // ── B. Curricular ─────────────────────────────────────────────────
      addSection('B. Fundamentación curricular (MINEDUC)', [
        ['Objetivos de Aprendizaje (OA)',          proyecto.objetivos_aprendizaje],
        ['Indicador de evaluación trabajado',       proyecto.indicador_oa],
        ['Habilidades trabajadas',                  proyecto.habilidades],
        ['Vinculación con el PEI y Sello Tecnológico', proyecto.vinculacion_pei],
      ])

      // ── C. Investigación ──────────────────────────────────────────────
      addSection('C. Investigación y problema', [
        ['Problema detectado',         proyecto.problema_detectado],
        ['Evidencia del problema',     proyecto.evidencia_problema],
        ['Pregunta guía del proyecto', proyecto.pregunta_guia],
        ['Preguntas de investigación', proyecto.preguntas_investigacion],
        ['Contexto del problema',      proyecto.contexto_problema],
        ['Justificación del proyecto', proyecto.justificacion],
        ['Hipótesis del proyecto',     proyecto.hipotesis],
      ])

      // ── D. Metodología ────────────────────────────────────────────────
      addSection('D. Metodología de trabajo', [
        ['Metodología utilizada',    proyecto.metodologia],
        ['Organización del trabajo', proyecto.organizacion_trabajo],
        ['Herramientas tecnológicas',proyecto.herramientas_tecnologicas],
        ['Materiales físicos',       proyecto.herramientas_materiales],
      ])

      // ── D. Etapas (tabla) ─────────────────────────────────────────────
      if (proyecto.etapas_metodologia && typeof proyecto.etapas_metodologia === 'object') {
        checkPage(42)
        doc.setFillColor(...AZUL)
        doc.roundedRect(14, y, pageW - 28, 9, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text('D. Etapas del proyecto', 18, y + 6)
        y += 11

        const etapasMap: Record<string, string> = {
          investigacion: '1. Investigación',
          diseno:        '2. Diseño',
          desarrollo:    '3. Desarrollo',
          evaluacion:    '4. Evaluación',
          cierre:        '5. Cierre',
        }
        const etapasRows = Object.entries(etapasMap).map(([key, nombre]) => {
          const e = (proyecto.etapas_metodologia as any)[key]
          if (!e) return [nombre, 'Sin datos', '—', '—', '—']
          return [
            nombre,
            e.estado ?? 'Pendiente',
            e.num_sesiones ? `${e.num_sesiones} ses.` : '—',
            e.fecha_inicio ? `${e.fecha_inicio} → ${e.fecha_fin ?? '—'}` : '—',
            e.descripcion
              ? e.descripcion.substring(0, 50) + (e.descripcion.length > 50 ? '…' : '')
              : 'Sin descripción',
          ]
        })
        autoTable(doc, {
          startY: y,
          head: [['Etapa','Estado','Sesiones','Período','Descripción']],
          body: etapasRows,
          headStyles:         { fillColor: AZUL, textColor: 255, fontSize: 7.5 },
          bodyStyles:         { fontSize: 7.5 },
          alternateRowStyles: { fillColor: AZUL_CLARO },
          columnStyles:       { 0:{cellWidth:32}, 1:{cellWidth:22}, 2:{cellWidth:18}, 3:{cellWidth:28} },
          margin:             { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }

      // ── E. STEAM ──────────────────────────────────────────────────────
      addSection('E. Enfoque STEAM', [
        ['Ciencia (S)',                              proyecto.steam_ciencia],
        ['Tecnologia (T)',                           proyecto.steam_tecnologia],
        ['Ingenieria (E)',                           proyecto.steam_ingenieria],
        ['Arte (A)',                                 proyecto.steam_arte],
        ['Matematica (M)',                           proyecto.steam_matematica],
        ['Uso de IA en el proyecto',                 proyecto.uso_ia],
        ['Estrategias de verificacion y etica de IA',proyecto.estrategia_verificacion],
      ])

      // ── F. Diseño y producto ──────────────────────────────────────────
      addSection('F. Diseno y producto final', [
        ['Objetivo general del proyecto',        proyecto.objetivo_general],
        ['Objetivos especificos',                proyecto.objetivos_especificos],
        ['Solucion propuesta',                   proyecto.solucion_propuesta],
        ['Descripcion del boceto / diseno prel.',proyecto.boceto_descripcion],
        ['Enlace al boceto o diseno',            proyecto.boceto_url],
        ['Tipo de producto',                     proyecto.tipo_producto],
        ['Descripcion del producto final',       proyecto.description],
      ])

      // ── G. Evaluación ─────────────────────────────────────────────────
      addSection('G. Evaluacion', [
        ['Instrumentos de evaluacion',  proyecto.instrumento_evaluacion],
        ['Criterios evaluados',         proyecto.criterios_evaluados],
        ['Autoevaluacion / Coevaluacion',proyecto.autoevaluacion],
      ])

      // ── H. Reflexión final ────────────────────────────────────────────
      addSection('H. Reflexion final', [
        ['Aprendizajes logrados',       proyecto.aprendizajes_logrados],
        ['Dificultades encontradas',    proyecto.dificultades],
        ['Mejoras para futuras versiones',proyecto.mejoras],
        ['Impacto en la comunidad',     proyecto.impacto_comunidad],
        ['Fuentes consultadas / Bibliografia',proyecto.fuentes_consultadas],
      ])

      // ── I. Evidencias ─────────────────────────────────────────────────
      checkPage(32)
      doc.setFillColor(...AZUL)
      doc.roundedRect(14, y, pageW - 28, 9, 1, 1, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(`I. Evidencias adjuntas (${evidencias.length})`, 18, y + 6)
      y += 13

      if (evidencias.length === 0) {
        doc.setFillColor(...VACIO_BG)
        doc.roundedRect(14, y, pageW - 28, 11, 1, 1, 'F')
        doc.setTextColor(...VACIO_TEXT)
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'normal')
        doc.text('Sin evidencias cargadas para este proyecto.', 17, y + 7.5)
        y += 16
      } else {
        // Tabla resumen
        autoTable(doc, {
          startY: y,
          head: [['#','Titulo','Tipo','Fecha','Descripcion']],
          body: evidencias.map((ev, i) => [
            String(i + 1),
            ev.title ?? '—',
            ev.type ?? ev.evidencia_tipo ?? '—',
            ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-CL') : '—',
            ev.description
              ? ev.description.substring(0, 50) + (ev.description.length > 50 ? '…' : '')
              : '—',
          ]),
          headStyles:         { fillColor: AZUL, textColor: 255, fontSize: 7 },
          bodyStyles:         { fontSize: 7 },
          alternateRowStyles: { fillColor: AZUL_CLARO },
          columnStyles:       { 0:{cellWidth:8}, 1:{cellWidth:42}, 2:{cellWidth:26}, 3:{cellWidth:24} },
          margin:             { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 10

        // Ficha detallada de cada evidencia
        for (let i = 0; i < evidencias.length; i++) {
          const ev = evidencias[i]
          checkPage(50)

          // Sub-header de evidencia
          doc.setFillColor(40, 80, 170)
          doc.roundedRect(14, y, pageW - 28, 8, 1, 1, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.text(`Evidencia ${i + 1}: ${ev.title ?? 'Sin título'}`, 18, y + 5.5)
          y += 11

          const evCampos: [string, any][] = [
            ['Tipo de evidencia',             ev.type ?? ev.evidencia_tipo],
            ['Etapa del proyecto',            ev.evidencia_tipo ?? ev.etapa],
            ['Descripcion',                   ev.description],
            ['Reflexion sobre el aprendizaje',ev.reflexion_aprendizaje],
            ['Fecha de subida',               ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-CL') : null],
          ]
          if (ev.file_url) evCampos.push(['URL / Enlace al archivo', ev.file_url])

          for (const [label, rawValue] of evCampos) {
            const isEmpty = !rawValue || rawValue === ''
            const displayValue = val(rawValue)
            checkPage(16)
            doc.setTextColor(...GRIS)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.text(label.toUpperCase(), 16, y)
            y += 4
            const lines = doc.splitTextToSize(displayValue, pageW - 32)
            const boxH = lines.length * 4.5 + 4
            if (isEmpty) {
              doc.setFillColor(...VACIO_BG); doc.setTextColor(...VACIO_TEXT)
            } else {
              doc.setFillColor(245, 248, 255); doc.setTextColor(31, 41, 55)
            }
            doc.roundedRect(14, y, pageW - 28, boxH, 1, 1, 'F')
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            doc.text(lines, 17, y + 3.5)
            y += boxH + 4
          }

          // Imagen incrustada si es foto
          if (ev.file_url && isImageUrl(ev.file_url)) {
            checkPage(60)
            doc.setTextColor(...GRIS)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.text('IMAGEN DE EVIDENCIA', 16, y)
            y += 4

            const imgData = await fetchImageAsBase64(ev.file_url)
            if (imgData) {
              const maxW = pageW - 28
              const maxH = 55
              try {
                doc.addImage(imgData.data, imgData.format as any, 14, y, maxW, maxH)
                doc.setDrawColor(...AZUL_MED)
                doc.setLineWidth(0.3)
                doc.rect(14, y, maxW, maxH)
                y += maxH + 6
              } catch {
                doc.setFillColor(...VACIO_BG)
                doc.roundedRect(14, y, maxW, 10, 1, 1, 'F')
                doc.setTextColor(...VACIO_TEXT)
                doc.setFontSize(8)
                doc.setFont('helvetica', 'normal')
                doc.text('No se pudo incrustar la imagen. Ver enlace adjunto.', 17, y + 7)
                y += 15
              }
            } else {
              doc.setFillColor(...VACIO_BG)
              doc.roundedRect(14, y, pageW - 28, 10, 1, 1, 'F')
              doc.setTextColor(...VACIO_TEXT)
              doc.setFontSize(8)
              doc.setFont('helvetica', 'normal')
              doc.text('Imagen no disponible (acceso restringido o URL inválida).', 17, y + 7)
              y += 15
            }
          }
          y += 4
        }
      }

      // ── FOOTER en todas las páginas ───────────────────────────────────
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFillColor(...AZUL)
        doc.rect(0, 287, pageW, 10, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(INST.footer, 14, 293)
        doc.text(`Página ${i} de ${totalPages}`, pageW - 14, 293, { align: 'right' })
      }

      const safeName = (proyecto.title ?? 'proyecto')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 60)
      doc.save(`${safeName}-${today.replace(/\//g, '-')}.pdf`)

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
