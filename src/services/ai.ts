export interface AIService { explain(prompt: string): Promise<string> }

const localFallback: AIService = {
  async explain(prompt) {
    const topic = prompt.slice(0, 80)
    return `Modo offline: revise o conceito “${topic}”. Tente explicar com suas palavras, crie um exemplo mínimo e compare o resultado esperado com o obtido.`
  },
}

// Conhecimento aprendido dos documentos anexados (seção Documentos)
const KNOWLEDGE_KEY = 'duoti.tutorKnowledge'
export function getTutorKnowledge(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(KNOWLEDGE_KEY) || ''
}
export function appendTutorKnowledge(fact: string) {
  if (typeof window === 'undefined') return
  const prev = getTutorKnowledge()
  localStorage.setItem(KNOWLEDGE_KEY, `${prev}\n${fact}`.trim().slice(-12000))
}

export const aiService: AIService = {
  async explain(prompt) {
    try {
      const response = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, knowledge: getTutorKnowledge() }),
      })
      if (!response.ok) return localFallback.explain(prompt)
      const data = await response.json()
      return data.text || localFallback.explain(prompt)
    } catch { return localFallback.explain(prompt) }
  },
}
