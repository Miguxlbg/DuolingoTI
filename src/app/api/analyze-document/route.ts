import { NextResponse } from 'next/server'

// Analisa um documento anexado (PDF extraído em texto, certificado, aula,
// projeto) e devolve: título, resumo, skills detectadas e atualização de bio.
// É assim que o sistema APRENDE com o que você anexa.
export async function POST(request: Request) {
  const { title, kind, text } = await request.json()
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    // Fallback heurístico sem IA: extrai tecnologias conhecidas do texto
    const KNOWN = ['javascript','typescript','react','next.js','node','python','java','c#','c++','go','rust','sql','postgresql','mysql','mongodb','docker','kubernetes','aws','azure','gcp','git','github','linux','html','css','tailwind','api','rest','graphql','testes','jest','cypress','scrum','kanban','agile','supabase','firebase','redis','ci/cd','devops','flutter','swift','kotlin','php','laravel','django','flask','spring','angular','vue']
    const lower = String(text || title || '').toLowerCase()
    const skills = KNOWN.filter((k) => lower.includes(k)).slice(0, 12)
    return NextResponse.json({
      summary: `Documento "${title}" (${kind}) registrado. Configure a GEMINI_API_KEY para análise completa por IA.`,
      skills: skills.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
      bioSuggestion: null,
    })
  }
  try {
    const prompt = `Você analisa documentos de aprendizado de um estudante de TI. Responda APENAS JSON válido:
{"summary":"resumo do que este documento prova/ensina, em português, 2-3 frases","skills":["skill1","skill2"],"bioSuggestion":"uma frase curta para a bio do perfil ou null","knowledge":"3-5 fatos-chave extraídos do documento que um tutor deve lembrar para ajudar este aluno"}

Tipo: ${kind}. Título: ${title}.
Conteúdo (pode estar truncado):
${String(text || '').slice(0, 20000)}`
    const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
    })
    if (!ai.ok) throw new Error('IA indisponível')
    const data = await ai.json()
    const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const json = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!json) throw new Error('resposta inválida')
    return NextResponse.json(JSON.parse(json))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'falha na análise' }, { status: 500 })
  }
}
