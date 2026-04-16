'use client'
import { useState } from 'react'

interface Props {
  portafolio: any
  estudiante: any
  evidencias: any[]
  proyectos: any[]
  secciones?: any[]
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; format: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]
        const format = blob.type.includes('png') ? 'PNG' : 'JPEG'
        resolve({ data: base64, format })
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export default function ExportPortafolioPDF({ portafolio, estudiante, evidencias, proyectos, secciones = [] }: Props) {
  const [loading, setLoading] = useState(false)
  const [progreso, setProgreso] = useState('')

  const handleExport = async () => {
    setLoading(true)
    setProgreso('Iniciando...')
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const AZUL = [30, 58, 138] as [number, number, number]
      const AZUL_CLARO = [239, 246, 255] as [number, number, number]
      const AZUL_MED = [96, 165, 250] as [number, number, number]
      const VERDE = [16, 185, 129] as [number, number, number]
      const AMARILLO = [245, 158, 11] as [number, number, number]
      const NARANJA = [249, 115, 22] as [number, number, number]
      const GRIS = [107, 114, 128] as [number, number, number]
      const GRIS_CLARO = [249, 250, 251] as [number, number, number]
      const today = new Date().toLocaleDateString('es-CL')
      const pageW = 210

      // ── Precargar imágenes ─────────────────────────────────────────────
      setProgreso('Cargando imágenes...')
      const imagenesEvidencias: Map<string, { data: string; format: string }> = new Map()
      const evidenciasConImagen = evidencias.filter(
        e => e.file_url && e.file_type?.startsWith('image/')
      )
      for (let i = 0; i < evidenciasConImagen.length; i++) {
        const ev = evidenciasConImagen[i]
        setProgreso(`Cargando imagen ${i + 1} de ${evidenciasConImagen.length}...`)
        const img = await fetchImageAsBase64(ev.file_url)
        if (img) imagenesEvidencias.set(ev.id, img)
      }

      setProgreso('Generando PDF...')

      // ── PORTADA ─────────────────────────────────────────────────────────
      doc.setFillColor(...AZUL)
      doc.rect(0, 0, pageW, 80, 'F')
      doc.setFillColor(...AZUL_MED)
      doc.rect(0, 78, pageW, 4, 'F')

      // Avatar
      doc.setFillColor(255, 255, 255)
      doc.circle(pageW / 2, 40, 20, 'F')
      doc.setTextColor(...AZUL)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      const inicial = (estudiante?.full_name ?? estudiante?.email ?? 'E')[0].toUpperCase()
      doc.text(inicial, pageW / 2, 46, { align: 'center' })

      // Nombre
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(estudiante?.full_name ?? estudiante?.email ?? 'Estudiante', pageW / 2, 72, { align: 'center' })

      // Subtítulo
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(31, 41, 55)
      doc.text('Portafolio Digital Tecnológico', pageW / 2, 100, { align: 'center' })
      doc.setTextColor(...GRIS)
      doc.setFontSize(9)
      const infos = [
        estudiante?.curso ? `Curso: ${estudiante.curso}` : null,
        estudiante?.rut ? `RUT: ${estudiante.rut}` : null,
        `Año: ${portafolio?.year ?? new Date().getFullYear()}`,
      ].filter(Boolean).join('  ·  ')
      doc.text(infos, pageW / 2, 108, { align: 'center' })

      // Estadísticas rápidas
      const stats = [
        { label: 'Proyectos', value: proyectos.length, color: AZUL },
        { label: 'Evidencias', value: evidencias.length, color: VERDE },
        { label: 'Iniciales', value: evidencias.filter(e => e.evidencia_tipo === 'inicial').length, color: AMARILLO },
        { label: 'Finales', value: evidencias.filter(e => e.evidencia_tipo === 'final').length, color: VERDE },
      ]

      const statW = (pageW - 28) / stats.length
      stats.forEach((s, i) => {
        const x = 14 + i * statW
        doc.setFillColor(...(s.color as [number, number, number]))
        doc.roundedRect(x, 115, statW - 4, 18, 2, 2, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(String(s.value), x + (statW - 4) / 2, 126, { align: 'center' })
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(s.label, x + (statW - 4) / 2, 131, { align: 'center' })
      })

      doc.setTextColor(...GRIS)
      doc.setFontSize(7)
      doc.text(`Generado: ${today}  ·  Colegio Providencia · Sello Tecnológico`, pageW / 2, 142, { align: 'center' })

      let y = 150

      // ── HELPERS ─────────────────────────────────────────────────────────
      const checkPageBreak = (needed = 20) => {
        if (y + needed > 270) {
          doc.addPage()
          doc.setFillColor(...AZUL)
          doc.rect(0, 0, pageW, 12, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(8)
          doc.text(`Portafolio · ${estudiante?.full_name ?? ''}`, 14, 8)
          doc.text(`Pág. ${doc.getNumberOfPages()}`, pageW - 14, 8, { align: 'right' })
          y = 20
        }
      }

      const addSection = (titulo: string, color: [number, number, number] = AZUL) => {
        checkPageBreak(15)
        doc.setFillColor(...color)
        doc.roundedRect(14, y, pageW - 28, 8, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(titulo, 18, y + 5.5)
        y += 12
      }

      const addCampo = (label: string, value: string | null | undefined) => {
        if (!value) return
        checkPageBreak(20)
        doc.setTextColor(...GRIS)
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.text(label.toUpperCase(), 16, y)
        y += 4
        doc.setTextColor(31, 41, 55)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(value, pageW - 32)
        const boxH = lines.length * 5 + 4
        checkPageBreak(boxH + 4)
        doc.setFillColor(...GRIS_CLARO)
        doc.roundedRect(14, y, pageW - 28, boxH, 1, 1, 'F')
        doc.text(lines, 17, y + 4)
        y += boxH + 8
      }

      // ── A. PRESENTACIÓN ─────────────────────────────────────────────────
      if (portafolio?.quien_soy || portafolio?.que_interesa_aprender || portafolio?.que_espero_mejorar) {
        addSection('A. Presentación personal', AZUL)
        addCampo('¿Quién soy?', portafolio.quien_soy)
        addCampo('¿Qué me interesa aprender?', portafolio.que_interesa_aprender)
        addCampo('¿Qué espero mejorar este año?', portafolio.que_espero_mejorar)
        if (portafolio.asignaturas?.length)
          addCampo('Asignaturas', Array.isArray(portafolio.asignaturas) ? portafolio.asignaturas.join(', ') : portafolio.asignaturas)
        if (portafolio.docentes?.length)
          addCampo('Docentes', Array.isArray(portafolio.docentes) ? portafolio.docentes.join(', ') : portafolio.docentes)
        y += 2
      }

      // ── B. PROYECTOS ────────────────────────────────────────────────────
      if (proyectos.length > 0) {
        addSection('B. Proyectos', [79, 70, 229])
        autoTable(doc, {
          startY: y,
          head: [['Proyecto', 'Estado', 'Metodología', 'Fecha']],
          body: proyectos.map(p => [
            p.title ?? '—',
            p.status ?? '—',
            p.metodologia ?? '—',
            p.updated_at ? new Date(p.updated_at).toLocaleDateString('es-CL') : '—',
          ]),
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [237, 233, 254] },
          margin: { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 8

        for (const p of proyectos.slice(0, 5)) {
          checkPageBreak(12)
          doc.setFillColor(237, 233, 254)
          doc.roundedRect(14, y, pageW - 28, 6, 1, 1, 'F')
          doc.setTextColor(79, 70, 229)
          doc.setFontSize(8.5)
          doc.setFont('helvetica', 'bold')
          doc.text(`▸ ${p.title}`, 17, y + 4.5)
          y += 9
          if (p.pregunta_guia) addCampo('Pregunta guía', p.pregunta_guia)
          if (p.aprendizajes_logrados) addCampo('Aprendizajes logrados', p.aprendizajes_logrados)
          if (p.dificultades) addCampo('Dificultades', p.dificultades)
          if (p.mejoras) addCampo('Mejoras futuras', p.mejoras)
          if (p.impacto_comunidad) addCampo('Impacto en la comunidad', p.impacto_comunidad)
        }
        y += 2
      }

      // ── C. EVIDENCIAS CON IMÁGENES ────────────────────────────────────
      if (evidencias.length > 0) {
        addSection('C. Evidencias', VERDE)

        const porEtapa = [
          { etapa: 'inicial', label: '🟡 Iniciales', headerColor: [180, 120, 0] as [number, number, number], rowColor: [254, 243, 199] as [number, number, number] },
          { etapa: 'intermedia', label: '🔵 Intermedias', headerColor: [30, 58, 138] as [number, number, number], rowColor: [219, 234, 254] as [number, number, number] },
          { etapa: 'final', label: '🟢 Finales', headerColor: [5, 120, 80] as [number, number, number], rowColor: [209, 250, 229] as [number, number, number] },
        ]

        for (const { etapa, label, headerColor, rowColor } of porEtapa) {
          const evs = evidencias.filter(e => e.evidencia_tipo === etapa)
          if (evs.length === 0) continue

          checkPageBreak(12)
          doc.setFillColor(...rowColor)
          doc.roundedRect(14, y, pageW - 28, 6, 1, 1, 'F')
          doc.setTextColor(31, 41, 55)
          doc.setFontSize(8.5)
          doc.setFont('helvetica', 'bold')
          doc.text(`${label} (${evs.length})`, 17, y + 4.5)
          y += 9

          for (const ev of evs) {
            const imgData = imagenesEvidencias.get(ev.id)
            const tieneImagen = !!imgData
            const boxH = tieneImagen ? 46 : 22
            checkPageBreak(boxH + 4)

            // Tarjeta de evidencia
            doc.setFillColor(...GRIS_CLARO)
            doc.roundedRect(14, y, pageW - 28, boxH, 2, 2, 'F')

            if (tieneImagen && imgData) {
              // Imagen a la izquierda
              try {
                doc.addImage(imgData.data, imgData.format, 16, y + 2, 40, 42, undefined, 'FAST')
              } catch { /* ignorar si falla */ }
              const tx = 60
              const tw = pageW - 74

              doc.setTextColor(31, 41, 55)
              doc.setFontSize(9)
              doc.setFont('helvetica', 'bold')
              const titleLines = doc.splitTextToSize(ev.title ?? '—', tw)
              doc.text(titleLines, tx, y + 7)
              let ty = y + 7 + titleLines.length * 5

              doc.setFontSize(7.5)
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(...GRIS)
              if (ev.projects?.title) {
                doc.text(`📌 ${ev.projects.title}`, tx, ty)
                ty += 4.5
              }
              if (ev.profiles?.full_name) {
                doc.text(`👤 ${ev.profiles.full_name}${ev.profiles.curso ? ' · ' + ev.profiles.curso : ''}`, tx, ty)
                ty += 4.5
              }
              if (ev.reflexion_aprendizaje) {
                const ref = ev.reflexion_aprendizaje.substring(0, 80) + (ev.reflexion_aprendizaje.length > 80 ? '…' : '')
                const refLines = doc.splitTextToSize(`"${ref}"`, tw)
                doc.setTextColor(80, 80, 80)
                doc.text(refLines, tx, ty)
              }
            } else {
              // Sin imagen — layout horizontal compacto
              doc.setTextColor(31, 41, 55)
              doc.setFontSize(9)
              doc.setFont('helvetica', 'bold')
              const titleLines = doc.splitTextToSize(ev.title ?? '—', 100)
              doc.text(titleLines, 17, y + 6)

              doc.setFontSize(7.5)
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(...GRIS)
              const infoY = y + 6 + titleLines.length * 5
              const parts: string[] = []
              if (ev.projects?.title) parts.push(`📌 ${ev.projects.title}`)
              if (ev.profiles?.full_name) parts.push(`👤 ${ev.profiles.full_name}${ev.profiles.curso ? ' · ' + ev.profiles.curso : ''}`)
              if (ev.type) parts.push(ev.type)
              if (ev.created_at) parts.push(new Date(ev.created_at).toLocaleDateString('es-CL'))
              doc.text(parts.join('   '), 17, infoY)

              if (ev.reflexion_aprendizaje) {
                const ref = ev.reflexion_aprendizaje.substring(0, 100) + (ev.reflexion_aprendizaje.length > 100 ? '…' : '')
                doc.setTextColor(80, 80, 80)
                doc.setFontSize(7.5)
                const refLines = doc.splitTextToSize(`"${ref}"`, pageW - 34)
                doc.text(refLines, 17, infoY + 5)
              }
            }

            y += boxH + 4
          }
          y += 3
        }
        y += 2
      }

      // ── D. REFLEXIÓN FINAL ──────────────────────────────────────────────
      const tieneReflexion = portafolio?.lo_que_aprendi || portafolio?.lo_que_mejore || portafolio?.quiero_aprender || portafolio?.tecnologia_ayudo || portafolio?.reflexion_final
      if (tieneReflexion) {
        addSection('D. Reflexión final', AMARILLO)
        addCampo('Lo que aprendí este año', portafolio.lo_que_aprendi)
        addCampo('Lo que mejoré', portafolio.lo_que_mejore)
        addCampo('Lo que quiero seguir aprendiendo', portafolio.quiero_aprender)
        addCampo('Cómo me ayudó la tecnología', portafolio.tecnologia_ayudo)
        addCampo('Reflexión general', portafolio.reflexion_final)
      }

      // ── E. SECCIONES PERSONALIZADAS ─────────────────────────────────────
      if (secciones.length > 0) {
        addSection('E. Mis secciones personales', [14, 165, 233])
        for (const sec of secciones) {
          if (sec.content) addCampo(sec.title ?? 'Sección', sec.content)
        }
      }

      // ── FOOTER EN TODAS LAS PÁGINAS ──────────────────────────────────────
      const total = doc.getNumberOfPages()
      for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        doc.setFillColor(...AZUL)
        doc.rect(0, 287, pageW, 10, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7)
        doc.text(`Colegio Providencia · Sello Tecnológico · ${estudiante?.full_name ?? ''} · ${portafolio?.year ?? ''}`, 14, 293)
        doc.text(`Pág. ${i} / ${total}`, pageW - 14, 293, { align: 'right' })
      }

      const nombre = (estudiante?.full_name ?? 'portafolio').toLowerCase().replace(/\s+/g, '-')
      doc.save(`portafolio-${nombre}-${today.replace(/\//g, '-')}.pdf`)
    } catch (err) {
      console.error('Error generando PDF:', err)
      alert('Error al generar el PDF. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setProgreso('')
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
      title="Exportar portafolio completo como PDF con imágenes">
      {loading
        ? <><span className="animate-spin">⏳</span> {progreso || 'Generando PDF...'}</>
        : <>📄 Exportar PDF</>
      }
    </button>
  )
}
