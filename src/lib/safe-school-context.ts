export function normalizeSchoolText(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isSchoolWorkContext(raw: string) {
  const text = normalizeSchoolText(raw)
  if (!text) return false

  const hasSchoolWork = ['trabajo', 'proyecto', 'informe', 'actividad', 'evidencia', 'clase', 'curso', 'colegio', 'sala', 'salas']
    .some(word => text.includes(word))

  const hasEnergyTopic = ['energia', 'energetico', 'electrico', 'computador', 'data', 'proyector', 'ventilador', 'hervidor', 'television', 'celular', 'cargador']
    .some(word => text.includes(word))

  const hasShareFile = ['archivo', 'adjunto', 'material', 'documento', 'presentacion', 'pdf']
    .some(word => text.includes(word))

  return (hasSchoolWork && hasEnergyTopic) || (hasSchoolWork && hasShareFile)
}
