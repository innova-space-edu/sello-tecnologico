export const ARCHIVE_CATEGORIES = [
  { key: 'todos', label: 'Todo el archivo', icon: '🗂️' },
  { key: 'proyectos', label: 'Proyectos', icon: '📁' },
  { key: 'evidencias', label: 'Evidencias', icon: '📎' },
  { key: 'informes', label: 'Informes', icon: '📄' },
  { key: 'seguimientos', label: 'Seguimientos', icon: '🧭' },
  { key: 'paginas', label: 'Páginas', icon: '🌐' },
  { key: 'espacio_creativo', label: 'Espacio creativo', icon: '🎨' },
  { key: 'encuestas', label: 'Encuestas', icon: '🗳️' },
  { key: 'autoevaluaciones', label: 'Autoevaluaciones', icon: '🌱' },
  { key: 'documentos', label: 'Documentos', icon: '📄' },
  { key: 'steam', label: 'Proyectos STEAM', icon: '🧩' },
  { key: 'historias', label: 'Historias', icon: '📸' },
  { key: 'portafolio', label: 'Secciones propias', icon: '📒' },
  { key: 'reportes', label: 'Reportes', icon: '📊' },
] as const

export const isArchiveCategory = (value: string) =>
  ARCHIVE_CATEGORIES.some(category => category.key === value)

