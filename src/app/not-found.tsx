import Link from 'next/link'
import { Mascot } from '@/components/Mascot'
export default function NotFound(){return <main className="not-found"><Mascot state="erro404" size="lg"/><p className="eyebrow">Ops, essa rota se perdeu</p><h1>Erro 404</h1><p>Nem o Devito conseguiu encontrar esta página.</p><Link className="primary-button" href="/">Voltar ao mapa</Link></main>}
