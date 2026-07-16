import fs from 'node:fs'

const editorFile = 'src/components/informes/ReportEditorFinal.tsx'
const cardFile = 'src/components/informes/ReportSectionCard.tsx'

let editor = fs.readFileSync(editorFile, 'utf8')
let card = fs.readFileSync(cardFile, 'utf8')

const replaceEditor = (from, to, label) => {
  if (!editor.includes(from)) {
    if (editor.includes(to)) return
    throw new Error(`No se encontró el bloque del editor: ${label}`)
  }
  editor = editor.replace(from, to)
}

replaceEditor(
  "  const addSection = async (sectionType: 'text' | 'table' | 'resources') => {",
  "  const addSection = async (sectionType: 'title' | 'text' | 'table' | 'resources') => {",
  'tipos de bloque',
)

replaceEditor(
`    const content = sectionType === 'table'
      ? { text: '', table: [['Columna 1', 'Columna 2'], ['', '']] }
      : sectionType === 'resources' ? { text: '', resources: [] } : { text: '' }
    const title = sectionType === 'table' ? 'Nueva tabla o cuadro' : sectionType === 'resources' ? 'Nueva sección de recursos' : 'Nueva sección'`,
`    const content = sectionType === 'table'
      ? { text: '', table: [['Columna 1', 'Columna 2'], ['', '']] }
      : sectionType === 'resources' ? { text: '', resources: [] } : { text: '' }
    const title = sectionType === 'title'
      ? 'Nuevo título'
      : sectionType === 'table'
        ? 'Nueva tabla o cuadro'
        : sectionType === 'resources'
          ? 'Imágenes, videos y otros recursos'
          : 'Nueva sección de texto'`,
  'configuración de bloque',
)

if (!editor.includes('const moveSection = async')) {
  replaceEditor(
`  const removeSection = async (id: string) => {`,
`  const moveSection = async (id: string, direction: -1 | 1) => {
    if (!canEdit) return
    const currentIndex = sectionsRef.current.findIndex(section => section.id === id)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sectionsRef.current.length) return
    const next = [...sectionsRef.current]
    const [moved] = next.splice(currentIndex, 1)
    next.splice(targetIndex, 0, moved)
    const reordered = next.map((section, index) => ({ ...section, sort_order: index }))
    setSections(reordered)
    sectionsRef.current = reordered
    const updates = reordered.map(section => supabase.from('project_report_sections').update({ sort_order: section.sort_order, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', section.id))
    const results = await Promise.all(updates)
    const moveError = results.find(result => result.error)?.error
    if (moveError) setError(moveError.message)
  }

  const removeSection = async (id: string) => {`,
    'mover bloques',
  )
}

replaceEditor(
`    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
        <ReportTeamPanel members={members} classmates={classmates} isLeader={isLeader} onlineUserIds={onlineUserIds} onAdd={classmateId => void addMember(classmateId)} onRemove={memberId => void removeMember(memberId)} />
        <ReportResourceLibrary resources={resources} onInsert={insertResource} />
      </div>

      <main className="min-w-0 space-y-4">`,
`    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <main className="min-w-0 space-y-4">`,
  'disposición principal',
)

replaceEditor(
`          <span className="mr-1 self-center text-sm font-bold text-gray-700">Agregar:</span>
          <button type="button" onClick={() => void addSection('text')} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">+ Sección de texto</button>
          <button type="button" onClick={() => void addSection('table')} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100">+ Tabla o cuadro</button>
          <button type="button" onClick={() => void addSection('resources')} className="rounded-lg bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100">+ Imágenes, videos o encuestas</button>`,
`          <span className="mr-1 self-center text-sm font-bold text-gray-700">Agregar bloque:</span>
          <button type="button" onClick={() => void addSection('title')} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200">+ Título</button>
          <button type="button" onClick={() => void addSection('text')} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">+ Texto</button>
          <button type="button" onClick={() => void addSection('table')} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100">+ Tabla</button>
          <button type="button" onClick={() => void addSection('resources')} className="rounded-lg bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100">+ Recursos</button>`,
  'barra de bloques',
)

