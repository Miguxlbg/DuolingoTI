// Serviços 100% gratuitos e SEM API KEY:
// Tradução: MyMemory → Lingva → LibreTranslate (fallback chain)
// Dicionário: Free Dictionary API (dictionaryapi.dev)
// Pronúncia: áudio real do dicionário → Web Speech API (fallback)

export interface TranslationResult { text: string; source: 'mymemory' | 'lingva' | 'libretranslate' }

export async function translateWithFallback(text: string, from = 'en', to = 'pt'): Promise<TranslationResult> {
  // 1ª tentativa: MyMemory
  try {
    const params = new URLSearchParams({ q: text, langpair: `${from}|${to}` })
    const res = await fetch(`https://api.mymemory.translated.net/get?${params}`)
    if (res.ok) {
      const data = await res.json()
      const match = Number(data?.responseData?.match ?? 0)
      const translated = data?.responseData?.translatedText
      if (translated && match >= 0.75 && !/QUERY LENGTH LIMIT|INVALID/i.test(translated)) {
        return { text: translated, source: 'mymemory' }
      }
    }
  } catch { /* tenta a próxima */ }

  // 2ª tentativa: Lingva (front-end do Google Translate, open source)
  try {
    const res = await fetch(`https://lingva.ml/api/v1/${from}/${to}/${encodeURIComponent(text)}`)
    if (res.ok) {
      const data = await res.json()
      if (data?.translation) return { text: data.translation, source: 'lingva' }
    }
  } catch { /* tenta a próxima */ }

  // 3ª tentativa: LibreTranslate (instância pública)
  try {
    const res = await fetch('https://libretranslate.com/translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.translatedText) return { text: data.translatedText, source: 'libretranslate' }
    }
  } catch { /* acabou a fila */ }

  throw new Error('Todas as APIs de tradução falharam. Verifique sua conexão.')
}

// ===== Dicionário (definições, exemplos, fonética, áudio real) =====
export interface DictionaryEntry {
  word: string; phonetic: string; audioUrl: string
  meanings: { partOfSpeech: string; definition: string; example: string }[]
}

export async function lookupDictionary(word: string): Promise<DictionaryEntry | null> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`)
    if (!res.ok) return null
    const data = await res.json()
    const entry = Array.isArray(data) ? data[0] : null
    if (!entry) return null
    const audio = (entry.phonetics || []).find((p: { audio?: string }) => p.audio)?.audio || ''
    const meanings = (entry.meanings || []).slice(0, 3).flatMap((m: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }) =>
      (m.definitions || []).slice(0, 2).map((d) => ({ partOfSpeech: m.partOfSpeech, definition: d.definition, example: d.example || '' }))
    )
    return { word: entry.word, phonetic: entry.phonetic || entry.phonetics?.find((p: { text?: string }) => p.text)?.text || '', audioUrl: audio, meanings }
  } catch { return null }
}

// ===== Pronúncia: áudio real do dicionário, senão Web Speech =====
export async function pronounce(word: string, audioUrl?: string) {
  if (audioUrl) {
    try { await new Audio(audioUrl).play(); return } catch { /* fallback */ }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(word)
    u.lang = 'en-US'; u.rate = 0.92
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u)
  }
}
