export type ReportBuilderSection = {
  section_type: string
  title: string
  content: Record<string, unknown>
  student_example?: string | null
  teacher_example?: string | null
}

export type ReportBuilderTemplate = {
  id: string
  name: string
  description: string
  icon: string
  sections: ReportBuilderSection[]
}

const text = (title: string, studentExample: string, teacherExample: string): ReportBuilderSection => ({
  section_type: 'text',
  title,
  content: { text: '' },
  student_example: studentExample,
  teacher_example: teacherExample,
})

export const REPORT_BUILDER_TEMPLATES: ReportBuilderTemplate[] = [
  {
    id: 'blank',
    name: 'Informe en blanco',
    description: 'Comienza con una portada y un bloque vacío. El grupo decide toda la estructura.',
    icon: '📄',
    sections: [
      text('Título o portada', 'Ejemplo: escribe el nombre del proyecto, integrantes, curso y fecha.', 'Revisar identificación del proyecto y del equipo.'),
      text('Primera sección', 'Escribe aquí el primer contenido del informe. Puedes cambiar el título, agregar bloques o eliminarlo.', 'Revisar que el grupo organice una estructura coherente.'),
    ],
  },
  {
    id: 'project',
    name: 'Informe de proyecto',
    description: 'Plantilla general para proyectos escolares, tecnológicos o comunitarios.',
    icon: '🧩',
    sections: [
      text('Resumen del proyecto', 'Resume el problema, la solución, las actividades y el resultado principal.', 'Comprobar que el resumen represente el informe completo.'),
      text('Problema o necesidad', 'Explica qué situación detectaron y qué evidencias permitieron reconocerla.', 'Revisar claridad del problema y respaldo con evidencias.'),
      text('Objetivos', 'Escribe un objetivo general y objetivos específicos medibles.', 'Comprobar coherencia entre problema, objetivos y resultados.'),
      text('Metodología y organización', 'Describe etapas, tareas, responsables, participantes y recursos utilizados.', 'Revisar procedimiento y distribución del trabajo.'),
      { section_type: 'resources', title: 'Evidencias del proceso', content: { text: '', resources: [] }, student_example: 'Selecciona imágenes, videos, documentos o páginas desde el panel de apoyo.', teacher_example: 'Evaluar pertinencia, orden y explicación de las evidencias.' },
      { section_type: 'table', title: 'Resultados y análisis', content: { text: '', table: [['Indicador', 'Situación inicial', 'Resultado final'], ['', '', '']] }, student_example: 'Organiza datos, mediciones o comparaciones y luego explica qué significan.', teacher_example: 'Revisar consistencia de datos e interpretación.' },
      text('Impacto y participación de la comunidad', 'Explica quiénes participaron, qué cambió y cómo lo comprobaron.', 'Valorar alcance, beneficiarios y evidencia del impacto.'),
      text('Conclusiones y continuidad', 'Responde a los objetivos, reconoce dificultades y propone cómo continuar.', 'Comprobar que las conclusiones se basen en los resultados.'),
      text('Referencias y anexos', 'Incluye fuentes, enlaces, entrevistas y materiales complementarios.', 'Revisar identificación y pertinencia de las fuentes.'),
    ],
  },
  {
    id: 'scientific',
    name: 'Informe científico',
    description: 'Para investigaciones, experimentos, mediciones y análisis de datos.',
    icon: '🔬',
    sections: [
      text('Resumen', 'Resume pregunta, método, resultado principal y conclusión.', 'Revisar que sintetice todo el estudio.'),
      text('Pregunta de investigación e hipótesis', 'Formula la pregunta investigable y la respuesta que esperan comprobar.', 'Verificar que pregunta e hipótesis puedan contrastarse.'),
      text('Fundamento teórico', 'Explica conceptos científicos y cita las fuentes utilizadas.', 'Revisar precisión conceptual y referencias.'),
      text('Variables, materiales y método', 'Define variables, materiales, procedimiento, muestra y controles.', 'Revisar reproducibilidad, seguridad y control de variables.'),
      { section_type: 'table', title: 'Datos y resultados', content: { text: '', table: [['Medición', 'Resultado', 'Unidad'], ['', '', '']] }, student_example: 'Registra datos con unidades. Puedes agregar imágenes o gráficos desde nuevos bloques.', teacher_example: 'Revisar calidad de registros, unidades y organización.' },
      text('Análisis y discusión', 'Interpreta los resultados, identifica patrones, errores y relación con la hipótesis.', 'Evaluar razonamiento basado en evidencia.'),
      text('Conclusiones', 'Responde la pregunta y señala si la evidencia apoya o no la hipótesis.', 'Comprobar relación entre datos y conclusión.'),
      text('Referencias y anexos', 'Agrega bibliografía, fotografías, instrumentos y cálculos.', 'Revisar fuentes y anexos relevantes.'),
    ],
  },
  {
    id: 'community',
    name: 'Intervención comunitaria',
    description: 'Para campañas, mejoras del colegio, espacios verdes y acciones con la comunidad.',
    icon: '🌱',
    sections: [
      text('Diagnóstico inicial', 'Describe la necesidad y cómo la identificaron mediante observación, encuesta o entrevista.', 'Revisar que el diagnóstico tenga evidencia.'),
      text('Objetivos y beneficiarios', 'Indica qué cambiarán, a quiénes beneficiará y cómo medirán el avance.', 'Comprobar metas y beneficiarios claramente definidos.'),
      text('Plan de acción', 'Organiza actividades, responsables, recursos y fechas.', 'Revisar factibilidad y distribución de funciones.'),
      { section_type: 'resources', title: 'Ejecución y evidencias', content: { text: '', resources: [] }, student_example: 'Usa el panel lateral para insertar fotografías, videos, encuestas o páginas ya creadas.', teacher_example: 'Revisar relación entre evidencias y actividades.' },
      { section_type: 'table', title: 'Resultados e indicadores', content: { text: '', table: [['Indicador', 'Meta', 'Resultado'], ['', '', '']] }, student_example: 'Compara las metas con los resultados obtenidos.', teacher_example: 'Evaluar resultados verificables y análisis.' },
      text('Opinión de la comunidad', 'Resume respuestas, comentarios o encuestas de quienes participaron.', 'Revisar representatividad e interpretación.'),
      text('Impacto, dificultades y mejoras', 'Explica cambios logrados, obstáculos y mejoras necesarias.', 'Valorar reflexión crítica y evidencia del impacto.'),
      text('Continuidad del proyecto', 'Indica quién mantendrá la iniciativa, qué recursos necesita y próximos pasos.', 'Evaluar sostenibilidad y compromisos concretos.'),
    ],
  },
]

export function getReportBuilderTemplate(id: string) {
  return REPORT_BUILDER_TEMPLATES.find(template => template.id === id) ?? REPORT_BUILDER_TEMPLATES[0]
}
