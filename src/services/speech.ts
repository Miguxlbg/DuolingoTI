export const speechService = {
  speak(text: string, lang = 'en-US') {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.82
    speechSynthesis.speak(utterance)
    return true
  },
  isRecognitionSupported() {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  },
}
