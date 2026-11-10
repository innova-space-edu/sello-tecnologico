import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type Provider = 'groq' | 'openrouter' | 'gemini'
type Answer = { content: string; provider: Provider; model: string }

const SYSTEM_PROMPT = [
  'Eres Mira AI, asistente educativa de CreaLab, una plataforma de Innova Space Education.',
  'CreaLab permite crear, desarrollar, documentar, evaluar y publicar proyectos de cualquier disciplina.',
  'Ayuda a docentes y estudiantes con proyectos ABP y STEAM, creatividad, investigación y trabajo colaborativo.',
  'Responde en español con precisión, ejemplos claros y pasos útiles cuando se necesiten.',
  'No inventes hechos, resultados o fuentes y reconoce la incertidumbre cuando corresponda.',
  'No reveles datos personales ni solicites contraseñas, RUT ni información privada de menores.',
].join(' ')

const PROVIDERS: Provider[] = ['groq', 'openrouter', 'gemini']
const MAX_BODY_BYTES = 24_000
const MAX_MESSAGES = 14
const MAX_MESSAGE_LENGTH = 4_000

function configuredOrder(): Provider[] {
  const raw = process.env.MIRA_PROVIDER_ORDER?.trim()
  if (!raw) return PROVIDERS
  const requested = raw.toLowerCase().split(',').map(item => item.trim())
  return [...new Set(requested)].filter((item): item is Provider =>
    PROVIDERS.includes(item as Provider))
}

function timeoutMs(): number {
  const custom = Number(process.env.MIRA_TIMEOUT_MS)
  return Number.isFinite(custom) && custom >= 3_000 && custom <= 25_000 ? custom : 12_000
}

function extractText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    const combined = value
      .filter((item): item is { text: string } =>
        Boolean(item) && typeof item === 'object' && typeof item.text === 'string')
      .map(item => item.text).join('\n').trim()
    return combined || null
  }
  return null
}

async function callOpenAICompatible(
  provider: 'groq' | 'openrouter',
  key: string,
  model: string,
  messages: ChatMessage[],
): Promise<string | null> {
  const groq = provider === 'groq'
  const endpoint = groq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions'
  const headers: Record<string, string> = {
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
  }
  if (!groq) {
    headers['X-Title'] = 'CreaLab'
    const url = process.env.NEXT_PUBLIC_SITE_URL
    if (url && /^https?:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url)) {
      headers['HTTP-Referer'] = url
    }
  }
  const completion: Record<string, unknown> = {
    model,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    max_completion_tokens: 2048,
    stream: false,
  }
  if (groq && model.startsWith('openai/gpt-oss-')) {
    completion.reasoning_effort = 'low'
    completion.include_reasoning = false
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(completion),
    signal: AbortSignal.timeout(timeoutMs()),
    cache: 'no-store',
  })
  if (!response.ok) {
    console.warn('[Mira] Provider unavailable:', provider, response.status)
    return null
  }
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object' || !('choices' in result)) return null
  const choices = (result as { choices?: { message?: { content?: unknown } }[] }).choices
  return extractText(choices?.[0]?.message?.content)
}

async function callGemini(key: string, model: string, messages: ChatMessage[]): Promise<string | null> {
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: messages.map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: { maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(timeoutMs()),
    cache: 'no-store',
  })
  if (!response.ok) {
    console.warn('[Mira] Provider unavailable: gemini', response.status)
    return null
  }
  const result = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const parts = result.candidates?.[0]?.content?.parts ?? []
  return extractText(parts)
}

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null
  const messages: ChatMessage[] = []
  let totalCharacters = 0
  for (const value of raw) {
    if (!value || typeof value !== 'object') return null
    const message = value as Record<string, unknown>
    if ((message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.content !== 'string') return null
    const content = message.content.trim()
    if (!content || content.length > MAX_MESSAGE_LENGTH) return null
    totalCharacters += content.length
    if (totalCharacters > 16_000) return null
    messages.push({ role: message.role, content })
  }
  return messages.at(-1)?.role === 'user' ? messages : null
}

async function generate(messages: ChatMessage[]): Promise<Answer | null> {
  for (const provider of configuredOrder()) {
    const key = provider === 'groq' ? process.env.GROQ_API_KEY
      : provider === 'openrouter' ? process.env.OPENROUTER_API_KEY
      : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!key) continue

    const model = provider === 'groq'
      ? process.env.MIRA_GROQ_MODEL || 'openai/gpt-oss-120b'
      : provider === 'openrouter'
        ? process.env.MIRA_OPENROUTER_MODEL || 'openrouter/auto'
        : process.env.MIRA_GEMINI_MODEL || 'gemini-3.8-flash'
    try {
      const content = provider === 'gemini'
        ? await callGemini(key, model, messages)
        : await callOpenAICompatible(provider, key, model, messages)
      if (content) return { content, provider, model }
    } catch (error) {
      console.warn('[Mira] Provider request failed:', provider,
        error instanceof Error ? error.name : 'unknown')
    }
  }
  return null
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return NextResponse.json({ content: 'Se requiere una solicitud JSON.' }, { status: 415 })
    }
    if (process.env.MIRA_REQUIRE_AUTH === 'true') {
      const supabase = await createServerSupabaseClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        return NextResponse.json({ content: 'Inicia sesión para utilizar Mira AI.' }, { status: 401 })
      }
    }
    const body = await request.text()
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ content: 'La conversación supera el tamaño permitido.' }, { status: 413 })
    }
    let input: { messages?: unknown }
    try {
      input = JSON.parse(body)
    } catch {
      return NextResponse.json({ content: 'JSON inválido.' }, { status: 400 })
    }
    const messages = sanitizeMessages(input?.messages)
    if (!messages) {
      return NextResponse.json({ content: 'La conversación no tiene un formato válido.' }, { status: 400 })
    }
    const available = Boolean(process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY ||
      process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    if (!available) {
      return NextResponse.json({
        content: 'Mira AI aún no está configurada. Contacta al administrador.',
      }, { status: 503 })
    }
    const answer = await generate(messages)
    if (answer) {
      return NextResponse.json(answer, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({
      content: 'Los proveedores de IA no están disponibles en este momento. Intenta más tarde.',
    }, { status: 503 })
  } catch (error) {
    console.error('[Mira] Error en la ruta:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ content: 'No fue posible procesar la solicitud.' }, { status: 500 })
  }
}
