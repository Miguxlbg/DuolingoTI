'use client'

/**
 * Mascote real — usa exclusivamente os PNGs processados a partir dos arquivos
 * originais (scripts/process-mascot-assets.py). Nada foi redesenhado.
 *
 * Fase atual (a pedido): estados FELIZ e BRAVO com animação completa.
 * Os demais estados já têm assets extraídos em /public/mascot/states e são
 * mapeados para o mais próximo até serem ativados.
 */
import { useEffect, useState } from 'react'
import type { MascotState } from '@/lib/types'

const ACTIVE: Record<MascotState, { img: string; anim: string; fx: { img: string; cls: string }[] }> = {
  feliz:        { img: '/mascot/states/happy.png', anim: 'm-bounce', fx: [{ img: '/mascot/fx/sparkles.png', cls: 'fx-sparkle' }] },
  apaixonado:   { img: '/mascot/states/happy.png', anim: 'm-breathe', fx: [{ img: '/mascot/fx/heart-big.png', cls: 'fx-heart' }, { img: '/mascot/fx/heart-small.png', cls: 'fx-heart fx-heart--2' }] },
  cansado:      { img: '/mascot/states/happy.png', anim: 'm-breathe', fx: [] },
  conectando:   { img: '/mascot/states/happy.png', anim: 'm-tilt', fx: [] },
  programando:  { img: '/mascot/states/happy.png', anim: 'm-type', fx: [] },
  ouvindo_musica:{ img: '/mascot/states/happy.png', anim: 'm-sway', fx: [{ img: '/mascot/fx/music-notes.png', cls: 'fx-note' }] },
  bravo:        { img: '/mascot/states/angry.png', anim: 'm-shake', fx: [{ img: '/mascot/fx/anger-mark.png', cls: 'fx-anger' }, { img: '/mascot/fx/steam-cloud.png', cls: 'fx-steam' }] },
  erro404:      { img: '/mascot/states/angry.png', anim: 'm-shake', fx: [{ img: '/mascot/fx/tears.png', cls: 'fx-tear' }] },
}

const LABEL: Record<MascotState, string> = {
  feliz: 'Feliz', apaixonado: 'Apaixonado', cansado: 'Cansado com café', conectando: 'Conectando',
  programando: 'Programando', ouvindo_musica: 'Ouvindo música', bravo: 'Bravo com um bug', erro404: 'Erro 404',
}

const SIZE = { sm: 74, md: 150, lg: 220 }

export function Mascot({ state = 'feliz', size = 'md' }: { state?: MascotState; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = ACTIVE[state] ?? ACTIVE.feliz
  const [visible, setVisible] = useState(cfg.img)
  const [fading, setFading] = useState(false)

  // Transição suave entre estados (crossfade), nunca troca abrupta.
  useEffect(() => {
    if (cfg.img === visible) return
    setFading(true)
    const t = window.setTimeout(() => { setVisible(cfg.img); setFading(false) }, 180)
    return () => window.clearTimeout(t)
  }, [cfg.img, visible])

  const px = SIZE[size]
  return (
    <figure
      className={`mx mx--${size} ${cfg.anim} ${fading ? 'mx--fading' : ''}`}
      style={{ width: px, height: px }}
      aria-label={`Mascote Devito: ${LABEL[state]}`}
      role="img"
    >
      <img src="/mascot/fx/shadow-large.png" alt="" aria-hidden className="mx__shadow" />
      <img src={visible} alt="" aria-hidden className="mx__body" draggable={false} />
      {cfg.fx.map((f, i) => (
        <img key={f.cls + i} src={f.img} alt="" aria-hidden className={`mx__fx ${f.cls}`} draggable={false} />
      ))}
    </figure>
  )
}
