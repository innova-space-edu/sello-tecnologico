export type ModerationSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical'
export type ModerationAction = 'allow' | 'flag_and_send' | 'hold_for_review' | 'block_user'
export type ModerationCategory =
  | 'safe'
  | 'romance_contact'
  | 'bullying'
  | 'exclusion'
  | 'violence'
  | 'sexual'
  | 'sexual_solicitation'
  | 'drugs'
  | 'self_harm'
  | 'discrimination'
  | 'privacy_risk'
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

const ENGINE_VERSION = 'moderation-engine-v2.3.0-estudiantes'

const SAFE_CONTEXT_PHRASES = [
  'sexto', 'sexta', 'sexto basico', 'sexto básico', 'sexto ano', 'sexto año',
  'educacion sexual', 'educación sexual', 'sexualidad', 'reproduccion sexual',
  'reproducción sexual', 'sal de mesa', 'agua con sal', 'coca cola', 'coca-cola', 'coka cola',
]

const DRUG_CONTEXT = ['vendo', 'vender', 'comprar', 'compro', 'consumir', 'consumo', 'fumar', 'fumemos', 'drogar', 'drogarse', 'probar', 'traer', 'llevar', 'pasar', 'pasame', 'gramo', 'gramos', 'bolsa', 'polvo', 'linea', 'dealer']
const INSULT_CONTEXT = ['cara', 'puro', 'pura', 'eres', 'erai', 'soy', 'soi', 'te', 'tu', 'vo', 'vos', 'wn', 'weon', 'qlo', 'culiao']

type Rule = {
  category: ModerationCategory
  severity: ModerationSeverity
  label: string
  phrases?: string[]
  rawPhrases?: string[]
  words?: string[]
  fuzzy?: string[]
  requiresContext?: string[]
  reason: string
}

