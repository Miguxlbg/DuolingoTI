export interface AIService { explain(prompt: string): Promise<string> }

const localFallback: AIService = {
  async explain(prompt) {
    const topic = prompt.slice(0, 80)
    return `Modo offline: revise o conceito “${topic}”. Tente explicar com suas palavras, crie um exemplo mínimo e compare o resultado esperado com o obtido.`
  },
}

export const aiService: AIService = {
  async explain(prompt) {
    try {
      const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      if (!response.ok) return localFallback.explain(prompt)
      const data = await response.json()
      return data.text || localFallback.explain(prompt)
    } catch { return localFallback.explain(prompt) }
  },
}
