export type MascotState = 'feliz' | 'apaixonado' | 'cansado' | 'conectando' | 'programando' | 'ouvindo_musica' | 'bravo' | 'erro404'
export type View = 'inicio' | 'aprender' | 'projetos' | 'ranking' | 'amigos' | 'loja' | 'perfil' | 'flashcards' | 'documentos' | 'agenda' | 'config'
export type WorldId = 'academic' | 'english' | 'bootcamp'

export interface UserProfile {
  id: string
  name: string
  email: string
  avatarUrl: string
  username: string
  bio: string
  college: string
  course: string
  englishLevel: string
  skills: string[]
  xp: number
  streak: number
  gems: number
  dailyGoal: number
  dailyXp: number
  pace?: 'casual' | 'regular' | 'serio' | 'insano'
  goalWorld?: WorldId
}

export interface LessonNode {
  id: string
  title: string
  subtitle: string
  icon: string
  state: 'done' | 'current' | 'locked'
  xp: number
  kind: 'lesson' | 'practice' | 'checkpoint' | 'boss'
}

export interface World {
  id: WorldId
  name: string
  short: string
  color: string
  description: string
  lessons: LessonNode[]
}
