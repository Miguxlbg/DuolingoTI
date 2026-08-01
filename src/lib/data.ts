import type { World } from './types'

// Metadados dos mundos (nome, cor, descrição). As lições reais vêm de
// /content/index.json — nada aqui é demonstrativo.
export const WORLDS: World[] = [
  {
    id: 'academic', name: 'Mundo Acadêmico', short: 'Engenharia de Software', color: '#7c3aed',
    description: 'Fundamentos sólidos para construir software de verdade.',
    lessons: [],
  },
  {
    id: 'english', name: 'Inglês Técnico', short: 'English for Developers', color: '#ec4899',
    description: 'Leia docs, escreva commits e fale sobre código com confiança.',
    lessons: [],
  },
  {
    id: 'bootcamp', name: 'Mundo Bootcamp', short: 'Full-stack com Next.js', color: '#0ea5e9',
    description: 'Sprints práticas, code reviews e um projeto final publicável.',
    lessons: [],
  },
]

// Ideias de projeto (briefings para você construir e usar nos duelos de projeto).
// São sugestões de desafio, não dados de progresso.
export const PROJECTS = [
  { title:'API de tarefas resiliente', level:'Intermediário', stack:['Next.js','Supabase'], color:'#7c3aed' },
  { title:'Dashboard de métricas', level:'Intermediário', stack:['React','Charts'], color:'#0ea5e9' },
  { title:'CLI para organizar commits', level:'Avançado', stack:['Python','GitHub API'], color:'#ec4899' },
]
