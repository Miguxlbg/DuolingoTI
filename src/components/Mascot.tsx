'use client'

import { useEffect, useState } from 'react'
import type { MascotState } from '@/lib/types'

const labels: Record<MascotState, string> = {
  feliz:'Feliz', apaixonado:'Apaixonado', cansado:'Cansado com café', conectando:'Conectando',
  programando:'Programando', ouvindo_musica:'Ouvindo música', bravo:'Bravo com um bug', erro404:'Erro 404',
}

export function Mascot({ state='feliz', size='md', interactive=true }: { state?: MascotState; size?: 'sm'|'md'|'lg'; interactive?: boolean }) {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    const timer = window.setInterval(() => { setBlink(true); window.setTimeout(() => setBlink(false), 160) }, 2600 + Math.random() * 1600)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <figure className={`mascot mascot--${state} mascot--${size} ${interactive ? 'mascot--interactive' : ''}`} aria-label={`Mascote Devito: ${labels[state]}`}>
      <span className="mascot__shadow" />
      <span className="mascot__body"><span className="mascot__hoodie-code">&lt;/&gt;</span></span>
      <span className="mascot__wing mascot__wing--left" />
      <span className="mascot__wing mascot__wing--right" />
      <span className="mascot__foot mascot__foot--left" />
      <span className="mascot__foot mascot__foot--right" />
      <span className="mascot__head"><span className="mascot__tuft mascot__tuft--one"/><span className="mascot__tuft mascot__tuft--two"/></span>
      <span className={`mascot__eye mascot__eye--left ${blink ? 'is-blinking' : ''}`}><i className="mascot__pupil"/></span>
      <span className={`mascot__eye mascot__eye--right ${blink ? 'is-blinking' : ''}`}><i className="mascot__pupil"/></span>
      <span className="mascot__glasses"><i/><i/></span>
      <span className="mascot__beak" />
      {state === 'apaixonado' && <span className="mascot__effects mascot__hearts">♥ <i>♥</i></span>}
      {state === 'cansado' && <span className="mascot__prop mascot__coffee">CODE<br/>+<br/>CAFÉ</span>}
      {state === 'conectando' && <span className="mascot__prop mascot__usb">USB</span>}
      {state === 'programando' && <span className="mascot__prop mascot__keyboard">⌨</span>}
      {state === 'ouvindo_musica' && <><span className="mascot__headphones"/><span className="mascot__effects mascot__notes">♫ ♪</span></>}
      {state === 'bravo' && <><span className="mascot__effects mascot__anger">╬</span><span className="mascot__prop mascot__laptop">BUG</span></>}
      {state === 'erro404' && <><span className="mascot__tear mascot__tear--left"/><span className="mascot__tear mascot__tear--right"/><span className="mascot__prop mascot__monitor">ERROR<br/><b>404</b></span></>}
    </figure>
  )
}
