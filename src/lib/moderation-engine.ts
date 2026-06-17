export type ModerationSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical'
export type ModerationAction =
  | 'allow'
  | 'flag_and_send'
  | 'hold_for_review'
  | 'block_user'

export type ModerationCategory =
  | 'safe'
  | 'romance_contact'
  | 'bullying'
  | 'violence'
  | 'sexual'
  | 'sexual_solicitation'
  | 'drugs'
  | 'self_harm'
  | 'discrimination'
  | 'profanity'

export type ModerationMatch = {
  category: ModerationCategory
  severity: ModerationSeverity
  label: string
  evidence: string
  reason: string
}

export type ModerationResult = {
  normalized: string
  tokens: string[]
  category: ModerationCategory
  severity: ModerationSeverity
  action: ModerationAction
  confidence: number
  matchedWords: string[]
  matches: ModerationMatch[]
  safeContext: boolean
  warning?: string
}

const ENGINE_VERSION = 'moderation-engine-v2.0.0'

const SAFE_CONTEXT_PHRASES = [
  'sexto', 'sexta', 'sexto basico', 'sexto básico', 'sexto ano', 'sexto año',
  'educacion sexual', 'educación sexual', 'sexualidad', 'reproduccion sexual',
  'reproducción sexual', 'sal de mesa', 'agua con sal', 'coca cola', 'coca-cola',
]

const DRUG_CONTEXT = [
  'vendo', 'vender', 'comprar', 'compro', 'consumir', 'consumo', 'fumar', 'fumemos',
  'drogar', 'drogarse', 'probar', 'probarla', 'traer', 'llevar', 'pasar', 'pásame',
  'pasame', 'gramo', 'gramos', 'bolsa', 'polvo', 'linea', 'línea', 'dealer',
]

const RULES: Array<{
  category: ModerationCategory
  severity: ModerationSeverity
  label: string
  phrases?: string[]
  words?: string[]
  fuzzy?: string[]
  requiresContext?: string[]
  reason: string
}> = [
  {
    category: 'sexual_solicitation',
    severity: 'critical',
    label: 'solicitud sexual o imagen íntima',
    phrases: [
      'mandame foto desnuda', 'mándame foto desnuda', 'manda foto desnuda',
      'foto desnuda', 'foto desnudo', 'manda pack', 'mandame pack', 'pasa pack',
      'quiero tocarte', 'quiero manosearte', 'te voy a manosear',
    ],
    reason: 'Solicitud sexual, imagen íntima o contacto sexual explícito.',
  },
  {
    category: 'sexual',
    severity: 'high',
    label: 'contenido sexual explícito',
    words: [
      'porno', 'pornografia', 'pornografía', 'desnudo', 'desnuda', 'masturbacion',
      'masturbación', 'orgasmo', 'eyaculacion', 'eyaculación', 'vagina', 'pene',
      'tetas', 'culear',
    ],
    fuzzy: ['porno', 'pene', 'vagina', 'tetas'],
    reason: 'Contenido sexual explícito o no apropiado para mensajería escolar.',
  },
  {
    category: 'violence',
    severity: 'critical',
    label: 'amenaza grave',
    phrases: [
      'te voy a matar', 'te mato', 'te voy a pegar', 'te voy a golpear',
      'te voy a romper', 'te voy a apuñalar', 'te voy a apunalar',
      'se donde vives', 'sé donde vives', 'te voy a buscar', 'te voy a encontrar',
      'vas a ver', 'ya vas a ver',
    ],
    reason: 'Amenaza directa o posible riesgo físico.',
  },
  {
    category: 'self_harm',
    severity: 'critical',
    label: 'autolesión o ideación suicida',
    phrases: [
      'me quiero morir', 'quiero morir', 'quiero matarme', 'me voy a matar',
      'voy a matarme', 'no quiero vivir', 'me corto', 'quiero cortarme',
      'nadie me va a extrañar', 'es mejor que muera',
    ],
    reason: 'Posible riesgo de autolesión. Requiere revisión humana urgente sin castigar automáticamente.',
  },
  {
    category: 'drugs',
    severity: 'high',
    label: 'drogas o sustancias',
    words: [
      'marihuana', 'cocaina', 'cocaína', 'porro', 'porros', 'tussi', 'tuci',
      'ketamina', 'keta', 'mdma', 'extasis', 'éxtasis', 'metanfetamina',
      'heroina', 'heroína', 'merca', 'perico', 'farlopa', 'falopa', 'pasta',
      'xanax', 'clonazepam', 'tramadol',
    ],
    fuzzy: ['marihuana', 'cocaina', 'tussi', 'ketamina', 'clonazepam'],
    reason: 'Mención de drogas o sustancias posiblemente asociadas a consumo, venta o distribución.',
  },
  {
    category: 'drugs',
    severity: 'medium',
    label: 'posible jerga de droga con contexto',
    words: ['coca', 'pastillas', 'polvo', 'cristal'],
    requiresContext: DRUG_CONTEXT,
    reason: 'Palabra ambigua detectada junto a contexto de compra, venta o consumo.',
  },
  {
    category: 'bullying',
    severity: 'high',
    label: 'acoso o bullying',
    phrases: [
      'nadie te quiere', 'todos te odian', 'me das asco', 'eres una basura',
      'eres un fracaso', 'desaparece', 'vete de aqui', 'vete de aquí',
    ],
    reason: 'Frase de hostigamiento, humillación o acoso.',
  },
  {
    category: 'profanity',
    severity: 'medium',
    label: 'insulto o garabato',
    words: [
      'idiota', 'imbecil', 'imbécil', 'estupido', 'estúpido', 'estupida',
      'estúpida', 'weon', 'weona', 'hueon', 'huevon', 'culiao', 'culia',
      'ctm', 'csm', 'maricon', 'maricón', 'marica', 'mierda',
    ],
    fuzzy: ['weon', 'huevon', 'culiao', 'imbecil'],
    reason: 'Insulto o lenguaje ofensivo.',
  },
  {
    category: 'discrimination',
    severity: 'high',
    label: 'discriminación',
    phrases: [
      'negro de mierda', 'india de mierda', 'maricon de mierda', 'maricón de mierda',
      'gorda asquerosa', 'gordo asqueroso',
    ],
    reason: 'Ataque discriminatorio o denigrante.',
  },
  {
    category: 'romance_contact',
    severity: 'low',
    label: 'contacto romántico',
    phrases: [
      'te amo', 'me gustas', 'quiero estar contigo', 'seamos novios',
      'quieres ser mi novia', 'quieres ser mi novio', 'sal conmigo',
    ],
    reason: 'Contacto romántico no adecuado para mensajería institucional; no debe bloquear automáticamente.',
  },
]

