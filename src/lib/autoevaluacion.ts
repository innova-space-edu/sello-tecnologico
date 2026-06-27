export type AutoevaluacionQuestionType = 'rating' | 'text' | 'checkbox' | 'single'

export type AutoevaluacionQuestion = {
  id: string
  section: string
  prompt: string
  type: AutoevaluacionQuestionType
  required?: boolean
  options?: string[]
  minLabel?: string
  maxLabel?: string
}

export type AutoevaluacionFormat = {
  id?: string | null
  title: string
  description?: string | null
  questions: AutoevaluacionQuestion[]
}

export const DEFAULT_AUTOEVALUACION_FORMAT_ID = 'default'

export const AUTOEVALUACION_QUESTIONS: AutoevaluacionQuestion[] = [
  {
    id: 'descripcion_proyecto',
    section: 'Descripción del proyecto',
    prompt: 'Describe brevemente la intervención STEAM que realizó tu grupo en el colegio.',
    type: 'text',
    required: true,
  },
  {
    id: 'problema_detectado',
    section: 'Descripción del proyecto',
    prompt: '¿Qué problema o necesidad del colegio intentaron mejorar?',
    type: 'text',
    required: true,
  },
  {
    id: 'evidencias',
    section: 'Seguimiento y mantención',
    prompt: 'Marca las evidencias que tiene tu grupo del seguimiento y mantención.',
    type: 'checkbox',
    required: true,
    options: [
      'Fotos del antes',
      'Fotos del proceso',
      'Fotos del después',
      'Registro escrito o bitácora',
      'Limpieza o mantención del espacio',
      'Revisión de problemas o daños',
      'Charlas o difusión a otros cursos',
      'Mejoras realizadas después de instalar la intervención',
    ],
  },
  {
    id: 'participacion',
    section: 'Autoevaluación individual',
    prompt: 'Participé activamente en la creación y desarrollo del proyecto.',
    type: 'rating',
    required: true,
    minLabel: 'Por mejorar',
    maxLabel: 'Muy logrado',
  },
  {
    id: 'responsabilidad',
    section: 'Autoevaluación individual',
    prompt: 'Cumplí con las tareas y responsabilidades que me correspondían.',
    type: 'rating',
    required: true,
    minLabel: 'Por mejorar',
    maxLabel: 'Muy logrado',
  },
  {
    id: 'colaboracion',
    section: 'Autoevaluación individual',
    prompt: 'Trabajé de forma colaborativa, respetuosa y responsable con mi grupo.',
    type: 'rating',
    required: true,
    minLabel: 'Por mejorar',
    maxLabel: 'Muy logrado',
  },
  {
    id: 'mantencion',
    section: 'Autoevaluación individual',
    prompt: 'Ayudé en el seguimiento, cuidado y mantención de la intervención.',
    type: 'rating',
    required: true,
    minLabel: 'Por mejorar',
    maxLabel: 'Muy logrado',
  },
  {
    id: 'autocritica_personal',
    section: 'Autocrítica',
    prompt: '¿Qué hiciste mal, dejaste incompleto o podrías haber hecho mejor?',
    type: 'text',
    required: true,
  },
  {
    id: 'correccion_personal',
    section: 'Autocrítica',
    prompt: '¿Cómo podrías corregir o mejorar tu aporte personal desde ahora?',
    type: 'text',
    required: true,
  },
  {
    id: 'funcionamiento_proyecto',
    section: 'Evaluación del proyecto',
    prompt: 'El proyecto funciona y aporta realmente al colegio.',
    type: 'rating',
    required: true,
    minLabel: 'Por mejorar',
    maxLabel: 'Muy logrado',
  },
  {
    id: 'uso_comunidad',
    section: 'Evaluación del proyecto',
    prompt: 'Otros estudiantes o integrantes de la comunidad escolar pueden comprender, usar o valorar la intervención.',
    type: 'rating',
    required: true,
    minLabel: 'Por mejorar',
    maxLabel: 'Muy logrado',
  },
  {
    id: 'problema_proyecto',
    section: 'Evaluación del proyecto',
    prompt: '¿Cuál es el principal problema actual del proyecto?',
    type: 'text',
    required: true,
  },
  {
    id: 'decision',
    section: 'Decisión final',
    prompt: 'Después de evaluar el proyecto, ¿qué debería hacer el grupo?',
    type: 'single',
    required: true,
    options: [
      'Continuar con el mismo proyecto',
      'Mantener el proyecto, pero mejorarlo',
      'Cambiar parcialmente la idea',
      'Cambiar completamente el proyecto',
    ],
  },
  {
    id: 'plan_mejora',
    section: 'Decisión final',
    prompt: 'Escribe el plan de mejora o la nueva propuesta concreta para continuar trabajando.',
    type: 'text',
    required: true,
  },
]

export const DEFAULT_AUTOEVALUACION_FORMAT: AutoevaluacionFormat = {
  id: DEFAULT_AUTOEVALUACION_FORMAT_ID,
  title: 'Autoevaluación STEAM',
  description: 'Autoevaluación de seguimiento y mantención para proyectos STEAM, sitios verdes y reciclaje.',
  questions: AUTOEVALUACION_QUESTIONS,
}

export function getAutoevaluacionSections(questions: AutoevaluacionQuestion[] = AUTOEVALUACION_QUESTIONS) {
  return Array.from(new Set(questions.map(question => question.section)))
}

export function getAutoevaluacionQuestionMap(questions: AutoevaluacionQuestion[] = AUTOEVALUACION_QUESTIONS) {
  return new Map(questions.map(question => [question.id, question]))
}

export function getAnswerDisplayValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export function normalizeAutoevaluacionQuestions(rawQuestions: unknown): AutoevaluacionQuestion[] {
  if (!Array.isArray(rawQuestions)) return []

  return rawQuestions.map((raw, index) => {
    const question = raw && typeof raw === 'object' ? raw as Partial<AutoevaluacionQuestion> : {}
    const type = ['rating', 'text', 'checkbox', 'single'].includes(String(question.type))
      ? question.type as AutoevaluacionQuestionType
      : 'text'

    return {
      id: String(question.id || `pregunta_${index + 1}`).trim(),
      section: String(question.section || 'Autoevaluación').trim(),
      prompt: String(question.prompt || `Pregunta ${index + 1}`).trim(),
      type,
      required: Boolean(question.required),
      options: Array.isArray(question.options) ? question.options.map(String).filter(Boolean) : [],
      minLabel: question.minLabel ? String(question.minLabel) : undefined,
      maxLabel: question.maxLabel ? String(question.maxLabel) : undefined,
    }
  }).filter(question => question.id && question.prompt && question.section)
}
