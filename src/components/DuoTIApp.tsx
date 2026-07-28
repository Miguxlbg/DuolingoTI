'use client'

import { useEffect, useState } from 'react'
import { Activity, Bell, BookOpen, Bot, CalendarDays, Check, ChevronDown, ChevronRight, Code2, Download, FileText, Flame, FolderGit2, Gem, GraduationCap, Home, Layers, LockKeyhole, LogOut, Medal, Menu, MessageCircle, Palette, Play, Plus, Search, Send, Settings, ShoppingBag, Sparkles, Swords, Trash2, Trophy, UserPlus, Users, Volume2, X, Zap } from 'lucide-react'
import { Mascot } from './Mascot'
import { ThemeToggle } from './ThemeToggle'
import { WORLDS, PROJECTS } from '@/lib/data'
import { EMPTY_PROFILE, loadProfile, saveProfile, clearSession, loadPalette, savePalette, applyPalette, DEFAULT_PALETTE, loadSchedule, saveSchedule, type ScheduleSlot, loadDocuments, saveDocuments, type UserDocument, loadFlashcards, saveFlashcards, type Flashcard } from '@/lib/storage'
import { LessonPlayer } from './LessonPlayer'
import { getCompleted, loadContentIndex, getVocabulary, type ContentIndex } from '@/lib/content'
import type { MascotState, UserProfile, View, WorldId } from '@/lib/types'
import { aiService, appendTutorKnowledge } from '@/services/ai'
import { getSupabase } from '@/lib/supabase'
import { socialAvailable, searchUsers, sendFriendRequest, respondFriendRequest, listFriends, friendLeaderboard, createDuel, listDuels, createProjectDuel, listProjectDuels, submitProjectEntry, evaluateProject, type SocialProfile, type FriendEntry, type DuelRow, type ProjectDuelRow, type ProjectEvaluation } from '@/services/social'
import { translateWithFallback, lookupDictionary, pronounce } from '@/services/translate'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

const NAV: {id:View; label:string; icon:typeof Home}[] = [
  {id:'inicio',label:'Início',icon:Home},{id:'aprender',label:'Aprender',icon:BookOpen},
  {id:'flashcards',label:'Flashcards',icon:Layers},{id:'documentos',label:'Documentos',icon:FileText},
  {id:'agenda',label:'Agenda',icon:CalendarDays},{id:'projetos',label:'Projetos',icon:FolderGit2},
  {id:'ranking',label:'Ranking',icon:Trophy},{id:'amigos',label:'Amigos',icon:Users},{id:'loja',label:'Loja',icon:ShoppingBag},
]

const PACES = [
  {id:'casual' as const, label:'Casual', time:'1 hora por dia', goal:30, desc:'Ideal para manter contato leve com o código, testar pequenas funções ou revisar conceitos sem esgotar a mente. Progresso lento, mas constante ao longo de anos.'},
  {id:'regular' as const, label:'Regular', time:'2 a 3 horas por dia', goal:50, desc:'O ritmo mais recomendado e sustentável para quem trabalha ou faz faculdade. Permite criar projetos reais e absorver bem a base teórica e prática em médio prazo.'},
  {id:'serio' as const, label:'Sério', time:'4 a 5 horas por dia', goal:80, desc:'Ritmo de transição profissional acelerada. Exige excelente gestão de tempo e foco total (horas líquidas), viabilizando a entrada no mercado ou domínio de tecnologias complexas em poucos meses.'},
  {id:'insano' as const, label:'Insano', time:'6 horas ou mais por dia', goal:120, desc:'Ritmo de alta exaustão e risco de burnout. O cérebro tem limite de foco profundo; sustentável só por curtos períodos (vésperas de prazos extremos ou bootcamps intensivos).'},
]

// ===== ofensiva REAL: conta dias consecutivos de estudo =====
function registerStudyDay(profile: UserProfile): UserProfile {
  const today = new Date().toISOString().slice(0,10)
  const last = localStorage.getItem('duoti.lastStudy')
  if (last === today) return profile
  const yesterday = new Date(Date.now()-864e5).toISOString().slice(0,10)
  const streak = last === yesterday ? profile.streak + 1 : 1
  localStorage.setItem('duoti.lastStudy', today)
  return { ...profile, streak }
}

