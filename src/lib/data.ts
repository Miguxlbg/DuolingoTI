import type { World } from './types'

export const WORLDS: World[] = [
  {
    id: 'academic', name: 'Mundo Acadêmico', short: 'Engenharia de Software', color: '#7c3aed',
    description: 'Fundamentos sólidos para construir software de verdade.',
    lessons: [
      { id:'logic-1', title:'Pensamento lógico', subtitle:'Algoritmos e decomposição', icon:'{}', state:'done', xp:40, kind:'lesson' },
      { id:'logic-2', title:'Variáveis & tipos', subtitle:'Como programas representam dados', icon:'Aa', state:'done', xp:50, kind:'lesson' },
      { id:'logic-3', title:'Controle de fluxo', subtitle:'Decisões e repetições', icon:'↪', state:'current', xp:60, kind:'lesson' },
      { id:'logic-practice', title:'Revisão rápida', subtitle:'Fortaleça seus pontos fracos', icon:'★', state:'locked', xp:40, kind:'practice' },
      { id:'logic-4', title:'Funções', subtitle:'Reuso e responsabilidade', icon:'ƒx', state:'locked', xp:70, kind:'lesson' },
      { id:'logic-check', title:'Checkpoint', subtitle:'Desafio de Lógica', icon:'🏁', state:'locked', xp:120, kind:'checkpoint' },
      { id:'oop-1', title:'Objetos e classes', subtitle:'Modelando o domínio', icon:'◇', state:'locked', xp:80, kind:'lesson' },
    ],
  },
  {
    id: 'english', name: 'Inglês Técnico', short: 'English for Developers', color: '#ec4899',
    description: 'Leia docs, escreva commits e fale sobre código com confiança.',
    lessons: [
      { id:'eng-1', title:'Code vocabulary', subtitle:'60 termos fundamentais', icon:'ABC', state:'done', xp:40, kind:'lesson' },
      { id:'eng-2', title:'Reading documentation', subtitle:'Skimming e scanning', icon:'↗', state:'current', xp:55, kind:'lesson' },
      { id:'eng-3', title:'Clear commit messages', subtitle:'Escreva como um profissional', icon:'git', state:'locked', xp:65, kind:'lesson' },
      { id:'eng-4', title:'Daily stand-up', subtitle:'Explique progresso e bloqueios', icon:'◉', state:'locked', xp:70, kind:'lesson' },
      { id:'eng-5', title:'Bug reports', subtitle:'Passos claros para reproduzir', icon:'!', state:'locked', xp:70, kind:'lesson' },
      { id:'eng-check', title:'English checkpoint', subtitle:'Teste CEFR técnico', icon:'🏁', state:'locked', xp:140, kind:'checkpoint' },
    ],
  },
  {
    id: 'bootcamp', name: 'Mundo Bootcamp', short: 'Full-stack com Next.js', color: '#0ea5e9',
    description: 'Sprints práticas, code reviews e um projeto final publicável.',
    lessons: [
      { id:'boot-1', title:'Setup profissional', subtitle:'Git, lint e arquitetura', icon:'</>', state:'done', xp:60, kind:'lesson' },
      { id:'boot-2', title:'React mental model', subtitle:'Estado, props e composição', icon:'⚛', state:'current', xp:75, kind:'lesson' },
      { id:'boot-3', title:'Next.js App Router', subtitle:'Rotas, layouts e rendering', icon:'N', state:'locked', xp:90, kind:'lesson' },
      { id:'boot-4', title:'Banco & Auth', subtitle:'Supabase na prática', icon:'DB', state:'locked', xp:100, kind:'lesson' },
      { id:'boot-5', title:'Testes e qualidade', subtitle:'Confiança para entregar', icon:'✓', state:'locked', xp:100, kind:'lesson' },
      { id:'boot-boss', title:'Projeto final', subtitle:'SaaS full-stack', icon:'⚡', state:'locked', xp:300, kind:'boss' },
    ],
  },
]

export const FRIENDS = [
  { name:'Emily Cooper', handle:'@emilycodes', xp:3680, status:'Estudando TypeScript', online:true, color:'#ec4899' },
  { name:'Rafael Lima', handle:'@rafa.py', xp:3290, status:'Em uma lição de Python', online:true, color:'#8b5cf6' },
  { name:'Ana Beatriz', handle:'@anab.dev', xp:2710, status:'Última vez há 20 min', online:false, color:'#06b6d4' },
  { name:'Gui Santos', handle:'@gui.front', xp:2440, status:'Praticando inglês', online:true, color:'#f59e0b' },
]

export const LEADERBOARD = [
  ['Marina Costa', 3840, 'MC'], ['Emily Cooper', 3680, 'EC'], ['Rafael Lima', 3290, 'RL'],
  ['Brandon Dev', 2941, 'BD'], ['Ana Beatriz', 2710, 'AB'], ['Gui Santos', 2440, 'GS'],
]

export const PROJECTS = [
  { title:'API de tarefas resiliente', level:'Intermediário', stack:['Next.js','Supabase'], progress:72, color:'#7c3aed' },
  { title:'Dashboard de métricas', level:'Intermediário', stack:['React','Charts'], progress:38, color:'#0ea5e9' },
  { title:'CLI para organizar commits', level:'Avançado', stack:['Python','GitHub API'], progress:0, color:'#ec4899' },
]

export const EXERCISES = [
  { kind:'choice', question:'Qual condição faz o laço executar enquanto i for menor que 10?', code:'for (let i = 0; i ___ 10; i++)', options:['<','>','===','!='], answer:'<', explanation:'O operador < verifica se i ainda é menor que 10.' },
  { kind:'english', question:'Complete o bug report no passado:', code:'The authentication bug was ___ yesterday.', options:['fixed','fix','fixing','fixes'], answer:'fixed', explanation:'A voz passiva no passado usa was + particípio: was fixed.' },
  { kind:'truefalse', question:'Verdadeiro ou falso?', code:'const items = [1, 2, 3]\nitems.map(x => x * 2)\n// items agora vale [2, 4, 6]', options:['Verdadeiro','Falso'], answer:'Falso', explanation:'map retorna um novo array e não altera items.' },
]
