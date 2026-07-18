import type { UserProfile } from './types'

export const DEMO_PROFILE: UserProfile = {
  id: 'demo-user', name: 'Brandon Dev', email: 'brandon@dev.local', username: 'brandon.dev',
  avatarUrl: '', bio: 'Transformando café em código e aprendendo um commit por vez.',
  college: 'Faculdade de Tecnologia', course: 'Engenharia de Software', englishLevel: 'B1 — Intermediário',
  skills: ['Next.js', 'TypeScript', 'Python', 'Git', 'SQL'], xp: 2941, streak: 12, gems: 231,
  dailyGoal: 50, dailyXp: 34,
}

const PROFILE_KEY = 'duoti.profile'
export function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return DEMO_PROFILE
  try { return { ...DEMO_PROFILE, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') } } catch { return DEMO_PROFILE }
}
export function saveProfile(profile: UserProfile) {
  if (typeof window !== 'undefined') localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}
