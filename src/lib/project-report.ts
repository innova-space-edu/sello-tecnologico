export type ReportSectionTemplate = {
  section_type: string
  title: string
  content: Record<string, unknown>
  student_example: string
  teacher_example: string
}

export const REPORT_TEMPLATE: ReportSectionTemplate[] = [
  {
    section_type: 'summary',
    title: '1. Resumen del proyecto',
    content: { text: '' },
    student_example: 'Ejemplo: Nuestro proyecto buscó reducir los residuos plásticos del colegio mediante puntos limpios, una campaña informativa y mediciones semanales.',
    teacher_example: 'Revisar que el resumen explique problema, solución, participantes y resultado principal en un texto breve.',
  },
  {
    section_type: 'problem',
    title: '2. Problema o necesidad detectada',
    content: { text: '' },
    student_example: 'Ejemplo: Observamos que en los recreos se acumulaban botellas y envoltorios porque no existían contenedores diferenciados ni información visible.',
    teacher_example: 'Verificar que el problema esté respaldado por observaciones, registros, fotografías, encuestas u otra evidencia.',
  },
  {
    section_type: 'objectives',
    title: '3. Objetivos',
    content: { text: '' },
    student_example: 'Ejemplo: Objetivo general: disminuir los residuos mezclados. Objetivos específicos: instalar tres puntos limpios, informar a los cursos y comparar datos antes y después.',
    teacher_example: 'Comprobar que los objetivos sean claros, medibles y coherentes con las actividades ejecutadas.',
  },
  {
    section_type: 'methodology',
    title: '4. Metodología y organización del equipo',
    content: { text: '' },
    student_example: 'Ejemplo: Dividimos el trabajo en diagnóstico, diseño, implementación y evaluación. Cada integrante asumió una función y registramos avances semanalmente.',
    teacher_example: 'Solicitar que expliquen etapas, responsabilidades, instrumentos, participantes y forma de recopilación de datos.',
  },
  {
    section_type: 'resources',
    title: '5. Evidencias, imágenes y recursos utilizados',
    content: { text: '', resources: [] },
    student_example: 'Ejemplo: Agregar fotografías del proceso, videos, documentos, enlaces y evidencias ya subidas al proyecto desde la biblioteca lateral.',
    teacher_example: 'Evaluar pertinencia, calidad, identificación y relación de cada recurso con el avance descrito.',
  },
  {
    section_type: 'survey',
    title: '6. Encuestas y participación de la comunidad',
    content: { text: '', resources: [] },
    student_example: 'Ejemplo: Respondieron 84 estudiantes. El 72% indicó que usaría los puntos limpios si estuvieran claramente señalizados.',
    teacher_example: 'Revisar tamaño de la muestra, preguntas utilizadas, lectura de resultados y conclusiones justificadas.',
  },
  {
    section_type: 'results',
    title: '7. Resultados y análisis',
    content: { text: '', table: [] },
    student_example: 'Ejemplo: Los residuos separados aumentaron de 12 kg a 31 kg por semana. La mayor mejora se observó después de las charlas.',
    teacher_example: 'Comprobar que distingan resultados de opiniones y que interpreten tablas, gráficos o comparaciones.',
  },
  {
    section_type: 'impact',
    title: '8. Impacto en la comunidad',
    content: { text: '' },
    student_example: 'Ejemplo: Participaron cuatro cursos, se incorporó una rutina de retiro semanal y el centro de estudiantes asumió la continuidad.',
    teacher_example: 'Valorar beneficiarios, cambios observables, alcance, limitaciones y continuidad del proyecto.',
  },
  {
    section_type: 'conclusions',
    title: '9. Conclusiones, dificultades y mejoras',
    content: { text: '' },
    student_example: 'Ejemplo: La solución funcionó, pero faltó señalética en dos sectores. Recomendamos ampliar los puntos y repetir la medición durante otro mes.',
    teacher_example: 'Revisar que las conclusiones respondan a los objetivos y que las mejoras sean realistas y específicas.',
  },
  {
    section_type: 'references',
    title: '10. Referencias y anexos',
    content: { text: '', resources: [] },
    student_example: 'Ejemplo: Indicar fuentes consultadas, entrevistas, documentos, enlaces y materiales anexos.',
    teacher_example: 'Comprobar identificación de fuentes, autoría y relación de los anexos con el informe.',
  },
]

export function calculateChileanGrade(earned: number, total: number, requirement = 60) {
  if (!Number.isFinite(earned) || !Number.isFinite(total) || total <= 0) return 1
  const percentage = Math.max(0, Math.min(100, (earned / total) * 100))
  const grade = percentage <= requirement
    ? 1 + (3 * percentage / requirement)
    : 4 + (3 * (percentage - requirement) / (100 - requirement))
  return Math.max(1, Math.min(7, Math.round(grade * 10) / 10))
}

export const DEFAULT_RUBRIC = [
  { title: 'Definición del problema y objetivos', description: 'Claridad, fundamento y coherencia del desafío.', max_points: 10 },
  { title: 'Metodología y trabajo colaborativo', description: 'Organización, responsabilidades y procedimiento.', max_points: 15 },
  { title: 'Uso de evidencias y recursos', description: 'Calidad y pertinencia de imágenes, videos, documentos y registros.', max_points: 20 },
  { title: 'Encuestas, tablas y análisis de datos', description: 'Uso correcto de información y análisis de resultados.', max_points: 20 },
  { title: 'Resultados e impacto comunitario', description: 'Logros, beneficiarios y cambios observables.', max_points: 20 },
  { title: 'Conclusiones, mejoras y presentación', description: 'Reflexión final, propuestas y calidad del informe.', max_points: 15 },
]
