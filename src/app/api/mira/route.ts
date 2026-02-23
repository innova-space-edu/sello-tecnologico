import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { messages } = await request.json()

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres Mira AI, una asistente educativa inteligente del Colegio Providencia. 
Ayudas a docentes y estudiantes con preguntas sobre el Sello Tecnológico, proyectos educativos, 
tecnología, ciencias, y cualquier tema académico. 
Respondes siempre en español, de forma clara, amigable y precisa.
Cuando no sabes algo, lo dices con honestidad.`
        },
        ...messages
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  })

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content ?? 'Lo siento, no pude procesar tu pregunta.'

  return NextResponse.json({ content })
}
