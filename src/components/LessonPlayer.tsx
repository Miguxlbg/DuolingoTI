'use client'

// Player de lição REAL: consome as lições geradas pelo motor de conteúdo
// (public/content/<track>/<nn>.json) com múltiplos formatos de exercício.
import { useEffect, useMemo, useState } from 'react'
import { Volume2, X, Zap, BookOpen, FileText, Sparkles } from 'lucide-react'
import { Mascot } from './Mascot'
import { loadLesson, markCompleted, saveVocabulary, type ContentLesson, type ContentExercise } from '@/lib/content'
import type { MascotState } from '@/lib/types'
import { speechService } from '@/services/speech'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
}

export function LessonPlayer({ trackId, n, dailyXp, onClose, onComplete }: {
  trackId: string; n: number; dailyXp: number
  onClose: () => void
  onComplete: (xp: number, perfect: boolean) => void
}) {
  const [lesson, setLesson] = useState<ContentLesson | null>(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'theory' | 'exercise' | 'done'>('theory')
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [mistakes, setMistakes] = useState(0)
  const [mascot, setMascot] = useState<MascotState>('programando')
  // respostas por formato
  const [selected, setSelected] = useState('')
  const [typed, setTyped] = useState('')
  const [tokens, setTokens] = useState<string[]>([])
  const [pairsLeft, setPairsLeft] = useState<string[]>([])
  const [pairsRight, setPairsRight] = useState<string[]>([])
  const [pairSelL, setPairSelL] = useState('')
  const [matched, setMatched] = useState<string[]>([])
  const [pairMiss, setPairMiss] = useState(0)

  useEffect(() => {
    loadLesson(trackId, n).then(setLesson).catch(() => setError('Esta lição ainda não foi gerada pelo motor de conteúdo.'))
  }, [trackId, n])

  const ex: ContentExercise | undefined = lesson?.exercises[index]
  const shuffledTokens = useMemo(() => ex?.kind === 'order_tokens' && ex.options ? shuffle(ex.options) : [], [ex])
  useEffect(() => {
    if (ex?.kind === 'match_pairs' && ex.options) {
      const pairs = ex.options.map((p) => p.split('::'))
      setPairsLeft(shuffle(pairs.map((p) => p[0])))
      setPairsRight(shuffle(pairs.map((p) => p[1])))
      setMatched([]); setPairSelL(''); setPairMiss(0)
    }
  }, [ex])

  if (error) return <main className="lesson-page"><header><button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button></header><section className="lesson-empty"><Mascot state="erro404" size="md" /><h1>{error}</h1><p>Rode <code>node scripts/generate-content.mjs {trackId}</code> para gerar o conteúdo real desta trilha.</p></section></main>
  if (!lesson) return <main className="lesson-page"><section className="lesson-empty"><Mascot state="programando" size="md" /><h1>Carregando lição…</h1></section></main>

  const total = lesson.exercises.length
  const pairsOf = (o: string[]) => o.map((p) => p.split('::'))

  function verify() {
    if (!ex) return
    let ok = false
    if (ex.kind === 'multiple_choice' || ex.kind === 'true_false') ok = selected === ex.answer
    else if (ex.kind === 'order_tokens') ok = normalize(tokens.join(' ')) === normalize(ex.answer)
    else if (ex.kind === 'match_pairs') ok = pairMiss === 0
    else if (ex.kind === 'open_writing') ok = typed.trim().length >= 20 // avaliação qualitativa; gabarito exibido
    else ok = normalize(typed) === normalize(ex.answer)
    setCorrect(ok); setChecked(true)
    if (!ok) setMistakes((m) => m + 1)
    setMascot(ok ? 'feliz' : 'bravo')
  }

  function next() {
    if (index === total - 1) {
      markCompleted(lesson!.slug)
      saveVocabulary(lesson!)
      setPhase('done')
      return
    }
    setIndex(index + 1); setSelected(''); setTyped(''); setTokens([]); setChecked(false); setMascot('programando')
  }
  const earnedXp = lesson ? lesson.xp + Math.max(0, (total - mistakes) * 2) : 0

  const canVerify = ex && (
    ((ex.kind === 'multiple_choice' || ex.kind === 'true_false') && !!selected) ||
    (ex.kind === 'order_tokens' && tokens.length === (ex.options?.length || 0)) ||
    (ex.kind === 'match_pairs' && matched.length === (ex.options?.length || 0)) ||
    (['fill_blank', 'translate', 'listen_type', 'open_writing'].includes(ex.kind) && typed.trim().length > 0)
  )

  return <main className="lesson-page">
    <header>
      <button className="icon-button" onClick={onClose} aria-label="Sair da lição"><X /></button>
      <div className="lesson-progress" role="progressbar" aria-valuenow={phase === 'theory' ? 0 : index + 1} aria-valuemax={total}><i style={{ width: phase === 'theory' ? '4%' : `${((index + 1) / total) * 100}%` }} /></div>
      <span><Zap size={18} />{dailyXp} XP hoje</span>
    </header>

    {phase === 'theory' && <section className="theory-view">
      <div className="theory-head"><Mascot state="programando" size="sm" /><div><span className="eyebrow">LIÇÃO {n} · {lesson.trackId.toUpperCase()}</span><h1>{lesson.title}</h1></div></div>
      <p className="lesson-source">{lesson.source?.kind === 'user_material'
        ? <><FileText size={13}/> Baseada no material que você enviou{lesson.source.files?.length ? ` (${lesson.source.files.join(', ')})` : ''}</>
        : <><BookOpen size={13}/> Baseada em conhecimento técnico consolidado</>}</p>
      <article className="theory-block"><h2><BookOpen size={17} /> Por que isso importa</h2><MD text={lesson.context} /></article>
      <article className="theory-block"><h2>Teoria</h2><MD text={lesson.theory} /></article>
      <article className="theory-block theory-block--case"><h2>Na prática</h2><MD text={lesson.useCase} /></article>
      {lesson.diagram && <Diagram d={lesson.diagram} />}
      <button className="primary-button primary-button--full" onClick={() => setPhase('exercise')}>Começar os {total} exercícios →</button>
    </section>}

    {phase === 'exercise' && ex && <>
      <section className="lesson-content">
        <div className="lesson-mascot"><Mascot state={mascot} size="md" /><div className="speech-bubble">{checked ? (correct ? 'Mandou muito bem!' : 'Quase! Leia a explicação com calma.') : 'Analise com calma. Você sabe essa!'}</div></div>
        <article className="exercise-card">
          <span className="eyebrow">EXERCÍCIO {index + 1} DE {total} · {ex.kind.replace('_', ' ').toUpperCase()}</span>
          <h1>{ex.prompt}</h1>
          {ex.kind === 'listen_type' && ex.code && <button className="listen-button" onClick={() => speechService.speak(ex.code!)}><Volume2 />Ouvir frase</button>}
          {ex.code && ex.kind !== 'listen_type' && <Code text={ex.code} />}

          {(ex.kind === 'multiple_choice' || ex.kind === 'true_false') && <div className="answer-grid">
            {(ex.options || []).map((o, i) => <button key={o} className={`${selected === o ? 'is-selected' : ''} ${checked && o === ex.answer ? 'is-correct' : ''} ${checked && selected === o && o !== ex.answer ? 'is-wrong' : ''}`} onClick={() => !checked && setSelected(o)}><kbd>{i + 1}</kbd>{o}</button>)}
          </div>}

          {ex.kind === 'order_tokens' && <div className="token-area">
            <div className="token-answer">{tokens.map((t, i) => <button key={t + i} onClick={() => !checked && setTokens(tokens.filter((_, j) => j !== i))}>{t}</button>)}{tokens.length === 0 && <em>Toque nos blocos na ordem correta</em>}</div>
            <div className="token-bank">{shuffledTokens.filter((t) => !tokens.includes(t)).map((t) => <button key={t} onClick={() => !checked && setTokens([...tokens, t])}>{t}</button>)}</div>
          </div>}

          {ex.kind === 'match_pairs' && ex.options && <div className="pairs-area">
            <div>{pairsLeft.map((l) => <button key={l} disabled={matched.includes(l)} className={pairSelL === l ? 'is-selected' : matched.includes(l) ? 'is-correct' : ''} onClick={() => setPairSelL(l)}>{l}</button>)}</div>
            <div>{pairsRight.map((r) => <button key={r} disabled={matched.some((m) => pairsOf(ex.options!).find((p) => p[0] === m)?.[1] === r)} onClick={() => {
              if (!pairSelL) return
              const pair = pairsOf(ex.options!).find((p) => p[0] === pairSelL)
              if (pair && pair[1] === r) { setMatched([...matched, pairSelL]); setPairSelL('') }
              else { setPairMiss((x) => x + 1); setPairSelL('') }
            }}>{r}</button>)}</div>
          </div>}

          {['fill_blank', 'translate', 'listen_type', 'open_writing'].includes(ex.kind) && (
            ex.kind === 'open_writing'
              ? <textarea className="type-answer type-answer--long" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={checked} placeholder="Escreva sua resposta…" aria-label="Sua resposta" />
              : <input className="type-answer" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={checked} placeholder="Digite sua resposta…" aria-label="Sua resposta" onKeyDown={(e) => e.key === 'Enter' && canVerify && !checked && verify()} />
          )}
        </article>
      </section>
      <footer className={checked ? (correct ? 'feedback feedback--correct' : 'feedback feedback--wrong') : ''}>
        <div>{checked && <><span>{correct ? '✓' : '!'}</span><p><strong>{correct ? 'Correto!' : `Resposta: ${ex.answer}`}</strong>{ex.explanation}</p></>}</div>
        <button className="primary-button" disabled={!canVerify} onClick={checked ? next : verify}>{checked ? (index === total - 1 ? 'Concluir lição' : 'Continuar') : 'Verificar'}</button>
      </footer>
    </>}

    {phase === 'done' && <section className="lesson-done">
      <div className="lesson-done__burst" aria-hidden>{Array.from({length:14}).map((_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>
      <Mascot state={mistakes === 0 ? 'apaixonado' : 'feliz'} size="lg" />
      <h1>{mistakes === 0 ? 'Lição PERFEITA!' : 'Lição concluída!'}</h1>
      <div className="lesson-done__stats">
        <div><Zap size={20}/><b>+{earnedXp} XP</b><small>experiência</small></div>
        <div><Sparkles size={20}/><b>{total - mistakes}/{total}</b><small>acertos</small></div>
      </div>
      {mistakes > 0 && <p className="lesson-done__tip">Revise os exercícios que errou — os conceitos vão aparecer de novo nas próximas lições.</p>}
      <button className="primary-button primary-button--full" onClick={() => onComplete(earnedXp, mistakes === 0)}>Continuar →</button>
    </section>}
  </main>
}

// ---- destaque de sintaxe leve (sem dependência externa) ----
const KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|new|await|async|try|catch|throw|def|print|lambda|elif|None|True|False|public|private|static|void|int|string|bool|interface|type|extends|implements|switch|case|break|continue|in|of|not|and|or|is|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN|GROUP BY|ORDER BY|CREATE|TABLE)\b/g
function highlight(code: string): string {
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/("[^"\n]*"|'[^'\n]*'|`[^`]*`)/g, '\u0001str\u0002$1\u0001/\u0002')
    .replace(/(\/\/[^\n]*|#[^\n]*)/g, '\u0001com\u0002$1\u0001/\u0002')
    .replace(KEYWORDS, '\u0001kw\u0002$1\u0001/\u0002')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '\u0001num\u0002$1\u0001/\u0002')
    .replace(/\u0001(str|com|kw|num)\u0002/g, '<span class="tok-$1">')
    .replace(/\u0001\/\u0002/g, '</span>')
}
export function Code({ text, lang }: { text: string; lang?: string }) {
  return <pre className="code-block">{lang && <span className="code-lang">{lang}</span>}<code dangerouslySetInnerHTML={{ __html: highlight(text) }} /></pre>
}

// Renderizador de markdown minimalista (títulos, negrito, código, tabelas simples)
function MD({ text }: { text: string }) {
  const blocks = text.split(/```/)
  return <div className="md">{blocks.map((b, i) => i % 2 === 1
    ? <Code key={i} lang={b.match(/^(\w+)\n/)?.[1]} text={b.replace(/^\w*\n/, '')} />
    : b.split('\n').map((line, j) => {
        if (line.startsWith('### ')) return <h3 key={`${i}-${j}`}>{line.slice(4)}</h3>
        if (line.startsWith('| ')) return <p key={`${i}-${j}`} className="md-row">{line.replace(/\|/g, ' · ')}</p>
        if (!line.trim()) return null
        const html = line.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>')
        return <p key={`${i}-${j}`} dangerouslySetInnerHTML={{ __html: html }} />
      })
  )}</div>
}

// Diagrama SVG gerado por código a partir do roteiro do motor (sem lib externa)
function Diagram({ d }: { d: NonNullable<ContentLesson['diagram']> }) {
  const W = 640, GAP = 120
  const pos: Record<string, { x: number; y: number }> = {}
  d.nodes.forEach((nd, i) => { pos[nd.id] = { x: W / 2, y: 46 + i * GAP * 0.75 } })
  const H = 46 + d.nodes.length * GAP * 0.75
  return <article className="theory-block"><h2>{d.title}</h2>
    <svg viewBox={`0 0 ${W} ${H}`} className="diagram" role="img" aria-label={d.title}>
      {d.edges.map((e, i) => { const a = pos[e.from], b = pos[e.to]; if (!a || !b) return null; return <g key={i}><line x1={a.x} y1={a.y + 22} x2={b.x} y2={b.y - 22} stroke="var(--muted)" strokeWidth="2" markerEnd="url(#arr)" />{e.label && <text x={(a.x + b.x) / 2 + 10} y={(a.y + b.y) / 2} fontSize="12" fill="var(--muted)">{e.label}</text>}</g> })}
      <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="var(--muted)" /></marker></defs>
      {d.nodes.map((nd) => { const p = pos[nd.id]; return <g key={nd.id}><rect x={p.x - 110} y={p.y - 22} width="220" height="44" rx="12" fill="var(--surface)" stroke="var(--green)" strokeWidth="2" /><text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">{nd.label}</text></g> })}
    </svg>
  </article>
}
