import type { UserProfile } from './types'

// Perfil inicial ZERADO — nada de dados falsos. Tudo cresce com uso real.
export const EMPTY_PROFILE: UserProfile = {
  id: '', name: '', email: '', username: '',
  avatarUrl: '', bio: '',
  college: '', course: '', englishLevel: 'A1 — Iniciante',
  skills: [], xp: 0, streak: 0, gems: 0,
  dailyGoal: 50, dailyXp: 0,
  pace: 'regular', goalWorld: 'academic',
}

// compat com imports antigos
export const DEMO_PROFILE = EMPTY_PROFILE

const PROFILE_KEY = 'duoti.profile'
export function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return EMPTY_PROFILE
  try { return { ...EMPTY_PROFILE, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') } } catch { return EMPTY_PROFILE }
}
export function saveProfile(profile: UserProfile) {
  if (typeof window !== 'undefined') localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}
export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('duoti.logged')
}

// ===== Paleta personalizada (cores primária/secundária) =====
export interface Palette { primary: string; secondary: string }
const PALETTE_KEY = 'duoti.palette'
export const DEFAULT_PALETTE: Palette = { primary: '#58cc02', secondary: '#7c3aed' }
export function loadPalette(): Palette {
  if (typeof window === 'undefined') return DEFAULT_PALETTE
  try { return { ...DEFAULT_PALETTE, ...JSON.parse(localStorage.getItem(PALETTE_KEY) || '{}') } } catch { return DEFAULT_PALETTE }
}
export function savePalette(p: Palette) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PALETTE_KEY, JSON.stringify(p))
  applyPalette(p)
}
function darken(hex: string, amt = 0.22): string {
  const n = hex.replace('#', '')
  const r = Math.round(parseInt(n.slice(0, 2), 16) * (1 - amt))
  const g = Math.round(parseInt(n.slice(2, 4), 16) * (1 - amt))
  const b = Math.round(parseInt(n.slice(4, 6), 16) * (1 - amt))
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
export function applyPalette(p: Palette) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--green', p.primary)
  root.style.setProperty('--green-dark', darken(p.primary))
  root.style.setProperty('--purple', p.secondary)
}

// ===== Agenda de estudos personalizada =====
export interface ScheduleSlot { id: string; day: number; start: string; end: string; topic: string }
const SCHEDULE_KEY = 'duoti.schedule'
export function loadSchedule(): ScheduleSlot[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]') } catch { return [] }
}
export function saveSchedule(slots: ScheduleSlot[]) {
  if (typeof window !== 'undefined') localStorage.setItem(SCHEDULE_KEY, JSON.stringify(slots))
}

// ===== Documentos anexados (PDFs, certificados, aulas, projetos) =====
export interface UserDocument {
  id: string; kind: 'pdf' | 'certificado' | 'aula' | 'projeto' | 'outro'
  title: string; description: string; skills: string[]
  fileName?: string; textContent?: string; url?: string
  addedAt: string
}
const DOCS_KEY = 'duoti.documents'
export function loadDocuments(): UserDocument[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(DOCS_KEY) || '[]') } catch { return [] }
}
export function saveDocuments(docs: UserDocument[]) {
  if (typeof window !== 'undefined') localStorage.setItem(DOCS_KEY, JSON.stringify(docs))
}

// ===== Flashcards =====
export interface Flashcard {
  id: string; front: string; back: string; example?: string; phonetic?: string
  lang: string; box: number; nextReview: string; createdAt: string
}
const CARDS_KEY = 'duoti.flashcards'
export function loadFlashcards(): Flashcard[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(CARDS_KEY) || '[]') } catch { return [] }
}
export function saveFlashcards(cards: Flashcard[]) {
  if (typeof window !== 'undefined') localStorage.setItem(CARDS_KEY, JSON.stringify(cards))
}