export function DuoTIApp() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE)
  const [view, setView] = useState<View>('inicio')
  const [worldId, setWorldId] = useState<WorldId>('academic')
  const [menuOpen, setMenuOpen] = useState(false)
  const [logged, setLogged] = useState(false)
  const [booted, setBooted] = useState(false)
  const [activeLesson, setActiveLesson] = useState<{trackId:string;n:number}|null>(null)
  const [contentIndex, setContentIndex] = useState<ContentIndex|null>(null)
  const [mascotState, setMascotState] = useState<MascotState>('feliz')
  const [toast, setToast] = useState('')
  const install = useInstallPrompt()

  useEffect(() => {
    // Reset único: apaga qualquer dado de versões antigas (perfis demonstrativos, XP fake etc.)
    if (localStorage.getItem('duoti.dataVersion') !== '4') {
      Object.keys(localStorage).filter(k=>k.startsWith('duoti.')).forEach(k=>localStorage.removeItem(k))
      localStorage.setItem('duoti.dataVersion','4')
    }
    const p = loadProfile(); setProfile(p)
    setLogged(localStorage.getItem('duoti.logged') === 'true')
    setBooted(true)
    applyPalette(loadPalette())
    loadContentIndex().then(setContentIndex).catch(()=>{})
  }, [])

  const world = WORLDS.find(w=>w.id===worldId) || WORLDS[0]
  function notify(message:string){setToast(message); window.setTimeout(()=>setToast(''),3200)}
  function navTo(id:View){setView(id);setMenuOpen(false)}
  function finishLogin(p:Partial<UserProfile>){
    const next={...profile,...p};setProfile(next);saveProfile(next)
    localStorage.setItem('duoti.logged','true');setLogged(true)
    setMascotState('conectando');setTimeout(()=>setMascotState('feliz'),1600)
  }
  async function logout(){
    const sb=getSupabase(); if(sb) await sb.auth.signOut().catch(()=>{})
    clearSession(); setLogged(false); setView('inicio')
    notify('Você saiu da conta. Até a próxima!')
  }
  function startNextLesson(){
    if(!contentIndex){navTo('aprender');return}
    const done=getCompleted()
    const targetWorld=worldId==='english'?'english':'academic'
    const tracks=contentIndex.tracks.filter(t=>t.world===targetWorld)
    for(const t of tracks){const l=t.lessons.find(ls=>!done[ls.slug]);if(l){setActiveLesson({trackId:t.id,n:l.n});return}}
    notify('Você já concluiu todas as lições deste mundo! 🎉')
  }

  if (!booted) return null
  if (!logged) return <Onboarding onDone={finishLogin} install={install}/>
  if (activeLesson) return <LessonPlayer trackId={activeLesson.trackId} n={activeLesson.n} dailyXp={profile.dailyXp} onClose={()=>setActiveLesson(null)} onComplete={(earned,perfect)=>{let next={...profile,xp:profile.xp+earned,dailyXp:profile.dailyXp+earned,gems:profile.gems+(perfect?18:12)};next=registerStudyDay(next);setProfile(next);saveProfile(next);setActiveLesson(null);setMascotState('apaixonado');notify(perfect?`Lição perfeita! +${earned} XP e +18 gems`:`Lição concluída! +${earned} XP e +12 gems`)}} />

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen?'sidebar--open':''}`}>
      <button className="sidebar__close" onClick={()=>setMenuOpen(false)} aria-label="Fechar menu"><X/></button>
      <button className="brand" onClick={()=>navTo('inicio')}><span className="brand__mark">&lt;/&gt;</span><span>Duolingo <b>da TI</b></span></button>
      <nav className="sidebar__nav" aria-label="Navegação principal">
        {NAV.map(item=><button key={item.id} className={view===item.id?'is-active':''} onClick={()=>navTo(item.id)}><item.icon size={21}/><span>{item.label}</span></button>)}
      </nav>
      <section className="sidebar__streak"><Mascot state={mascotState} size="sm"/><div><strong>Devito acredita em você!</strong><span>{profile.dailyXp>=profile.dailyGoal?'Meta de hoje batida! 🎉':`Mais ${profile.dailyGoal-profile.dailyXp} XP para sua meta.`}</span></div></section>
      <button className="sidebar__settings" onClick={()=>navTo('config')}><Settings size={19}/>Configurações</button>
    </aside>
    {menuOpen&&<button className="sidebar-backdrop" aria-label="Fechar menu" onClick={()=>setMenuOpen(false)}/>}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button topbar__menu" onClick={()=>setMenuOpen(true)} aria-label="Abrir menu"><Menu/></button>
        <div className="topbar__mobile-brand"><span className="brand__mark">&lt;/&gt;</span> duoTI</div>
        <label className="search-box"><Search size={18}/><input aria-label="Pesquisar" placeholder="Buscar lições, trilhas..."/><kbd>⌘ K</kbd></label>
        <div className="topbar__stats"><span title="Ofensiva"><Flame size={19}/><b>{profile.streak}</b></span><span title="Gems"><Gem size={19}/><b>{profile.gems}</b></span></div>
        {!install.installed&&<button className="icon-button" title="Instalar app no celular/PC" aria-label="Instalar app" onClick={install.install}><Download size={19}/></button>}
        <ThemeToggle/><button className="icon-button notification-button" aria-label="Notificações"><Bell size={19}/></button>
        <button className="profile-trigger" onClick={()=>navTo('perfil')}><Avatar profile={profile}/><span><b>{profile.name||'Você'}</b><small>Nível {Math.floor(profile.xp/500)+1}</small></span><ChevronDown size={16}/></button>
      </header>
      <section className="content-area">
        {view==='inicio'&&<Dashboard profile={profile} world={world} setWorld={setWorldId} startLesson={startNextLesson} mascotState={mascotState}/>}
        {view==='aprender'&&<LearnView index={contentIndex} worldId={worldId} setWorld={setWorldId} openLesson={(trackId,n)=>setActiveLesson({trackId,n})}/>}
        {view==='flashcards'&&<FlashcardsView notify={notify}/>}
        {view==='documentos'&&<DocumentsView profile={profile} onProfile={p=>{setProfile(p);saveProfile(p)}} notify={notify}/>}
        {view==='agenda'&&<AgendaView notify={notify}/>}
        {view==='projetos'&&<ProjectsView/>}
        {view==='ranking'&&<RankingView profile={profile}/>}
        {view==='amigos'&&<FriendsView notify={notify} contentIndex={contentIndex}/>}
        {view==='loja'&&<ShopView gems={profile.gems} buy={(cost,name)=>{if(profile.gems<cost)return notify('Você ainda não tem gems suficientes. Complete lições para ganhar!');const next={...profile,gems:profile.gems-cost};setProfile(next);saveProfile(next);notify(`${name} desbloqueado!`)}}/>}
        {view==='perfil'&&<ProfileView profile={profile} onSave={p=>{setProfile(p);saveProfile(p);notify('Perfil atualizado com sucesso!')}}/>}
        {view==='config'&&<SettingsView profile={profile} onSave={p=>{setProfile(p);saveProfile(p)}} onLogout={logout} notify={notify} install={install}/>}
      </section>
    </main>
    <Tutor/>
    {toast&&<div className="toast"><Sparkles size={18}/>{toast}</div>}
  </div>
}

function Avatar({profile,size='normal'}:{profile:UserProfile,size?:'normal'|'large'}){const initials=(profile.name||'?').split(' ').map(n=>n[0]).slice(0,2).join('');return profile.avatarUrl?<img className={`avatar avatar--${size}`} src={profile.avatarUrl} alt={`Foto de ${profile.name}`}/>:<span className={`avatar avatar--${size} avatar--fallback`}>{initials}</span>}

// ============================================================
// ONBOARDING estilo Duolingo: splash → curso → ritmo → conta
// ============================================================
function Onboarding({onDone,install}:{onDone:(p:Partial<UserProfile>)=>void;install:{canInstall:boolean;installed:boolean;install:()=>void}}){
  const [step,setStep]=useState<'splash'|'course'|'goal'|'auth'>('splash')
  const [course,setCourse]=useState<WorldId>('academic')
  const [pace,setPace]=useState<typeof PACES[number]['id']>('regular')
  const [mode,setMode]=useState<'login'|'register'>('register')
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [err,setErr]=useState('');const [busy,setBusy]=useState(false)

  async function submit(e:React.FormEvent){
    e.preventDefault();setErr('');setBusy(true)
    const supabase=getSupabase()
    if(supabase){
      const result=mode==='register'
        ? await supabase.auth.signUp({email,password,options:{data:{name}}})
        : await supabase.auth.signInWithPassword({email,password})
      if(result.error){setErr(result.error.message);setBusy(false);return}
    }
    const chosen=PACES.find(p=>p.id===pace)!
    onDone({name:name||email.split('@')[0],email,username:(name||email.split('@')[0]).toLowerCase().replace(/\s+/g,'.'),pace,goalWorld:course,dailyGoal:chosen.goal})
  }

  if(step==='splash')return <main className="ob ob--splash">
    <div className="ob-splash-center">
      <span className="ob-logo">&lt;/&gt;</span>
      <h1 className="ob-wordmark">duolingo <b>da TI</b></h1>
      <p>Aprenda Engenharia de Software e Inglês Técnico. De graça. Para sempre.</p>
    </div>
    <div className="ob-splash-actions">
      <button className="ob-btn ob-btn--white" onClick={()=>{setMode('register');setStep('course')}}>Começar agora</button>
      <button className="ob-btn ob-btn--ghost" onClick={()=>{setMode('login');setStep('auth')}}>Já tenho uma conta</button>
      {!install.installed&&<button className="ob-install" onClick={install.install}><Download size={15}/> Baixar o app no celular</button>}
    </div>
  </main>

  if(step==='course')return <main className="ob ob--list">
    <header className="ob-top"><button onClick={()=>setStep('splash')} aria-label="Voltar">‹</button><h2>Escolha um curso</h2><i/></header>
    <div className="ob-list">
      {[{id:'academic' as WorldId,name:'Engenharia de Software',desc:'Lógica, algoritmos, bancos de dados, DevOps, testes e mais — 10 disciplinas',icon:<GraduationCap/>},
        {id:'english' as WorldId,name:'Inglês Técnico',desc:'Do A1 ao C2 com vocabulário de tecnologia, listening e escrita',icon:<MessageCircle/>}].map(c=>
        <button key={c.id} className="ob-row" onClick={()=>{setCourse(c.id);setStep('goal')}}>
          <span className="ob-row__icon">{c.icon}</span>
          <div><strong>{c.name}</strong><small>{c.desc}</small></div>
          <ChevronRight size={18}/>
        </button>)}
    </div>
    <p className="ob-hint">Você poderá alternar entre os cursos a qualquer momento.</p>
  </main>

  if(step==='goal')return <main className="ob ob--list">
    <header className="ob-top"><button onClick={()=>setStep('course')} aria-label="Voltar">‹</button><h2>Escolha uma meta</h2><i/></header>
    <div className="ob-list">
      {PACES.map(p=><button key={p.id} className={`ob-goal ${pace===p.id?'is-active':''}`} onClick={()=>setPace(p.id)}>
        <i className="ob-radio">{pace===p.id&&<b/>}</i>
        <div><strong>{p.label} <span>· {p.time}</span></strong><small>{p.desc}</small></div>
      </button>)}
    </div>
    <div className="ob-goal-mascot"><Mascot state="feliz" size="sm"/><span className="speech-bubble">Você pode mudar a meta depois, em Configurações.</span></div>
    <button className="ob-btn ob-btn--green" onClick={()=>setStep('auth')}>DEFINIR META</button>
  </main>

  return <main className="ob ob--auth">
    <header className="ob-top"><button onClick={()=>setStep(mode==='login'?'splash':'goal')} aria-label="Voltar">‹</button><h2>{mode==='login'?'Entrar':'Criar perfil'}</h2><i/></header>
    <div className="ob-auth-card">
      <Mascot state="apaixonado" size="sm"/>
      <h1>{mode==='login'?'Bom te ver de volta!':'Falta pouco para começar'}</h1>
      <form onSubmit={submit}>
        {mode==='register'&&<label>Seu nome<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Como devemos te chamar?"/></label>}
        <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com"/></label>
        <label>Senha<input required type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"/></label>
        {err&&<p className="ob-error">{err}</p>}
        <button className="ob-btn ob-btn--green" disabled={busy}>{busy?'Aguarde…':mode==='login'?'ENTRAR':'CRIAR CONTA'}</button>
      </form>
      <button className="text-button" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Não tem conta? Criar agora':'Já tem conta? Entrar'}</button>
      <small>Sem Supabase configurado, a conta funciona apenas neste dispositivo.</small>
    </div>
  </main>
}

// ============================================================
// DASHBOARD (sem números falsos — tudo vem do perfil real)
// ============================================================
function Dashboard({profile,world,setWorld,startLesson,mascotState}:{profile:UserProfile;world:(typeof WORLDS)[0];setWorld:(id:WorldId)=>void;startLesson:()=>void;mascotState:MascotState}){
 const progress=profile.dailyGoal?Math.min(100,Math.round(profile.dailyXp/profile.dailyGoal*100)):0
 const today=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()
 return <><section className="welcome-row"><div><p className="eyebrow">{today}</p><h1>Bom te ver{profile.name?`, ${profile.name.split(' ')[0]}`:''}! <span>👋</span></h1><p>Seu próximo nível está a uma lição de distância.</p></div><div className="welcome-mascot"><Mascot state={mascotState} size="sm"/><span>Vamos codar?</span></div></section>
 <section className="stat-grid">
  <article className="stat-card stat-card--goal"><header><span className="stat-icon"><Zap/></span><div><small>Meta diária ({profile.pace||'regular'})</small><strong>{profile.dailyXp} / {profile.dailyGoal} XP</strong></div><b>{progress}%</b></header><div className="progress"><i style={{width:`${progress}%`}}/></div><footer>{progress>=100?'Meta batida! Continue se quiser ir além.':`Faltam ${Math.max(0,profile.dailyGoal-profile.dailyXp)} XP para bater sua meta`}</footer></article>
  <article className="stat-card"><span className="stat-icon stat-icon--fire"><Flame/></span><div><small>Ofensiva atual</small><strong>{profile.streak} {profile.streak===1?'dia':'dias'}</strong><p>{profile.streak===0?'Complete uma lição hoje!':'Não deixe a chama apagar'}</p></div></article>
  <article className="stat-card"><span className="stat-icon stat-icon--league"><Medal/></span><div><small>XP total</small><strong>{profile.xp.toLocaleString('pt-BR')} XP</strong><p>Nível {Math.floor(profile.xp/500)+1}</p></div></article>
  <article className="stat-card"><span className="stat-icon stat-icon--gem"><Gem/></span><div><small>Saldo</small><strong>{profile.gems} gems</strong><p>Ganhe completando lições</p></div></article>
 </section>
 <div className="dashboard-grid">
  <section className="learning-panel"><header className="section-heading"><div><span className="eyebrow">SUA JORNADA</span><h2>Continue aprendendo</h2></div></header>
   <div className="world-tabs">{WORLDS.filter(w=>w.id!=='bootcamp').map(w=><button key={w.id} className={world.id===w.id?'is-active':''} onClick={()=>setWorld(w.id)} style={{'--world':w.color} as React.CSSProperties}>{w.id==='academic'?<GraduationCap/>:<MessageCircle/>}<span>{w.name}<small>{w.short}</small></span></button>)}</div>
   <article className="continue-card" style={{'--world':world.color} as React.CSSProperties}><span className="continue-card__icon"><Play/></span><div><strong>Próxima lição disponível</strong><small>{world.description}</small></div><button className="primary-button" onClick={startLesson}><Play size={17}/>Continuar</button></article>
  </section>
  <div className="right-column"><GoalCard profile={profile}/><VocabCard/></div>
 </div></>
}

function GoalCard({profile}:{profile:UserProfile}){
 const paceInfo=PACES.find(p=>p.id===(profile.pace||'regular'))
 return <article className="side-card"><header><div><span className="eyebrow">SEU RITMO</span><h3>{paceInfo?.label} · {paceInfo?.time}</h3></div><Zap/></header><p style={{fontSize:12.5,color:'var(--muted)',lineHeight:1.7}}>{paceInfo?.desc}</p></article>
}
function VocabCard(){
 const [count,setCount]=useState(0)
 useEffect(()=>{setCount(getVocabulary().length)},[])
 return <article className="side-card"><header><div><span className="eyebrow">GLOSSÁRIO</span><h3>{count} {count===1?'termo salvo':'termos salvos'}</h3></div><BookOpen/></header><p style={{fontSize:12.5,color:'var(--muted)'}}>{count===0?'Complete lições para colecionar vocabulário técnico automaticamente.':'Revise seus termos na aba Flashcards.'}</p></article>
}

// ============================================================
// APRENDER — trilhas e lições REAIS do motor de conteúdo
// ============================================================
function LearnView({index,worldId,setWorld,openLesson}:{index:ContentIndex|null;worldId:WorldId;setWorld:(id:WorldId)=>void;openLesson:(trackId:string,n:number)=>void}){
  const [openTrack,setOpenTrack]=useState<string>('')
  const done=getCompleted()
  const targetWorld=worldId==='english'?'english':'academic'
  const tracks=index?index.tracks.filter(t=>t.world===targetWorld):[]
  const worldMeta=WORLDS.find(w=>w.id===worldId)||WORLDS[0]
  return <section className="page-view learn-view bg-anim">
    <header className="page-title"><div><span className="eyebrow">MAPA DE APRENDIZADO</span><h1>Escolha sua jornada</h1><p>{index?`${index.tracks.length} trilhas e ${index.tracks.reduce((s,t)=>s+t.lessons.length,0)} lições reais de Engenharia de Software e Inglês Técnico.`:'Carregando trilhas…'}</p></div></header>
    <div className="world-selector">{WORLDS.filter(w=>w.id!=='bootcamp').map(w=><button key={w.id} className={w.id===worldMeta.id?'is-active':''} style={{'--world':w.color} as React.CSSProperties} onClick={()=>setWorld(w.id)}><span>{w.id==='academic'?<GraduationCap/>:<MessageCircle/>}</span><div><strong>{w.name}</strong><small>{w.short}</small></div></button>)}</div>
    {!index&&<article className="map-panel"><header><div><h2>Preparando conteúdo…</h2><p>Se isso persistir, rode <code>node scripts/build-content-index.mjs</code>.</p></div></header></article>}
    <div className="track-list">
      {tracks.map(t=>{
        const completedCount=t.lessons.filter(l=>done[l.slug]).length
        const nextLesson=t.lessons.find(l=>!done[l.slug])
        const expanded=openTrack===t.id
        return <article key={t.id} className={`track-card ${expanded?'is-open':''}`} style={{'--world':t.color} as React.CSSProperties}>
          <button className="track-card__head" onClick={()=>setOpenTrack(expanded?'':t.id)} aria-expanded={expanded}>
            <span className="track-card__icon"><BookOpen/></span>
            <div><strong>{t.name}{t.cefr?` · ${t.cefr}`:''}</strong><small>{t.description}</small></div>
            <div className="track-card__meta"><b>{completedCount}/{t.lessons.length}</b><div className="progress"><i style={{width:`${Math.round(completedCount/t.lessons.length*100)}%`}}/></div></div>
            <ChevronDown className={expanded?'rot':''} size={18}/>
          </button>
          {expanded&&<div className="track-card__lessons">
            {t.lessons.map((l)=>{
              const isDone=!!done[l.slug]
              const isCurrent=nextLesson?.slug===l.slug
              const locked=!isDone&&!isCurrent
              return <button key={l.slug} className={`track-lesson ${isDone?'is-done':isCurrent?'is-current':'is-locked'}`} disabled={locked} onClick={()=>!locked&&openLesson(t.id,l.n)}>
                <i>{isDone?'✓':locked?<LockKeyhole size={15}/>:<Play size={15}/>}</i>
                <div><strong>Lição {l.n}: {l.title}</strong><small>{l.has?`+${l.xp} XP · conteúdo pronto`:'conteúdo será gerado pelo motor (scripts/generate-content.mjs)'}</small></div>
              </button>
            })}
          </div>}
        </article>
      })}
    </div>
  </section>
}

// ============================================================
// FLASHCARDS + VOCABULÁRIO (tradução/dicionário/pronúncia sem key)
// ============================================================
function FlashcardsView({notify}:{notify:(s:string)=>void}){
  const [cards,setCards]=useState<Flashcard[]>([])
  const [tab,setTab]=useState<'estudar'|'novo'|'vocabulario'>('estudar')
  const [word,setWord]=useState('');const [busy,setBusy]=useState(false)
  const [result,setResult]=useState<{translation:string;source:string;phonetic:string;audioUrl:string;meanings:{partOfSpeech:string;definition:string;example:string}[]}|null>(null)
  const [studyIdx,setStudyIdx]=useState(0);const [flipped,setFlipped]=useState(false)
  useEffect(()=>{setCards(loadFlashcards())},[])
  const due=cards.filter(c=>new Date(c.nextReview)<=new Date())
  const current=due[studyIdx%Math.max(1,due.length)]

  async function search(){
    if(!word.trim())return
    setBusy(true);setResult(null)
    try{
      const [tr,dict]=await Promise.all([
        translateWithFallback(word.trim(),'en','pt').catch(()=>null),
        lookupDictionary(word.trim()),
      ])
      setResult({
        translation:tr?.text||'(tradução indisponível no momento)',
        source:tr?.source||'-',
        phonetic:dict?.phonetic||'',
        audioUrl:dict?.audioUrl||'',
        meanings:dict?.meanings||[],
      })
    }catch(e){notify(e instanceof Error?e.message:'Falha na busca')}
    setBusy(false)
  }
  function addCard(){
    if(!result)return
    const card:Flashcard={id:crypto.randomUUID(),front:word.trim(),back:result.translation,example:result.meanings[0]?.example||result.meanings[0]?.definition||'',phonetic:result.phonetic,lang:'en',box:1,nextReview:new Date().toISOString(),createdAt:new Date().toISOString()}
    const next=[...cards,card];setCards(next);saveFlashcards(next)
    notify(`"${word}" adicionado aos flashcards!`);setWord('');setResult(null)
  }
  function grade(ok:boolean){
    if(!current)return
    const boxes=[0,1,3,7,16,35] // dias por caixa (repetição espaçada)
    const box=ok?Math.min(current.box+1,5):1
    const next=cards.map(c=>c.id===current.id?{...c,box,nextReview:new Date(Date.now()+boxes[box]*864e5).toISOString()}:c)
    setCards(next);saveFlashcards(next);setFlipped(false);setStudyIdx(i=>i+1)
  }
  function importVocabulary(){
    const vocab=getVocabulary()
    const existing=new Set(cards.map(c=>c.front.toLowerCase()))
    const news=vocab.filter(v=>!existing.has(v.term.toLowerCase())).map(v=>({id:crypto.randomUUID(),front:v.term,back:v.definition,example:v.example,phonetic:'',lang:'en',box:1,nextReview:new Date().toISOString(),createdAt:new Date().toISOString()}))
    if(news.length===0)return notify('Nenhum termo novo do glossário para importar.')
    const next=[...cards,...news];setCards(next);saveFlashcards(next)
    notify(`${news.length} termos do glossário viraram flashcards!`)
  }

  return <section className="page-view">
    <header className="page-title"><div><span className="eyebrow">MEMORIZAÇÃO</span><h1>Flashcards & Vocabulário</h1><p>Tradução, dicionário e pronúncia com APIs gratuitas — sem chave nenhuma.</p></div><button className="primary-button" onClick={importVocabulary}><Plus/>Importar do glossário</button></header>
    <div className="auth-tabs" style={{maxWidth:440,gridTemplateColumns:'1fr 1fr 1fr'}}>
      <button className={tab==='estudar'?'is-active':''} onClick={()=>setTab('estudar')}>Estudar ({due.length})</button>
      <button className={tab==='novo'?'is-active':''} onClick={()=>setTab('novo')}>Nova palavra</button>
      <button className={tab==='vocabulario'?'is-active':''} onClick={()=>setTab('vocabulario')}>Todos ({cards.length})</button>
    </div>

    {tab==='estudar'&&(due.length===0
      ?<article className="empty-state"><Mascot state="feliz" size="md"/><h2>Nada para revisar agora!</h2><p>Adicione palavras novas ou importe o glossário das lições. As revisões seguem repetição espaçada (caixas de Leitner).</p></article>
      :<article className="fc-study">
        <button className={`fc-card ${flipped?'is-flipped':''}`} onClick={()=>setFlipped(!flipped)}>
          <span className="fc-face fc-face--front"><strong>{current.front}</strong>{current.phonetic&&<small>{current.phonetic}</small>}<em>toque para virar</em></span>
          <span className="fc-face fc-face--back"><strong>{current.back}</strong>{current.example&&<small>{current.example}</small>}</span>
        </button>
        <div className="fc-actions">
          <button className="icon-button" title="Ouvir pronúncia" onClick={(e)=>{e.stopPropagation();pronounce(current.front)}}><Volume2/></button>
          {flipped&&<><button className="fc-btn fc-btn--no" onClick={()=>grade(false)}>Errei</button><button className="fc-btn fc-btn--yes" onClick={()=>grade(true)}>Acertei</button></>}
        </div>
        <small style={{color:'var(--muted)'}}>{due.length} para revisar · caixa {current.box}/5</small>
      </article>)}

    {tab==='novo'&&<article className="fc-new">
      <div className="fc-search"><input value={word} onChange={e=>setWord(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Digite uma palavra em inglês (ex.: deploy, thread, cache)"/><button className="primary-button" disabled={busy} onClick={search}>{busy?'Buscando…':'Buscar'}</button></div>
      {result&&<div className="fc-result">
        <header><h2>{word} {result.phonetic&&<small>{result.phonetic}</small>}</h2><button className="icon-button" title="Ouvir pronúncia" onClick={()=>pronounce(word,result.audioUrl)}><Volume2/></button></header>
        <p className="fc-translation"><b>Tradução:</b> {result.translation} <small>(via {result.source})</small></p>
        {result.meanings.map((m,i)=><p key={i} className="fc-meaning"><i>{m.partOfSpeech}</i> {m.definition}{m.example&&<em> — “{m.example}”</em>}</p>)}
        <button className="primary-button" onClick={addCard}><Plus/>Salvar como flashcard</button>
      </div>}
    </article>}

    {tab==='vocabulario'&&<div className="fc-list">
      {cards.length===0&&<article className="empty-state"><h2>Sem flashcards ainda</h2><p>Busque palavras na aba "Nova palavra" ou importe o glossário das lições concluídas.</p></article>}
      {cards.map(c=><article key={c.id} className="fc-row"><div><strong>{c.front}</strong><small>{c.back}</small></div><span>caixa {c.box}</span><button className="icon-button" title="Ouvir" onClick={()=>pronounce(c.front)}><Volume2 size={16}/></button><button className="icon-button" title="Excluir" onClick={()=>{const next=cards.filter(x=>x.id!==c.id);setCards(next);saveFlashcards(next)}}><Trash2 size={16}/></button></article>)}
    </div>}
  </section>
}

// ============================================================
// DOCUMENTOS — anexos que atualizam o perfil e ensinam o tutor
// ============================================================
function DocumentsView({profile,onProfile,notify}:{profile:UserProfile;onProfile:(p:UserProfile)=>void;notify:(s:string)=>void}){
  const [docs,setDocs]=useState<UserDocument[]>([])
  const [busy,setBusy]=useState(false)
  const [kind,setKind]=useState<UserDocument['kind']>('certificado')
  const [title,setTitle]=useState('');const [desc,setDesc]=useState('')
  useEffect(()=>{setDocs(loadDocuments())},[])

  async function readFile(f:File):Promise<string>{
    if(f.type==='application/pdf'){
      // extração leve: pega strings legíveis do PDF (sem lib externa)
      const buf=new Uint8Array(await f.arrayBuffer())
      let txt='';for(let i=0;i<buf.length&&txt.length<40000;i++){const c=buf[i];if(c>=32&&c<127)txt+=String.fromCharCode(c)}
      const readable=(txt.match(/[A-Za-zÀ-ÿ]{3,}[^()<>{}\[\]]*?/g)||[]).join(' ')
      return readable.slice(0,20000)
    }
    return (await f.text()).slice(0,20000)
  }

  async function addDoc(e:React.FormEvent){
    e.preventDefault()
    const input=(e.target as HTMLFormElement).querySelector('input[type=file]') as HTMLInputElement
    const f=input?.files?.[0]
    if(!title.trim())return notify('Dê um título ao documento.')
    setBusy(true)
    let text=desc
    let fileName:string|undefined
    if(f){fileName=f.name;try{text=`${desc}\n\n${await readFile(f)}`}catch{/* segue só com a descrição */}}
    // Sistema APRENDE com o documento (IA ou heurística local)
    let analysis:{summary?:string;skills?:string[];bioSuggestion?:string|null;knowledge?:string}={}
    try{
      const res=await fetch('/api/analyze-document',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,kind,text})})
      if(res.ok)analysis=await res.json()
    }catch{/* offline */}
    const doc:UserDocument={id:crypto.randomUUID(),kind,title:title.trim(),description:analysis.summary||desc,skills:analysis.skills||[],fileName,textContent:text.slice(0,8000),addedAt:new Date().toISOString()}
    const next=[doc,...docs];setDocs(next);saveDocuments(next)
    // Atualiza AUTOMATICAMENTE o perfil: skills novas + bio sugerida
    const newSkills=[...new Set([...profile.skills,...(analysis.skills||[])])]
    const updated={...profile,skills:newSkills,...(analysis.bioSuggestion&&!profile.bio?{bio:analysis.bioSuggestion}:{})}
    onProfile(updated)
    // Tutor aprende os fatos extraídos
    if(analysis.knowledge)appendTutorKnowledge(`[${kind}: ${title}] ${analysis.knowledge}`)
    else appendTutorKnowledge(`[${kind}] O aluno anexou "${title}"${analysis.skills?.length?` envolvendo ${analysis.skills.join(', ')}`:''}.`)
    setTitle('');setDesc('');if(input)input.value=''
    setBusy(false)
    notify(`Documento analisado! ${analysis.skills?.length?`${analysis.skills.length} skills detectadas e adicionadas ao perfil.`:'Registrado com sucesso.'}`)
  }

  return <section className="page-view">
    <header className="page-title"><div><span className="eyebrow">SEU ACERVO</span><h1>Documentos & Conquistas</h1><p>Anexe PDFs, certificados, aulas assistidas e projetos. O sistema analisa, atualiza seu perfil automaticamente e o tutor aprende com o conteúdo.</p></div></header>
    <form className="doc-form" onSubmit={addDoc}>
      <div className="form-grid">
        <label>Tipo<select value={kind} onChange={e=>setKind(e.target.value as UserDocument['kind'])}><option value="certificado">Certificado</option><option value="pdf">PDF / Apostila</option><option value="aula">Aula assistida</option><option value="projeto">Projeto feito</option><option value="outro">Outro</option></select></label>
        <label>Título<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Certificado AWS Cloud Practitioner"/></label>
        <label>Descrição (opcional)<input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="O que você aprendeu?"/></label>
        <label>Arquivo (PDF ou texto, opcional)<input type="file" accept=".pdf,.txt,.md,.json"/></label>
      </div>
      <button className="primary-button" disabled={busy}>{busy?'Analisando…':'Adicionar e analisar'}</button>
    </form>
    <div className="doc-list">
      {docs.length===0&&<article className="empty-state"><Mascot state="programando" size="md"/><h2>Nenhum documento ainda</h2><p>Cada anexo enriquece seu perfil (skills, bio) e dá contexto ao tutor de IA.</p></article>}
      {docs.map(d=><article key={d.id} className="doc-row">
        <span className={`doc-kind doc-kind--${d.kind}`}><FileText size={16}/></span>
        <div><strong>{d.title}</strong><small>{d.description||d.kind}</small>{d.skills.length>0&&<div className="tag-list">{d.skills.map(s=><i key={s}>{s}</i>)}</div>}</div>
        <time>{new Date(d.addedAt).toLocaleDateString('pt-BR')}</time>
        <button className="icon-button" title="Remover" onClick={()=>{const next=docs.filter(x=>x.id!==d.id);setDocs(next);saveDocuments(next)}}><Trash2 size={16}/></button>
      </article>)}
    </div>
  </section>
}

// ============================================================
// AGENDA personalizada de estudos
// ============================================================
const DAYS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
function AgendaView({notify}:{notify:(s:string)=>void}){
  const [slots,setSlots]=useState<ScheduleSlot[]>([])
  const [day,setDay]=useState(1);const [start,setStart]=useState('19:00');const [end,setEnd]=useState('20:00');const [topic,setTopic]=useState('')
  useEffect(()=>{setSlots(loadSchedule())},[])
  function add(e:React.FormEvent){
    e.preventDefault()
    if(!topic.trim())return notify('Diga o que vai estudar nesse horário.')
    const next=[...slots,{id:crypto.randomUUID(),day,start,end,topic:topic.trim()}].sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start))
    setSlots(next);saveSchedule(next);setTopic('')
    notify('Horário adicionado à sua agenda!')
  }
  return <section className="page-view">
    <header className="page-title"><div><span className="eyebrow">ROTINA</span><h1>Agenda de estudos</h1><p>Monte sua grade semanal. Constância vale mais que intensidade.</p></div></header>
    <form className="doc-form" onSubmit={add}>
      <div className="form-grid form-grid--4">
        <label>Dia<select value={day} onChange={e=>setDay(Number(e.target.value))}>{DAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>
        <label>Início<input type="time" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label>Fim<input type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label>
        <label>O que estudar<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Ex.: Estruturas de Dados — lição 4"/></label>
      </div>
      <button className="primary-button"><Plus/>Adicionar horário</button>
    </form>
    <div className="agenda-grid">
      {DAYS.map((d,i)=><div key={d} className={`agenda-day ${new Date().getDay()===i?'is-today':''}`}>
        <h3>{d}</h3>
        {slots.filter(s=>s.day===i).map(s=><article key={s.id} className="agenda-slot"><b>{s.start}–{s.end}</b><span>{s.topic}</span><button aria-label="Remover" onClick={()=>{const next=slots.filter(x=>x.id!==s.id);setSlots(next);saveSchedule(next)}}><X size={13}/></button></article>)}
        {slots.filter(s=>s.day===i).length===0&&<small>livre</small>}
      </div>)}
    </div>
  </section>
}

// ============================================================
// AMIGOS — 100% REAL via Supabase (sem bots) + duelos
// ============================================================
function FriendsView({notify,contentIndex}:{notify:(s:string)=>void;contentIndex:ContentIndex|null}){
  const available=socialAvailable()
  const [friends,setFriends]=useState<FriendEntry[]>([])
  const [results,setResults]=useState<SocialProfile[]>([])
  const [query,setQuery]=useState('');const [busy,setBusy]=useState(false)
  const [tab,setTab]=useState<'amigos'|'duelos'|'projetos'>('amigos')
  const [duels,setDuels]=useState<DuelRow[]>([])
  const [pduels,setPduels]=useState<ProjectDuelRow[]>([])
  const [loadErr,setLoadErr]=useState('')

  async function refresh(){
    try{
      const [f,d,p]=await Promise.all([listFriends(),listDuels(),listProjectDuels()])
      setFriends(f);setDuels(d);setPduels(p);setLoadErr('')
    }catch(e){setLoadErr(e instanceof Error?e.message:'erro')}
  }
  useEffect(()=>{if(available)refresh()},[available]) // eslint-disable-line react-hooks/exhaustive-deps

  async function search(){
    if(query.trim().length<2)return
    setBusy(true)
    try{setResults(await searchUsers(query))}catch(e){notify(e instanceof Error?e.message:'Busca falhou')}
    setBusy(false)
  }
  async function add(id:string){
    try{await sendFriendRequest(id);notify('Convite de amizade enviado!');refresh()}catch(e){notify(e instanceof Error?e.message:'Falhou')}
  }
  async function respond(fid:string,ok:boolean){
    try{await respondFriendRequest(fid,ok);notify(ok?'Amizade aceita!':'Convite recusado.');refresh()}catch(e){notify(e instanceof Error?e.message:'Falhou')}
  }
  async function challenge(opponent:string){
    const firstTrack=contentIndex?.tracks.find(t=>t.lessons.some(l=>l.has))
    const lesson=firstTrack?.lessons.find(l=>l.has)
    if(!firstTrack||!lesson)return notify('Gere conteúdo primeiro para poder duelar.')
    try{await createDuel(opponent,firstTrack.id,lesson.n);notify('Duelo criado! Ambos fazem a mesma lição — vence quem errar menos (e for mais rápido).');refresh()}catch(e){notify(e instanceof Error?e.message:'Falhou')}
  }

  if(!available)return <section className="page-view"><header className="page-title"><div><span className="eyebrow">APRENDA EM GRUPO</span><h1>Sua comunidade dev</h1></div></header>
    <article className="empty-state"><Mascot state="conectando" size="md"/><h2>Conecte o Supabase para o social real</h2><p>Sem dados falsos aqui: amigos, ranking e duelos usam contas reais. Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no <code>.env.local</code> e rode as migrations 0001–0003 no SQL Editor.</p></article></section>

  return <section className="page-view">
    <header className="page-title"><div><span className="eyebrow">APRENDA EM GRUPO</span><h1>Sua comunidade dev</h1><p>Amigos reais, duelos reais. Nada de bots.</p></div></header>
    {loadErr&&<article className="empty-state"><h2>As tabelas sociais ainda não existem</h2><p>Rode <code>supabase/migrations/0002_social.sql</code> e <code>0003_project_duels.sql</code> no SQL Editor do Supabase. Erro: {loadErr}</p></article>}
    <div className="auth-tabs" style={{maxWidth:440,gridTemplateColumns:'1fr 1fr 1fr'}}>
      <button className={tab==='amigos'?'is-active':''} onClick={()=>setTab('amigos')}>Amigos ({friends.filter(f=>f.status==='accepted').length})</button>
      <button className={tab==='duelos'?'is-active':''} onClick={()=>setTab('duelos')}>Duelos ({duels.length})</button>
      <button className={tab==='projetos'?'is-active':''} onClick={()=>setTab('projetos')}>Duelo de projetos</button>
    </div>

    {tab==='amigos'&&<>
      <div className="fc-search"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Buscar por nome ou @usuário (mín. 2 letras)"/><button className="primary-button" disabled={busy} onClick={search}><Search size={16}/>{busy?'…':'Buscar'}</button></div>
      {results.length>0&&<div className="doc-list">{results.map(r=><article key={r.id} className="doc-row"><span className="mini-avatar">{(r.name||'?').slice(0,2).toUpperCase()}</span><div><strong>{r.name}</strong><small>@{r.username||'sem-usuario'} · {r.xp_total} XP</small></div><button className="secondary-button" onClick={()=>add(r.id)}><UserPlus size={15}/>Adicionar</button></article>)}</div>}
      <div className="doc-list">
        {friends.filter(f=>f.status==='pending'&&f.direction==='received').map(f=><article key={f.friendshipId} className="doc-row doc-row--pending"><span className="mini-avatar">{(f.name||'?').slice(0,2).toUpperCase()}</span><div><strong>{f.name}</strong><small>quer ser seu amigo</small></div><button className="primary-button" onClick={()=>respond(f.friendshipId,true)}><Check size={15}/>Aceitar</button><button className="icon-button" onClick={()=>respond(f.friendshipId,false)}><X size={15}/></button></article>)}
        {friends.filter(f=>f.status==='accepted').map(f=><article key={f.friendshipId} className="doc-row"><span className="mini-avatar">{(f.name||'?').slice(0,2).toUpperCase()}</span><div><strong>{f.name}</strong><small>@{f.username||''} · {f.xp_total} XP · 🔥 {f.streak_days}</small></div><button className="secondary-button" onClick={()=>challenge(f.id)}><Swords size={15}/>Duelar</button></article>)}
        {friends.filter(f=>f.status==='pending'&&f.direction==='sent').map(f=><article key={f.friendshipId} className="doc-row" style={{opacity:.6}}><span className="mini-avatar">{(f.name||'?').slice(0,2).toUpperCase()}</span><div><strong>{f.name}</strong><small>convite enviado — aguardando</small></div></article>)}
        {friends.length===0&&!loadErr&&<article className="empty-state"><Mascot state="feliz" size="md"/><h2>Nenhum amigo ainda</h2><p>Busque pessoas pelo nome ou @usuário acima. Quando aceitas, aparecem aqui e no ranking de amigos.</p></article>}
      </div>
    </>}

    {tab==='duelos'&&<div className="doc-list">
      {duels.length===0&&<article className="empty-state"><Swords size={40}/><h2>Nenhum duelo ainda</h2><p>Desafie um amigo na aba Amigos: ambos fazem a mesma lição e vence quem errar menos.</p></article>}
      {duels.map(d=><article key={d.id} className="doc-row"><span className="doc-kind"><Swords size={16}/></span><div><strong>Duelo: {d.track_id} · lição {d.lesson_n}</strong><small>status: {d.status}{d.winner?` · vencedor definido`:''}</small></div></article>)}
    </div>}

    {tab==='projetos'&&<ProjectDuelPanel friends={friends.filter(f=>f.status==='accepted')} pduels={pduels} notify={notify} refresh={refresh}/>}
  </section>
}

// ===== Duelo de PROJETOS com avaliação IA 0–100 =====
function ProjectDuelPanel({friends,pduels,notify,refresh}:{friends:FriendEntry[];pduels:ProjectDuelRow[];notify:(s:string)=>void;refresh:()=>void}){
  const [opponent,setOpponent]=useState('');const [same,setSame]=useState(true)
  const [brief,setBrief]=useState('');const [brief2,setBrief2]=useState('');const [deadline,setDeadline]=useState('')
  const [repoUrl,setRepoUrl]=useState('');const [desc,setDesc]=useState('');const [evalBusy,setEvalBusy]=useState(false)
  const [evaluation,setEvaluation]=useState<ProjectEvaluation|null>(null)
  const [submitFor,setSubmitFor]=useState('')

  async function create(e:React.FormEvent){
    e.preventDefault()
    if(!opponent)return notify('Escolha um amigo para desafiar.')
    if(!brief.trim()||!deadline)return notify('Descreva o projeto e defina o prazo.')
    try{await createProjectDuel(opponent,same,brief,brief2,new Date(deadline).toISOString());notify('Duelo de projetos criado!');refresh()}catch(err){notify(err instanceof Error?err.message:'Falhou')}
  }
  async function submitAndEvaluate(duelId:string){
    if(!repoUrl.trim())return notify('Cole a URL do repositório GitHub do seu projeto.')
    setEvalBusy(true);setEvaluation(null)
    try{
      await submitProjectEntry(duelId,repoUrl,desc)
      const ev=await evaluateProject(repoUrl,desc)
      setEvaluation(ev)
      notify(`Projeto avaliado: ${ev.score}/100!`)
    }catch(err){notify(err instanceof Error?err.message:'Avaliação falhou')}
    setEvalBusy(false)
  }

  return <>
    <form className="doc-form" onSubmit={create}>
      <h2 style={{fontSize:16}}>Criar duelo de projetos</h2>
      <div className="form-grid">
        <label>Oponente<select value={opponent} onChange={e=>setOpponent(e.target.value)}><option value="">Escolha um amigo…</option>{friends.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label>Prazo de entrega<input type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label>
        <label style={{gridColumn:'1/-1'}}><span style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={same} onChange={e=>setSame(e.target.checked)} style={{width:'auto'}}/>Mesmo projeto para os dois</span></label>
        <label style={{gridColumn:'1/-1'}}>{same?'Briefing do projeto (para ambos)':'Seu projeto'}<input value={brief} onChange={e=>setBrief(e.target.value)} placeholder="Ex.: API REST de tarefas com autenticação e testes"/></label>
        {!same&&<label style={{gridColumn:'1/-1'}}>Projeto do oponente<input value={brief2} onChange={e=>setBrief2(e.target.value)} placeholder="Ex.: App de clima com PWA"/></label>}
      </div>
      <button className="primary-button"><Swords size={16}/>Criar duelo</button>
    </form>
    <div className="doc-list">
      {pduels.map(d=><article key={d.id} className="doc-row doc-row--stack">
        <div style={{display:'flex',gap:12,alignItems:'center',width:'100%'}}><span className="doc-kind"><FolderGit2 size={16}/></span><div style={{flex:1}}><strong>{d.brief_challenger}</strong><small>prazo: {new Date(d.deadline).toLocaleString('pt-BR')} · status: {d.status}</small></div><button className="secondary-button" onClick={()=>setSubmitFor(submitFor===d.id?'':d.id)}>Enviar projeto</button></div>
        {submitFor===d.id&&<div className="pduel-submit">
          <input value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} placeholder="https://github.com/voce/seu-projeto"/>
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Resumo do que você construiu"/>
          <button className="primary-button" disabled={evalBusy} onClick={()=>submitAndEvaluate(d.id)}>{evalBusy?'Analisando repositório…':'Enviar e avaliar com IA'}</button>
        </div>}
      </article>)}
    </div>
    {evaluation&&<article className="eval-card">
      <header><h2>Avaliação da IA</h2><b className="eval-score">{evaluation.score}<small>/100</small></b></header>
      <div className="eval-grid">
        {([['Front-end',evaluation.frontend],['Back-end',evaluation.backend],['Segurança',evaluation.security],['Arquitetura',evaluation.architecture],['Testes',evaluation.tests],['Documentação',evaluation.docs]] as const).map(([label,item])=>
          <div key={label} className="eval-item"><header><strong>{label}</strong><b>{item.score}</b></header><div className="progress"><i style={{width:`${item.score}%`}}/></div><p>{item.notes}</p></div>)}
      </div>
      <p className="eval-summary">{evaluation.summary}</p>
    </article>}
  </>
}

// ============================================================
// RANKING — apenas amigos REAIS (sem leaderboard falso)
// ============================================================
function RankingView({profile}:{profile:UserProfile}){
  const available=socialAvailable()
  const [board,setBoard]=useState<SocialProfile[]>([])
  const [err,setErr]=useState('')
  useEffect(()=>{if(available)friendLeaderboard().then(setBoard).catch(e=>setErr(e.message))},[available])
  return <section className="page-view">
    <header className="page-title"><div><span className="eyebrow">COMPETIÇÃO REAL</span><h1>Ranking de amigos</h1><p>Só pessoas reais: você e seus amigos aceitos, ordenados por XP total.</p></div></header>
    {!available&&<article className="empty-state"><Trophy size={40}/><h2>Ranking precisa do Supabase</h2><p>Sem contas reais não há ranking. Configure o Supabase e rode as migrations para competir com amigos.</p></article>}
    {available&&err&&<article className="empty-state"><h2>Rode as migrations</h2><p>Execute <code>0002_social.sql</code> no SQL Editor do Supabase. ({err})</p></article>}
    {available&&!err&&board.length<=1&&<article className="empty-state"><Mascot state="feliz" size="md"/><h2>Adicione amigos para competir</h2><p>Seu XP atual: <b>{profile.xp.toLocaleString('pt-BR')}</b>. Adicione amigos na aba Amigos — o ranking compara XP real de contas reais.</p></article>}
    {board.length>1&&<div className="ranking-table"><header><span>POSIÇÃO</span><span>ESTUDANTE</span><span>OFENSIVA</span><span>XP TOTAL</span></header>
      {board.map((p,i)=><div key={p.id} className={p.name===profile.name?'is-me':''}><b>{i+1}</b><span className="mini-avatar">{(p.name||'?').slice(0,2).toUpperCase()}</span><p><strong>{p.name}</strong><small>@{p.username||''}</small></p><span><Flame size={16}/>{p.streak_days} dias</span><strong>{p.xp_total.toLocaleString('pt-BR')} XP</strong></div>)}
    </div>}
  </section>
}

// ============================================================
// CONFIGURAÇÕES — funciona de verdade (tema, cores, meta, sair)
// ============================================================
function SettingsView({profile,onSave,onLogout,notify,install}:{profile:UserProfile;onSave:(p:UserProfile)=>void;onLogout:()=>void;notify:(s:string)=>void;install:{installed:boolean;install:()=>void}}){
  const [palette,setPalette]=useState(DEFAULT_PALETTE)
  useEffect(()=>{setPalette(loadPalette())},[])
  function setColor(key:'primary'|'secondary',value:string){
    const next={...palette,[key]:value};setPalette(next);savePalette(next)
  }
  function exportData(){
    const data:Record<string,unknown>={}
    for(const k of Object.keys(localStorage))if(k.startsWith('duoti.'))data[k]=localStorage.getItem(k)
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`duoti-backup-${new Date().toISOString().slice(0,10)}.json`;a.click()
    notify('Backup exportado!')
  }
  return <section className="page-view settings-page">
    <header className="page-title"><div><span className="eyebrow">SUA CONTA</span><h1>Configurações</h1><p>Tema, cores, meta diária e dados — tudo funcional.</p></div></header>

    <article className="settings-card"><h2><Palette size={17}/> Cores do app</h2>
      <div className="color-row"><label>Cor primária<input type="color" value={palette.primary} onChange={e=>setColor('primary',e.target.value)}/></label>
      <label>Cor secundária<input type="color" value={palette.secondary} onChange={e=>setColor('secondary',e.target.value)}/></label>
      <button className="secondary-button" onClick={()=>{setPalette(DEFAULT_PALETTE);savePalette(DEFAULT_PALETTE);notify('Cores restauradas!')}}>Restaurar padrão</button></div>
      <div className="color-presets">{[['#58cc02','#7c3aed'],['#0ea5e9','#f59e0b'],['#ec4899','#8b5cf6'],['#f97316','#22c55e'],['#ef4444','#3b82f6']].map(([p,s])=><button key={p} title={`${p} + ${s}`} onClick={()=>{const n={primary:p,secondary:s};setPalette(n);savePalette(n)}}><i style={{background:p}}/><i style={{background:s}}/></button>)}</div>
    </article>

    <article className="settings-card"><h2><Zap size={17}/> Meta diária</h2>
      <div className="ob-list">{PACES.map(p=><button key={p.id} className={`ob-goal ${profile.pace===p.id?'is-active':''}`} onClick={()=>{onSave({...profile,pace:p.id,dailyGoal:p.goal});notify(`Ritmo ${p.label} (${p.goal} XP/dia) definido!`)}}><i className="ob-radio">{profile.pace===p.id&&<b/>}</i><div><strong>{p.label} <span>· {p.time} · {p.goal} XP</span></strong><small>{p.desc}</small></div></button>)}</div>
    </article>

    <article className="settings-card"><h2><Download size={17}/> App e dados</h2>
      <div className="settings-actions">
        {!install.installed&&<button className="secondary-button" onClick={install.install}><Download size={16}/>Instalar app no dispositivo</button>}
        <button className="secondary-button" onClick={exportData}><FileText size={16}/>Exportar meus dados (JSON)</button>
        <button className="secondary-button danger" onClick={()=>{if(confirm('Sair da conta? Seu progresso local permanece salvo neste dispositivo.'))onLogout()}}><LogOut size={16}/>Sair da conta</button>
      </div>
    </article>
  </section>
}

// ============================================================
// PROJETOS (ideias reais de portfólio) / LOJA / PERFIL / TUTOR
// ============================================================
function ProjectsView(){return <section className="page-view"><header className="page-title"><div><span className="eyebrow">PORTFÓLIO</span><h1>Projetos que provam o que você sabe</h1><p>Ideias de projetos reais para construir e publicar no GitHub — depois use no duelo de projetos.</p></div></header><div className="project-hero"><div><span>DESAFIO EM DESTAQUE</span><h2>Construa um rastreador de estudos</h2><p>Use Next.js, Supabase e testes automatizados. Pratique modelagem, autenticação e UI responsiva.</p></div><Mascot state="programando" size="md"/></div><div className="project-grid">{PROJECTS.map(p=><article key={p.title} style={{'--project':p.color} as React.CSSProperties}><header><span><Code2/></span><small>{p.level}</small></header><h3>{p.title}</h3><div className="tag-list">{p.stack.map(s=><i key={s}>{s}</i>)}</div><footer><span>Ideia de projeto</span><button onClick={()=>navigator.clipboard?.writeText(`Projeto: ${p.title} — stack sugerida: ${p.stack.join(', ')}`).then(()=>{})}>Copiar briefing →</button></footer></article>)}</div></section>}

function ShopView({gems,buy}:{gems:number;buy:(c:number,n:string)=>void}){const items:[string,string,number,string][]=[['Headphone Neon','Devito no modo foco',120,'headphone'],['Boné Hacker','Código limpo, estilo também',180,'cap'],['Caneca CODE + CAFÉ','Energia para mais uma lição',90,'coffee'],['Tema Cyber Night','Cores neon exclusivas',240,'theme']];return <section className="page-view"><header className="page-title"><div><span className="eyebrow">LOJA DO DEVITO</span><h1>Personalize sua jornada</h1><p>Use gems ganhas nas lições. Nada de compras com dinheiro real.</p></div><span className="gem-balance"><Gem/> {gems} gems</span></header><div className="shop-grid">{items.map(([name,desc,cost])=><article key={name}><div className="shop-preview"><Mascot state="feliz" size="sm"/></div><h3>{name}</h3><p>{desc}</p><button onClick={()=>buy(cost,name)}><Gem size={16}/>{cost}</button></article>)}</div></section>}

function ProfileView({profile,onSave}:{profile:UserProfile;onSave:(p:UserProfile)=>void}){const [editing,setEditing]=useState(false);const [draft,setDraft]=useState(profile);useEffect(()=>{setDraft(profile)},[profile]);function file(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>setDraft({...draft,avatarUrl:String(r.result)});r.readAsDataURL(f)}return <section className="page-view profile-page"><div className="profile-cover"><span>&lt;/&gt; keep learning();</span></div><article className="profile-header"><Avatar profile={draft} size="large"/><div><span className="eyebrow">PERFIL PÚBLICO</span><h1>{draft.name||'Sem nome ainda'}</h1><p>{draft.username?`@${draft.username}`:''} {draft.englishLevel?`· ${draft.englishLevel}`:''}</p>{draft.bio&&<p style={{color:'var(--muted)',fontSize:13}}>{draft.bio}</p>}{draft.skills.length>0&&<div className="tag-list">{draft.skills.map(s=><i key={s}>{s}</i>)}</div>}</div><button className="secondary-button" onClick={()=>setEditing(!editing)}>{editing?'Cancelar':'Editar perfil'}</button></article>{editing&&<form className="profile-form" onSubmit={e=>{e.preventDefault();onSave(draft);setEditing(false)}}><h2>Personalize seu perfil</h2><div className="form-grid"><label>Foto por arquivo<input type="file" accept="image/*" onChange={file}/></label><label>Ou link da imagem<input value={draft.avatarUrl} onChange={e=>setDraft({...draft,avatarUrl:e.target.value})} placeholder="https://..."/></label><label>Nome<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Usuário<input value={draft.username} onChange={e=>setDraft({...draft,username:e.target.value})}/></label><label>Bio<input value={draft.bio} onChange={e=>setDraft({...draft,bio:e.target.value})}/></label><label>Faculdade<input value={draft.college} onChange={e=>setDraft({...draft,college:e.target.value})}/></label><label>Curso<input value={draft.course} onChange={e=>setDraft({...draft,course:e.target.value})}/></label><label>Nível de inglês<select value={draft.englishLevel} onChange={e=>setDraft({...draft,englishLevel:e.target.value})}><option>A1 — Iniciante</option><option>A2 — Básico</option><option>B1 — Intermediário</option><option>B2 — Intermediário avançado</option><option>C1 — Avançado</option><option>C2 — Fluente</option></select></label></div><button className="primary-button">Salvar alterações</button></form>}<div className="stat-grid" style={{marginTop:18}}><article className="stat-card"><span className="stat-icon"><Zap/></span><div><small>XP total</small><strong>{profile.xp.toLocaleString('pt-BR')}</strong></div></article><article className="stat-card"><span className="stat-icon stat-icon--fire"><Flame/></span><div><small>Ofensiva</small><strong>{profile.streak} dias</strong></div></article><article className="stat-card"><span className="stat-icon stat-icon--gem"><Gem/></span><div><small>Gems</small><strong>{profile.gems}</strong></div></article><article className="stat-card"><span className="stat-icon stat-icon--league"><Activity/></span><div><small>Skills</small><strong>{profile.skills.length}</strong></div></article></div></section>}

function Tutor(){const [open,setOpen]=useState(false);const [text,setText]=useState('');const [messages,setMessages]=useState<{from:'me'|'bot';text:string}[]>([{from:'bot',text:'Oi! Sou o tutor do Devito. Posso explicar código, inglês técnico ou conceitos de Engenharia de Software. E eu aprendo com os documentos que você anexa!'}]);const [loading,setLoading]=useState(false);async function send(){if(!text.trim())return;const q=text;setText('');setMessages(m=>[...m,{from:'me',text:q}]);setLoading(true);const answer=await aiService.explain(q);setMessages(m=>[...m,{from:'bot',text:answer}]);setLoading(false)}return <><button className="tutor-button" onClick={()=>setOpen(!open)} aria-label="Abrir tutor"><Bot/><span>?</span></button>{open&&<aside className="tutor-panel"><header><Mascot state="feliz" size="sm"/><div><strong>Tutor do Devito</strong><small><i/> aprende com seus documentos</small></div><button onClick={()=>setOpen(false)}><X/></button></header><div className="tutor-messages">{messages.map((m,i)=><p key={i} className={`message message--${m.from}`}>{m.text}</p>)}{loading&&<p className="message message--bot">Pensando...</p>}</div><footer><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Pergunte sobre código..."/><button onClick={send}><Send/></button></footer></aside>}</>}