replaceEditor(
`          onRemove={() => void removeSection(section.id)}
        />)}`,
`          onMoveUp={index > 0 ? () => void moveSection(section.id, -1) : undefined}
          onMoveDown={index < sections.length - 1 ? () => void moveSection(section.id, 1) : undefined}
          onRemove={() => void removeSection(section.id)}
        />)}`,
  'controles de orden',
)

replaceEditor(
`      <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
        {activeSection && <section`,
`      <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
        <details className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" open>
          <summary className="cursor-pointer font-bold text-blue-900">👥 Integrantes del informe</summary>
          <div className="mt-4"><ReportTeamPanel members={members} classmates={classmates} isLeader={isLeader} onlineUserIds={onlineUserIds} onAdd={classmateId => void addMember(classmateId)} onRemove={memberId => void removeMember(memberId)} /></div>
        </details>
        <details className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer font-bold text-blue-900">📚 Información adicional del proyecto</summary>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">Este contenido es opcional. Selecciona una sección del informe y agrega solo la información que el grupo quiera utilizar.</p>
          <div className="mt-4"><ReportResourceLibrary resources={resources} onInsert={insertResource} /></div>
        </details>
        {activeSection && <section`,
  'panel lateral opcional',
)

const replaceCard = (from, to, label) => {
  if (!card.includes(from)) {
    if (card.includes(to)) return
    throw new Error(`No se encontró el bloque de tarjeta: ${label}`)
  }
  card = card.replace(from, to)
}

replaceCard(
`  onResolveComment: (id: string) => void
  onRemove?: () => void`,
`  onResolveComment: (id: string) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void`,
  'props de movimiento',
)

replaceCard(
`export default function ReportSectionCard({ section, index, active, canEdit, isStaff, comments, commentValue, onActivate, onChange, onCommentChange, onAddComment, onResolveComment, onRemove }: Props) {`,
`export default function ReportSectionCard({ section, index, active, canEdit, isStaff, comments, commentValue, onActivate, onChange, onCommentChange, onAddComment, onResolveComment, onMoveUp, onMoveDown, onRemove }: Props) {`,
  'firma de tarjeta',
)

replaceCard(
`      {canEdit && onRemove && <button type="button" onClick={event => { event.stopPropagation(); onRemove() }} className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Eliminar sección</button>}`,
`      {canEdit && <div className="flex items-center gap-1">
        {onMoveUp && <button type="button" onClick={event => { event.stopPropagation(); onMoveUp() }} className="rounded-lg px-2.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100" title="Mover hacia arriba">↑</button>}
        {onMoveDown && <button type="button" onClick={event => { event.stopPropagation(); onMoveDown() }} className="rounded-lg px-2.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100" title="Mover hacia abajo">↓</button>}
        {onRemove && <button type="button" onClick={event => { event.stopPropagation(); onRemove() }} className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Eliminar</button>}
      </div>}`,
  'botones de bloque',
)

replaceCard(
`      {canEdit ? <textarea value={String(content.text ?? '')} onChange={event => onChange({ content: { ...content, text: event.target.value } })} rows={section.section_type === 'summary' ? 5 : 8} placeholder="Escribe aquí el contenido de esta sección…" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-300" />`,
`      {canEdit ? <textarea value={String(content.text ?? '')} onChange={event => onChange({ content: { ...content, text: event.target.value } })} rows={section.section_type === 'title' ? 3 : section.section_type === 'summary' ? 5 : 8} placeholder={section.section_type === 'title' ? 'Escribe el título, subtítulo o encabezado…' : 'Escribe aquí el contenido de esta sección…'} className={\`w-full rounded-xl border border-gray-200 px-4 py-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-300 \${section.section_type === 'title' ? 'text-xl font-bold' : 'text-sm'}\`} />`,
  'bloque de título',
)

fs.writeFileSync(editorFile, editor)
fs.writeFileSync(cardFile, card)
