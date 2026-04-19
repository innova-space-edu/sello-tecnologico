// ─── Tipos del sistema de plantillas y bloques ──────────────────────────────

export type BlockType =
  | 'titulo' | 'subtitulo' | 'texto' | 'tabla' | 'imagen'
  | 'archivo' | 'link' | 'checklist' | 'sesion'
  | 'comentario_docente' | 'bloque_ia' | 'separador'

export type TemplateType = 'proyecto' | 'portafolio' | 'evidencia'
export type DocStatus    = 'borrador' | 'en_progreso' | 'revisión' | 'aprobado' | 'cerrado'
export type PermRole     = 'viewer' | 'commenter' | 'editor' | 'admin'

export interface Template {
  id: string
  name: string
  type: TemplateType
  description?: string
  is_default: boolean
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
  blocks?: TemplateBlock[]
}

export interface TemplateBlock {
  id: string
  template_id: string
  type: BlockType
  label: string
  instructions?: string
  is_required: boolean
  is_visible: boolean
  order_index: number
  config: Record<string, any>
  created_at: string
}

export interface Document {
  id: string
  template_id?: string
  project_id?: string
  group_id?: string
  type: TemplateType
  title: string
  status: DocStatus
  is_shared: boolean
  created_by?: string
  created_at: string
  updated_at: string
  template?: Template
  permissions?: DocumentPermission[]
}

export interface BlockValue {
  id: string
  document_id: string
  block_id: string
  content: Record<string, any>
  edited_by?: string
  edited_at: string
  created_at: string
  profiles?: { full_name: string }
}

export interface DocumentPermission {
  id: string
  document_id: string
  user_id: string
  role: PermRole
  created_at: string
  profiles?: { full_name: string; email: string }
}

export interface BlockHistoryEntry {
  id: string
  document_id: string
  block_id?: string
  block_label?: string
  previous_content?: Record<string, any>
  new_content?: Record<string, any>
  edited_by?: string
  edited_by_name?: string
  edited_at: string
}

export interface PresenceEntry {
  id: string
  document_id: string
  user_id: string
  user_name?: string
  block_id?: string
  block_label?: string
  last_seen: string
}

// ─── Metadatos visuales por tipo de bloque ───────────────────────────────────

export const BLOCK_META: Record<BlockType, { label: string; icon: string; color: string; description: string }> = {
  titulo:             { label: 'Título',             icon: '🔤', color: 'blue',   description: 'Encabezado principal de sección' },
  subtitulo:          { label: 'Subtítulo',          icon: '✏️', color: 'indigo', description: 'Encabezado secundario' },
  texto:              { label: 'Texto',              icon: '📝', color: 'gray',   description: 'Área de texto libre' },
  tabla:              { label: 'Tabla',              icon: '📊', color: 'violet', description: 'Tabla editable por filas y columnas' },
  imagen:             { label: 'Imagen',             icon: '🖼️', color: 'pink',   description: 'Sube o enlaza una imagen' },
  archivo:            { label: 'Archivo',            icon: '📎', color: 'orange', description: 'Adjunta un documento o archivo' },
  link:               { label: 'Enlace',             icon: '🔗', color: 'cyan',   description: 'URL externa: Drive, Canva, YouTube...' },
  checklist:          { label: 'Checklist',          icon: '☑️', color: 'green',  description: 'Lista de ítems marcables' },
  sesion:             { label: 'Sesión',             icon: '📅', color: 'teal',   description: 'Registro completo de una sesión de trabajo' },
  comentario_docente: { label: 'Comentario docente', icon: '👨‍🏫', color: 'amber',  description: 'Retroalimentación del docente' },
  bloque_ia:          { label: 'Bloque IA',          icon: '🤖', color: 'purple', description: 'Documenta el uso de IA en este paso' },
  separador:          { label: 'Separador',          icon: '➖', color: 'gray',   description: 'Línea divisoria visual' },
}

// ─── Colores Tailwind por tipo ────────────────────────────────────────────────
export const BLOCK_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   badge: 'bg-blue-100 text-blue-700' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', badge: 'bg-indigo-100 text-indigo-700' },
  gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   badge: 'bg-gray-100 text-gray-600' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-700' },
  pink:   { bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-800',   badge: 'bg-pink-100 text-pink-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700' },
  cyan:   { bg: 'bg-cyan-50',   border: 'border-cyan-200',   text: 'text-cyan-800',   badge: 'bg-cyan-100 text-cyan-700' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  badge: 'bg-green-100 text-green-700' },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-800',   badge: 'bg-teal-100 text-teal-700' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  badge: 'bg-amber-100 text-amber-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-700' },
}

// ─── Contenido por defecto por tipo ──────────────────────────────────────────
export const defaultBlockContent = (type: BlockType): Record<string, any> => {
  switch (type) {
    case 'titulo':    return { text: '' }
    case 'subtitulo': return { text: '' }
    case 'texto':     return { text: '' }
    case 'link':      return { url: '', label: '' }
    case 'imagen':    return { url: '', alt: '', caption: '' }
    case 'archivo':   return { url: '', name: '', size: '' }
    case 'checklist': return { items: [{ text: '', checked: false }] }
    case 'tabla':     return { headers: ['Columna 1', 'Columna 2'], rows: [['', '']] }
    case 'sesion':    return {
      titulo: '', objetivo: '', actividad: '', evidencia: '',
      reflexion: '', ia_utilizada: '', tiempo_minutos: '',
      autoevaluacion: '', dificultad: '3',
    }
    case 'comentario_docente': return { texto: '', estado: 'pendiente' }
    case 'bloque_ia': return { herramienta: '', como_uso: '', verificacion: '', etica: '' }
    case 'separador': return {}
    default: return {}
  }
}
