// Camada de conteúdo real: lê o índice do currículo (16 trilhas / 161 lições)
// e as lições geradas pelo motor (public/content/**), nada hardcoded na UI.

export interface ContentExercise {
  kind: 'multiple_choice' | 'fill_blank' | 'order_tokens' | 'match_pairs' | 'true_false' | 'listen_type' | 'translate' | 'open_writing'
  prompt: string
  code: string | null
  options: string[] | null
  answer: string
  explanation: string
}

export interface ContentLesson {
  title: string
  context: string
  theory: string
  useCase: string
  diagram: null | { kind: string; title: string; nodes: { id: string; label: string }[]; edges: { from: string; to: string; label?: string }[] }
  vocabulary: { term: string; definition: string; example: string }[]
  exercises: ContentExercise[]
  trackId: string
  world: string
  order: number
  slug: string
  xp: number
  source?: { kind: 'user_material' | 'consolidated'; files?: string[] }
}

export interface TrackIndexLesson { n: number; title: string; slug: string; has: boolean; xp: number }
export interface TrackIndex {
  id: string; name: string; icon: string; color: string; description: string
  world: 'academic' | 'english'; kind: 'tech' | 'english'; cefr: string | null
  lessons: TrackIndexLesson[]
}
export interface ContentIndex { generatedAt: string; tracks: TrackIndex[] }

let indexCache: ContentIndex | null = null

export async function loadContentIndex(): Promise<ContentIndex> {
  if (indexCache) return indexCache
  const res = await fetch('/content/index.json')
  if (!res.ok) throw new Error('índice de conteúdo indisponível')
  indexCache = await res.json()
  return indexCache!
}

export async function loadLesson(trackId: string, n: number): Promise<ContentLesson> {
  const res = await fetch(`/content/${trackId}/${String(n).padStart(2, '0')}.json`)
  if (!res.ok) throw new Error('lição ainda não gerada')
  return res.json()
}

// Progresso local (sincroniza com Supabase quando configurado)
const KEY = 'duoti.lessonProgress'
export function getCompleted(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
export function markCompleted(slug: string) {
  const all = getCompleted(); all[slug] = true
  localStorage.setItem(KEY, JSON.stringify(all))
}

// Glossário pessoal: termos das lições concluídas
const VOCAB_KEY = 'duoti.vocabulary'
export interface SavedTerm { term: string; definition: string; example: string; trackId: string; lesson: string }
export function getVocabulary(): SavedTerm[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(VOCAB_KEY) || '[]') } catch { return [] }
}
export function saveVocabulary(lesson: ContentLesson) {
  const all = getVocabulary()
  for (const v of lesson.vocabulary) {
    if (!all.some((t) => t.term === v.term)) all.push({ ...v, trackId: lesson.trackId, lesson: lesson.title })
  }
  localStorage.setItem(VOCAB_KEY, JSON.stringify(all))
}
