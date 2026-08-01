import { NextResponse } from 'next/server'

// Avaliação REAL de projeto (0–100) por IA: baixa a árvore de arquivos e
// trechos de código do repositório GitHub e pede análise estruturada ao Gemini.
export async function POST(request: Request) {
  const { repoUrl, description } = await request.json()
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor. Adicione no .env.local / Vercel para habilitar a avaliação por IA.' }, { status: 503 })

  const m = String(repoUrl || '').match(/github\.com\/([\w.-]+)\/([\w.-]+)/)
  if (!m) return NextResponse.json({ error: 'Envie uma URL válida de repositório GitHub (https://github.com/usuario/repo).' }, { status: 400 })
  const [, owner, repo] = m
  const cleanRepo = repo.replace(/\.git$/, '')
  const gh = (path: string) => fetch(`https://api.github.com/repos/${owner}/${cleanRepo}${path}`, {
    headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
  })

  try {
    const repoRes = await gh('')
    if (!repoRes.ok) return NextResponse.json({ error: 'Repositório não encontrado ou privado.' }, { status: 404 })
    const meta = await repoRes.json()
    const treeRes = await gh(`/git/trees/${meta.default_branch}?recursive=1`)
    const tree = treeRes.ok ? (await treeRes.json()).tree || [] : []
    const files: string[] = tree.filter((t: { type: string }) => t.type === 'blob').map((t: { path: string }) => t.path).slice(0, 400)

    // Baixa até 8 arquivos-chave (README, package.json, configs e entradas principais)
    const important = files.filter((f) =>
      /^readme/i.test(f) || /package\.json$|requirements\.txt$|dockerfile$/i.test(f) ||
      /^(src|app|api|server|backend)\/.*\.(ts|tsx|js|py|go|java)$/i.test(f)
    ).slice(0, 8)
    const snippets: string[] = []
    for (const f of important) {
      const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${cleanRepo}/${meta.default_branch}/${f}`)
      if (raw.ok) {
        const text = (await raw.text()).slice(0, 4000)
        snippets.push(`--- ${f} ---\n${text}`)
      }
    }

    const prompt = `Você é um avaliador técnico sênior. Avalie este projeto de 0 a 100 e responda APENAS com JSON válido neste formato exato:
{"score":<0-100>,"frontend":{"score":<0-100>,"notes":"..."},"backend":{"score":<0-100>,"notes":"..."},"security":{"score":<0-100>,"notes":"..."},"architecture":{"score":<0-100>,"notes":"..."},"tests":{"score":<0-100>,"notes":"..."},"docs":{"score":<0-100>,"notes":"..."},"summary":"resumo em português com pontos fortes e o que melhorar"}

Projeto: ${meta.full_name} — ${meta.description || 'sem descrição'}
Linguagem principal: ${meta.language}. Stars: ${meta.stargazers_count}.
Descrição do autor: ${description || 'não informada'}
Estrutura (${files.length} arquivos): ${files.slice(0, 120).join(', ')}

Trechos de código:
${snippets.join('\n\n').slice(0, 24000)}`

    const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
    })
    if (!ai.ok) return NextResponse.json({ error: 'IA indisponível no momento. Tente de novo em instantes.' }, { status: 502 })
    const data = await ai.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const jsonText = text.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonText) return NextResponse.json({ error: 'A IA não retornou uma avaliação válida.' }, { status: 502 })
    return NextResponse.json(JSON.parse(jsonText))
  } catch (e) {
    return NextResponse.json({ error: `Falha na avaliação: ${e instanceof Error ? e.message : 'erro desconhecido'}` }, { status: 500 })
  }
}
