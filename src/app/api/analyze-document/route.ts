import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

// Analisa um documento anexado (PDF extraído em texto, certificado, aula,
// projeto) e devolve: resumo, skills, bio e a TRILHA do syllabus mais
// relacionada. Também grava a fonte de conhecimento (Supabase +, em dev,
// content/sources/) para o motor de conteúdo usar como referência.

function loadTrackCatalog(): { id: string; name: string }[] {
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'content', 'index.json'), 'utf8'))
    return idx.tracks.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
  } catch { return [] }
}

async function persistKnowledgeSource(payload: {
  userId?: string; title: string; kind: string; fileName: string
  trackId: string | null; text: string; summary: string; skills: string[]
}) {
  const saved: string[] = []
  // 1) Supabase (produção)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key && payload.userId) {
    try {
      const res = await fetch(`${url}/rest/v1/knowledge_sources`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: payload.userId, title: payload.title, file_name: payload.fileName,
          kind: payload.kind, track_id: payload.trackId,
          text_content: payload.text.slice(0, 60000), summary: payload.summary, skills: payload.skills,
        }),
      })
      if (res.ok) saved.push('supabase')
    } catch { /* segue */ }
  }
  // 2) Arquivo local (dev/sandbox) — é daqui que generate-content.mjs lê
  if (payload.trackId) {
    try {
      const dir = path.join(process.cwd(), 'content', 'sources', payload.trackId)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, `${Date.now()}.json`), JSON.stringify({
        title: payload.title, fileName: payload.fileName, kind: payload.kind,
        text: payload.text.slice(0, 60000), summary: payload.summary, skills: payload.skills,
      }, null, 1))
      saved.push('local')
    } catch { /* filesystem read-only (Vercel) — ok, Supabase cobre */ }
  }
  return saved
}

export async function POST(request: Request) {
  const { title, kind, text, fileName, userId } = await request.json()
  const key = process.env.GEMINI_API_KEY
  const tracks = loadTrackCatalog()

  if (!key) {
    // Fallback heurístico sem IA: extrai tecnologias conhecidas do texto
    const KNOWN = ['javascript','typescript','react','next.js','node','python','java','c#','c++','go','rust','sql','postgresql','mysql','mongodb','docker','kubernetes','aws','azure','gcp','git','github','linux','html','css','tailwind','api','rest','graphql','testes','jest','cypress','scrum','kanban','agile','supabase','firebase','redis','ci/cd','devops','flutter','swift','kotlin','php','laravel','django','flask','spring','angular','vue']
    const lower = String(text || title || '').toLowerCase()
    const skills = KNOWN.filter((k) => lower.includes(k)).slice(0, 12)
    return NextResponse.json({
      summary: `Documento "${title}" (${kind}) registrado. Configure a GEMINI_API_KEY para análise completa por IA.`,
      skills: skills.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
      bioSuggestion: null, trackId: null, savedTo: [],
    })
  }
  try {
    const prompt = `Você analisa documentos de aprendizado de um estudante de TI. Responda APENAS JSON válido:
{"summary":"resumo do que este documento prova/ensina, em português, 2-3 frases","skills":["skill1","skill2"],"bioSuggestion":"uma frase curta para a bio do perfil ou null","knowledge":"3-5 fatos-chave extraídos do documento que um tutor deve lembrar para ajudar este aluno","trackId":"id da trilha mais relacionada da lista abaixo, ou null se NÃO houver relação clara e segura — nunca force uma trilha errada"}

Trilhas disponíveis (id — nome):
${tracks.map((t) => `${t.id} — ${t.name}`).join('\n')}

Tipo: ${kind}. Título: ${title}.
Conteúdo (pode estar truncado):
${String(text || '').slice(0, 20000)}`
    const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
    })
    if (!ai.ok) throw new Error('IA indisponível')
    const data = await ai.json()
    const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const json = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!json) throw new Error('resposta inválida')
    const result = JSON.parse(json)
    // valida trackId contra o catálogo real — nunca aceita id inventado
    const trackId = tracks.some((t) => t.id === result.trackId) ? result.trackId : null
    const savedTo = await persistKnowledgeSource({
      userId, title, kind, fileName: fileName || title,
      trackId, text: String(text || ''), summary: result.summary || '', skills: result.skills || [],
    })
    return NextResponse.json({ ...result, trackId, savedTo })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'falha na análise' }, { status: 500 })
  }
}
