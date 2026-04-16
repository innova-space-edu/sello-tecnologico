import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Eres Mira AI, una asistente educativa inteligente del Colegio Providencia.
Ayudas a docentes y estudiantes con preguntas sobre el Sello Tecnológico, proyectos educativos,
tecnología, ciencias, y cualquier tema académico.
Respondes siempre en español, de forma clara, amigable y precisa.
Cuando no sabes algo, lo dices con honestidad.`

async function tryGroq(key: string, model: string, messages: any[]) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? null
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json()
    if (!Array.isArray(messages)) {
      return NextResponse.json({ content: 'Formato de mensaje inválido.' }, { status: 400 })
    }

    const key = process.env.GROQ_API_KEY
    if (!key) {
      return NextResponse.json({ content: 'El servicio de IA no está configurado. Contacta al administrador.' })
    }

    // Intentar modelos en orden de preferencia
    const models = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'llama3-8b-8192', 'gemma2-9b-it']
    for (const model of models) {
      try {
        const content = await tryGroq(key, model, messages)
        if (content) return NextResponse.json({ content })
      } catch { /* intentar siguiente */ }
    }

    return NextResponse.json({ content: 'El servicio de IA no está disponible en este momento. Intenta más tarde.' })

  } catch (error) {
    console.error('[Mira] Error:', error)
    return NextResponse.json({ content: 'Ocurrió un error inesperado. Por favor recarga la página e intenta de nuevo.' })
  }
}
