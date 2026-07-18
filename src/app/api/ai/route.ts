import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { prompt } = await request.json()
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ text: `Dica offline: divida “${String(prompt).slice(0, 70)}” em partes menores e valide cada hipótese com um exemplo executável.` })
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents:[{ parts:[{ text:`Você é um tutor de TI conciso. Responda em português, com exemplo técnico real. Pergunta: ${prompt}` }] }] }),
    })
    if (!response.ok) throw new Error('Gemini indisponível')
    const data = await response.json()
    return NextResponse.json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tente novamente.' })
  } catch {
    return NextResponse.json({ text:'O tutor está offline agora. Revise o conceito, escreva um exemplo mínimo e teste sua hipótese.' })
  }
}
