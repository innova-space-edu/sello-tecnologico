import Link from 'next/link'

const HIDDEN_KEYS = new Set([
  'id', 'project_id', 'portfolio_id', 'workspace_id', 'response_id', 'survey_id',
  'question_id', 'user_id', 'created_by', 'updated_by', 'owner_id', 'course_id',
  'group_id', 'report_id', 'page_id', 'evaluation_id', 'rubric_id', 'sort_order',
  'created_at', 'updated_at', 'captured_at', 'source_created_at',
])

const DEFAULT_VALUES = new Set(['pendiente', 'pending', 'sin iniciar', 'not_started'])

const FIELD_LABELS: Record<string, string> = {
  text: 'Contenido', resources: 'Recursos', title: 'Título', description: 'Descripción',
  status: 'Estado', activa: 'Activa', active: 'Activa', completada: 'Completada', completed: 'Completada',
  fecha_inicio: 'Fecha de inicio', fecha_fin: 'Fecha de cierre', responsable: 'Responsable',
  num_sesiones: 'Número de sesiones', duracion_sesion: 'Duración de cada sesión',
  observaciones: 'Observaciones', lecciones: 'Lecciones aprendidas', continuidad: 'Continuidad',
  difusion: 'Difusión', entregables: 'Entregables', evidencias_esperadas: 'Evidencias esperadas',
  reflexion_equipo: 'Reflexión del equipo', tipo_presentacion: 'Tipo de presentación',
  revision_diseno: 'Revisión del diseño', criterios_diseno: 'Criterios de diseño',
  teacher_comment: 'Comentario docente', student_reflection: 'Reflexión del estudiante',
  work_done: 'Trabajo realizado', problem_found: 'Problema encontrado', next_step: 'Siguiente paso',
  file_url: 'Archivo', drive_url: 'Enlace de Drive', url: 'Enlace', body: 'Comentario',
  member_role: 'Rol', nombre: 'Nombre', rol: 'Rol', autor: 'Autor', comentario: 'Comentario',
}

function labelFor(key: string) {
  return FIELD_LABELS[key] ?? key
    .replaceAll('_', ' ')
    .replace(/^./, letter => letter.toUpperCase())
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

export function hasPortfolioContent(value: unknown, allowDefault = false): boolean {
  if (value === null || value === undefined || value === '') return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return true
  if (typeof value === 'string') return allowDefault || !DEFAULT_VALUES.has(value.trim().toLowerCase())
  if (Array.isArray(value)) return value.some(item => hasPortfolioContent(item, allowDefault))
  if (typeof value !== 'object') return true

  const record = value as Record<string, unknown>
  const inactive = record.activa === false || record.active === false
  const entries = Object.entries(record).filter(([key]) => !HIDDEN_KEYS.has(key) && key !== 'activa' && key !== 'active')
  const meaningful = entries.some(([key, entry]) => {
    if (key === 'status' || key === 'estado') return hasPortfolioContent(entry, !inactive)
    return hasPortfolioContent(entry)
  })
  return inactive ? meaningful : meaningful || Object.keys(record).length > 0
}

function LinkValue({ href }: { href: string }) {
  const isImage = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(href)
  if (isImage) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {/* Las evidencias pueden venir desde Storage o Drive, con dominios variables. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt="Evidencia del portafolio" className="max-h-80 w-full object-contain transition group-hover:scale-[1.01]" />
      </a>
    )
  }
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 break-all rounded-full bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">🔗 Abrir recurso</a>
}

interface PortfolioValueProps {
  value: unknown
  depth?: number
  emptyLabel?: string
}

export default function PortfolioValue({ value, depth = 0, emptyLabel = 'Aún sin contenido' }: PortfolioValueProps) {
  if (!hasPortfolioContent(value, true)) return <span className="text-sm italic text-slate-400">{emptyLabel}</span>
  if (typeof value === 'boolean') return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${value ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{value ? 'Sí' : 'No'}</span>
  if (typeof value === 'number') return <span className="font-semibold text-slate-800">{value}</span>
  if (typeof value === 'string') {
    if (isUrl(value)) return <LinkValue href={value} />
    return <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{value}</p>
  }

  if (Array.isArray(value)) {
    const items = value.filter(item => hasPortfolioContent(item, true))
    if (!items.length) return <span className="text-sm italic text-slate-400">{emptyLabel}</span>
    if (items.every(item => ['string', 'number'].includes(typeof item))) {
      return <div className="flex flex-wrap gap-2">{items.map((item, index) => <span key={`${String(item)}-${index}`} className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-100">{String(item)}</span>)}</div>
    }
    return <div className="grid gap-3 sm:grid-cols-2">{items.map((item, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><PortfolioValue value={item} depth={depth + 1} /></div>)}</div>
  }

  const record = value as Record<string, unknown>
  if (typeof record.text === 'string') {
    const resources = Array.isArray(record.resources) ? record.resources : []
    return <div className="space-y-3"><PortfolioValue value={record.text} />{resources.length > 0 && <PortfolioValue value={resources} depth={depth + 1} />}</div>
  }

  const entries = Object.entries(record).filter(([key, entry]) => !HIDDEN_KEYS.has(key) && hasPortfolioContent(entry, true))
  if (!entries.length) return <span className="text-sm italic text-slate-400">{emptyLabel}</span>

  return (
    <div className={depth > 1 ? 'space-y-3' : 'grid gap-3 md:grid-cols-2'}>
      {entries.map(([key, entry]) => (
        <div key={key} className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
          <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{labelFor(key)}</p>
          <PortfolioValue value={entry} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

export function PortfolioField({ label, value, accent = 'violet' }: { label: string; value: unknown; accent?: 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' }) {
  if (!hasPortfolioContent(value, true)) return null
  const accents = {
    violet: 'from-violet-500 to-fuchsia-500', blue: 'from-blue-500 to-cyan-500',
    emerald: 'from-emerald-500 to-teal-500', amber: 'from-amber-400 to-orange-500', rose: 'from-rose-500 to-pink-500',
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${accents[accent]}`} />
      <p className="mb-2 pl-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <div className="pl-1"><PortfolioValue value={value} /></div>
    </div>
  )
}

export function PortfolioEmpty({ icon, title, description }: { icon: string; title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center"><div className="text-4xl grayscale opacity-60">{icon}</div><p className="mt-3 font-bold text-slate-700">{title}</p><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-400">{description}</p></div>
}

export function PortfolioAction({ href, children }: { href: string; children: React.ReactNode }) {
  const external = /^https?:\/\//.test(href)
  const className = 'inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-700'
  if (external) return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>
  return <Link href={href} className={className}>{children}</Link>
}
