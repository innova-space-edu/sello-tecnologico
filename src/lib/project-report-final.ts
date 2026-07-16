export const REPORT_GRADE_REQUIREMENT = 60

export function calculateChileanGrade(earned: number, total: number, requirement = REPORT_GRADE_REQUIREMENT) {
  if (!Number.isFinite(earned) || !Number.isFinite(total) || total <= 0) return 1
  const percentage = Math.max(0, Math.min(100, (earned / total) * 100))

  if (percentage < requirement) {
    const raw = 1 + (3 * percentage / requirement)
    return Math.min(3.9, Math.max(1, Math.round(raw * 10) / 10))
  }
  if (percentage === requirement) return 4

  const raw = 4 + (3 * (percentage - requirement) / (100 - requirement))
  return Math.min(7, Math.max(4, Math.round(raw * 10) / 10))
}

export const DEFAULT_REPORT_RUBRIC = [
  {
    title: 'Definición del problema y objetivos',
    description: 'Claridad, fundamento y coherencia del desafío y sus objetivos.',
    max_points: 10,
    student_example: 'Explica el problema con datos u observaciones y formula objetivos medibles.',
    teacher_example: 'Verificar coherencia entre problema, objetivos y necesidades detectadas.',
  },
  {
    title: 'Metodología y trabajo colaborativo',
    description: 'Organización del equipo, procedimiento, responsabilidades y seguimiento.',
    max_points: 15,
    student_example: 'Describe las etapas, tareas de cada integrante y cómo registraron los avances.',
    teacher_example: 'Considerar organización, cumplimiento de funciones y participación del equipo.',
  },
  {
    title: 'Uso de evidencias y recursos',
    description: 'Calidad y pertinencia de imágenes, videos, documentos, páginas y registros.',
    max_points: 20,
    student_example: 'Incluye evidencias identificadas y explica qué demuestra cada una.',
    teacher_example: 'Evaluar que los recursos respalden el proceso y no sean solo decorativos.',
  },
  {
    title: 'Encuestas, tablas y análisis de datos',
    description: 'Uso correcto de encuestas, tablas, gráficos e interpretación de resultados.',
    max_points: 20,
    student_example: 'Indica participantes, resultados principales y qué significan para el proyecto.',
    teacher_example: 'Revisar muestra, lectura de datos, comparaciones y conclusiones respaldadas.',
  },
  {
    title: 'Resultados e impacto comunitario',
    description: 'Logros, beneficiarios, cambios observables, alcance y continuidad.',
    max_points: 20,
    student_example: 'Compara la situación inicial y final, e identifica beneficiarios y cambios.',
    teacher_example: 'Valorar resultados verificables, alcance real y posibilidades de continuidad.',
  },
  {
    title: 'Conclusiones, mejoras y presentación',
    description: 'Reflexión final, propuestas de mejora, referencias y calidad del informe.',
    max_points: 15,
    student_example: 'Responde los objetivos, reconoce dificultades y propone mejoras específicas.',
    teacher_example: 'Revisar coherencia final, redacción, presentación, fuentes y propuestas.',
  },
] as const