export function normalizeForModeration(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/([a-zñ])\1{2,}/g, '$1$1')
    .replace(/[^a-zñ0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(normalized: string) {
  return normalized.match(/[a-zñ0-9]+/g) ?? []
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasPhrase(normalized: string, phrase: string) {
  const normalizedPhrase = normalizeForModeration(phrase)
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(normalizedPhrase)}(\\s|$)`, 'i')
  return pattern.test(normalized)
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[a.length][b.length]
}

function fuzzyTokenMatch(tokens: string[], target: string) {
  const normalizedTarget = normalizeForModeration(target)
  if (normalizedTarget.length < 5) return null

  for (const token of tokens) {
    if (Math.abs(token.length - normalizedTarget.length) > 1) continue
    const distance = levenshtein(token, normalizedTarget)
    if (distance <= 1) return token
  }

  return null
}

function hasAnyContext(tokens: string[], phrases: string[], normalized: string) {
  return phrases.some(context => {
    const norm = normalizeForModeration(context)
    return tokens.includes(norm) || hasPhrase(normalized, norm)
  })
}

function isSafeContext(raw: string, normalized: string) {
  const safePhrase = SAFE_CONTEXT_PHRASES.some(phrase => hasPhrase(normalized, phrase))
  if (safePhrase) return true

  // Evita falsos positivos por palabras escolares como sexto, sexta, sexagesimal.
  const tokens = tokenize(normalized)
  if (tokens.some(token => ['sexto', 'sexta', 'sexagesimal'].includes(token))) return true

  return false
}

function severityRank(severity: ModerationSeverity) {
  return { none: 0, low: 1, medium: 2, high: 3, critical: 4 }[severity]
}

function pickAction(category: ModerationCategory, severity: ModerationSeverity): ModerationAction {
  if (category === 'self_harm') return 'hold_for_review'
  if (severity === 'critical') return 'block_user'
  if (severity === 'high') return 'hold_for_review'
  if (severity === 'medium') return 'flag_and_send'
  return 'allow'
}

export function analyzeMessageContent(raw: string): ModerationResult {
  const normalized = normalizeForModeration(raw)
  const tokens = tokenize(normalized)
  const matches: ModerationMatch[] = []
  const safeContext = isSafeContext(raw, normalized)

  if (!normalized || safeContext) {
    return {
      normalized,
      tokens,
      category: 'safe',
      severity: 'none',
      action: 'allow',
      confidence: safeContext ? 0.05 : 0,
      matchedWords: [],
      matches: [],
      safeContext,
    }
  }

  for (const rule of RULES) {
    const requiresContext = rule.requiresContext?.length
      ? hasAnyContext(tokens, rule.requiresContext, normalized)
      : true

    if (!requiresContext) continue

    for (const phrase of rule.phrases ?? []) {
      if (hasPhrase(normalized, phrase)) {
        matches.push({
          category: rule.category,
          severity: rule.severity,
          label: rule.label,
          evidence: phrase,
          reason: rule.reason,
        })
      }
    }

    for (const word of rule.words ?? []) {
      const normalizedWord = normalizeForModeration(word)
      if (tokens.includes(normalizedWord)) {
        matches.push({
          category: rule.category,
          severity: rule.severity,
          label: rule.label,
          evidence: word,
          reason: rule.reason,
        })
      }
    }

    for (const word of rule.fuzzy ?? []) {
      const hit = fuzzyTokenMatch(tokens, word)
      if (hit) {
        matches.push({
          category: rule.category,
          severity: rule.severity,
          label: `${rule.label} (posible escritura alterada)`,
          evidence: hit,
          reason: rule.reason,
        })
      }
    }
  }

  if (matches.length === 0) {
    return {
      normalized,
      tokens,
      category: 'safe',
      severity: 'none',
      action: 'allow',
      confidence: 0,
      matchedWords: [],
      matches: [],
      safeContext,
    }
  }

  const strongest = [...matches].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]
  const confidence = Math.min(0.98, 0.55 + matches.length * 0.12 + severityRank(strongest.severity) * 0.08)
  const action = pickAction(strongest.category, strongest.severity)

  return {
    normalized,
    tokens,
    category: strongest.category,
    severity: strongest.severity,
    action,
    confidence,
    matchedWords: Array.from(new Set(matches.map(match => match.evidence))),
    matches,
    safeContext,
    warning:
      action === 'block_user'
        ? 'Mensaje bloqueado por riesgo crítico. El caso fue enviado a administración.'
        : action === 'hold_for_review'
          ? 'Mensaje retenido para revisión de convivencia escolar.'
          : action === 'flag_and_send'
            ? 'Mensaje enviado, pero marcado para revisión preventiva.'
            : undefined,
  }
}

export function moderationEngineVersion() {
  return ENGINE_VERSION
}