const RULES: Rule[] = [
  {
    category: 'sexual_solicitation',
    severity: 'critical',
    label: 'solicitud sexual o imagen intima',
    phrases: ['mandame foto desnuda', 'manda foto desnuda', 'foto desnuda', 'manda pack', 'mandame pack', 'pasa pack', 'quiero tocarte', 'quiero manosearte', 'te voy a manosear'],
    reason: 'Solicitud sexual, imagen intima o contacto sexual explicito.',
  },
  {
    category: 'sexual',
    severity: 'high',
    label: 'connotacion sexual contra otra persona',
    phrases: ['te meti los dedos', 'te metimlos deo', 'te meti los deo', 'cierra el papoi', 'yo si le doy a', 'le doy to', 'te paso por donde', 'te paso por donde vosai', 'soñe que te besaba', 'sone que te besaba'],
    rawPhrases: ['למצוץ את הפין שלי'],
    reason: 'Mensaje con contenido sexual, insinuacion sexual o ataque sexualizado.',
  },
  {
    category: 'sexual',
    severity: 'medium',
    label: 'lenguaje sexual o vulgar',
    words: ['porno', 'pornografia', 'desnudo', 'desnuda', 'masturbacion', 'orgasmo', 'eyaculacion', 'vagina', 'pene', 'tetas', 'culear', 'pinga', 'shota'],
    phrases: ['cara de pinga'],
    fuzzy: ['porno', 'pene', 'vagina', 'pinga'],
    reason: 'Lenguaje sexual o vulgar no apropiado para mensajeria escolar.',
  },
  {
    category: 'privacy_risk',
    severity: 'high',
    label: 'doxeo o exposicion de datos',
    words: ['dox', 'doxeo', 'doxeado', 'doxear', 'doxearte'],
    phrases: ['te voy a doxear', 'estas doxeado', 'quedaste doxeado'],
    fuzzy: ['doxeado', 'doxear'],
    reason: 'Posible amenaza de exposicion de datos personales o intimidacion digital.',
  },
  {
    category: 'violence',
    severity: 'critical',
    label: 'amenaza grave',
    phrases: ['te voy a matar', 'te mato', 'te voy a pegar', 'te voy a golpear', 'te voy a romper', 'te voy a apuñalar', 'te voy a apunalar', 'se donde vives', 'te voy a buscar', 'te voy a encontrar', 'vas a ver', 'ya vas a ver'],
    reason: 'Amenaza directa o posible riesgo fisico.',
  },
  {
    category: 'self_harm',
    severity: 'critical',
    label: 'autolesion o ideacion suicida',
    phrases: ['me quiero morir', 'quiero morir', 'quiero matarme', 'me voy a matar', 'voy a matarme', 'no quiero vivir', 'me corto', 'quiero cortarme', 'nadie me va a extrañar', 'es mejor que muera'],
    reason: 'Posible riesgo de autolesion. Requiere revision humana urgente sin castigar automaticamente.',
  },
  {
    category: 'drugs',
    severity: 'high',
    label: 'drogas o sustancias',
    words: ['marihuana', 'cocaina', 'porro', 'porros', 'tussi', 'tuci', 'ketamina', 'keta', 'mdma', 'extasis', 'metanfetamina', 'heroina', 'merca', 'perico', 'farlopa', 'falopa', 'xanax', 'clonazepam', 'tramadol'],
    fuzzy: ['marihuana', 'cocaina', 'tussi', 'ketamina', 'clonazepam'],
    reason: 'Mencion de drogas o sustancias posiblemente asociadas a consumo, venta o distribucion.',
  },
  {
    category: 'drugs',
    severity: 'medium',
    label: 'posible jerga de droga con contexto',
    words: ['coca', 'coka', 'pastillas', 'polvo', 'cristal', 'pasta'],
    requiresContext: DRUG_CONTEXT,
    reason: 'Palabra ambigua detectada junto a contexto de compra, venta o consumo.',
  },
  {
    category: 'discrimination',
    severity: 'high',
    label: 'discriminacion o ataque identitario',
    phrases: ['negro de mierda', 'india de mierda', 'maricon de mierda', 'maricon qlo', 'gorda asquerosa', 'gordo asqueroso', 'berguensa peruana', 'verguenza peruana', 'peruana de mierda', 'tu mama transvestitica'],
    rawPhrases: ['אמא שלך טרנסווסטיטית'],
    words: ['nigga', 'traba'],
    fuzzy: ['maricon', 'nigga'],
    reason: 'Ataque discriminatorio, xenofobo, racista, homofobico o transfobico.',
  },
  {
    category: 'discrimination',
    severity: 'medium',
    label: 'identidad usada como insulto',
    words: ['gay'],
    requiresContext: INSULT_CONTEXT,
    reason: 'Uso de identidad u orientacion como insulto o burla.',
  },
  {
    category: 'exclusion',
    severity: 'high',
    label: 'exclusion o intimidacion social',
    phrases: ['a callar o te saco de mi grupo', 'te saco de mi grupo', 'no me hables', 'dejame en paz acosadora'],
    reason: 'Exclusion, presion social o intimidacion dentro de grupos de trabajo.',
  },
  {
    category: 'bullying',
    severity: 'high',
    label: 'hostigamiento o humillacion',
    phrases: ['nadie te quiere', 'todos te odian', 'me das asco', 'eres una basura', 'eres un fracaso', 'desaparece', 'vete de aqui', 'vete de aquí', 'te paseo', 'te meo', 'te paseo longi', 'te meo longi', 'pendeja culera', 'fucking ramera'],
    reason: 'Frase de hostigamiento, humillacion, vejacion o acoso.',
  },
  {
    category: 'profanity',
    severity: 'medium',
    label: 'insulto o garabato escolar',
    phrases: ['queate callao sapo', 'quedate callado sapo', 'ke pasa psao kka', 'su kk', 'pura gila', 'puro terry', 'cara de pescao'],
    words: ['idiota', 'imbecil', 'estupido', 'estupida', 'weon', 'weona', 'hueon', 'huevon', 'culiao', 'culia', 'ctm', 'csm', 'maricon', 'marica', 'mierda', 'sapo', 'tonta', 'tonto', 'feo', 'fea', 'longi', 'loji', 'torpe', 'vomi', 'perkin', 'pesao', 'gila', 'gil', 'culera', 'ramera', 'mojon', 'nub', 'nubb', 'noob', 'primate'],
    fuzzy: ['weon', 'huevon', 'culiao', 'imbecil', 'longi', 'loji', 'perkin'],
    reason: 'Insulto, burla o lenguaje ofensivo usado por estudiantes.',
  },
  {
    category: 'bullying',
    severity: 'medium',
    label: 'orden agresiva o burla directa',
    phrases: ['callate', 'callao', 'callar', 'cierra la boca', 'callate loji', 'callatemoxilakla', 'q te importa', 'ke te importa', 'te importa'],
    reason: 'Trato despectivo, burla directa o intento de silenciar a otra persona.',
  },
  {
    category: 'profanity',
    severity: 'low',
    label: 'posible apodo o burla leve',
    phrases: ['oe pollo', 'que pasa pollo', 'recontrapollo'],
    reason: 'Posible apodo usado como burla; revisar si existe reiteracion.',
  },
  {
    category: 'romance_contact',
    severity: 'low',
    label: 'contacto romantico',
    phrases: ['te amo', 'teamo', 'me gustas', 'quiero estar contigo', 'seamos novios', 'quieres ser mi novia', 'quieres ser mi novio', 'sal conmigo'],
    reason: 'Contacto romantico no adecuado para mensajeria institucional; no debe bloquear automaticamente.',
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
    .replace(/q(ue)?/g, 'que')
    .replace(/k(e)?/g, 'que')
    .replace(/bn/g, 'bien')
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
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[a.length][b.length]
}

function fuzzyTokenMatch(tokens: string[], target: string) {
  const normalizedTarget = normalizeForModeration(target)
  if (normalizedTarget.length < 5) return null
  for (const token of tokens) {
    if (Math.abs(token.length - normalizedTarget.length) > 1) continue
    if (levenshtein(token, normalizedTarget) <= 1) return token
  }
  return null
}

function hasAnyContext(tokens: string[], phrases: string[], normalized: string) {
  return phrases.some(context => {
    const norm = normalizeForModeration(context)
    return tokens.includes(norm) || hasPhrase(normalized, norm)
  })
}

function isSafeContext(normalized: string) {
  const safePhrase = SAFE_CONTEXT_PHRASES.some(phrase => hasPhrase(normalized, phrase))
  if (safePhrase) return true
  const tokens = tokenize(normalized)
  return tokens.some(token => ['sexto', 'sexta', 'sexagesimal'].includes(token))
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
  const rawLower = String(raw ?? '').toLowerCase()
  const tokens = tokenize(normalized)
  const matches: ModerationMatch[] = []
  const safeContext = isSafeContext(normalized)

  if (!normalized || safeContext) {
    return { normalized, tokens, category: 'safe', severity: 'none', action: 'allow', confidence: safeContext ? 0.05 : 0, matchedWords: [], matches: [], safeContext }
  }

  for (const rule of RULES) {
    const requiresContext = rule.requiresContext?.length ? hasAnyContext(tokens, rule.requiresContext, normalized) : true
    if (!requiresContext) continue

    for (const rawPhrase of rule.rawPhrases ?? []) {
      if (rawLower.includes(rawPhrase.toLowerCase())) matches.push({ category: rule.category, severity: rule.severity, label: rule.label, evidence: rawPhrase, reason: rule.reason })
    }
    for (const phrase of rule.phrases ?? []) {
      if (hasPhrase(normalized, phrase)) matches.push({ category: rule.category, severity: rule.severity, label: rule.label, evidence: phrase, reason: rule.reason })
    }
    for (const word of rule.words ?? []) {
      const normalizedWord = normalizeForModeration(word)
      if (tokens.includes(normalizedWord) || tokens.some(token => token.includes(normalizedWord) && normalizedWord.length >= 5)) {
        matches.push({ category: rule.category, severity: rule.severity, label: rule.label, evidence: word, reason: rule.reason })
      }
    }
    for (const word of rule.fuzzy ?? []) {
      const hit = fuzzyTokenMatch(tokens, word)
      if (hit) matches.push({ category: rule.category, severity: rule.severity, label: `${rule.label} (escritura alterada)`, evidence: hit, reason: rule.reason })
    }
  }

  if (matches.length === 0) return { normalized, tokens, category: 'safe', severity: 'none', action: 'allow', confidence: 0, matchedWords: [], matches: [], safeContext }

  const strongest = [...matches].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]
  const confidence = Math.min(0.98, 0.55 + matches.length * 0.1 + severityRank(strongest.severity) * 0.08)
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
    warning: action === 'block_user'
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
