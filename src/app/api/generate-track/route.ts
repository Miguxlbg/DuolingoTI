import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Dispara a (re)geração de lições de UMA trilha usando o material do usuário
// como referência. Funciona em ambiente com filesystem gravável (dev/sandbox).
// Em serverless (Vercel) devolve a instrução de rodar localmente.

const running = new Map<string, { startedAt: number }>()

export async function POST(request: Request) {
  const { trackId, force } = await request.json()
  if (!trackId || typeof trackId !== 'string' || !/^[a-z0-9-]+$/.test(trackId))
    return NextResponse.json({ error: 'trackId inválido' }, { status: 400 })
  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json({ error: 'Configure GEMINI_API_KEY para gerar lições.' }, { status: 503 })

  const script = path.join(process.cwd(), 'scripts', 'generate-content.mjs')
  if (!fs.existsSync(script))
    return NextResponse.json({ error: 'Ambiente serverless: rode `node scripts/generate-content.mjs ' + trackId + '` localmente.' }, { status: 501 })

  if (running.has(trackId))
    return NextResponse.json({ status: 'already_running', startedAt: running.get(trackId)!.startedAt })

  running.set(trackId, { startedAt: Date.now() })
  const log = path.join('/tmp', `gen-${trackId}.log`)
  const out = fs.openSync(log, 'w')
  const child = spawn(process.execPath, [script, trackId], {
    cwd: process.cwd(), detached: true, stdio: ['ignore', out, out],
    env: { ...process.env, CONCURRENCY: '2', ...(force ? { FORCE_REGEN: '1' } : {}) },
  })
  child.on('exit', () => {
    running.delete(trackId)
    // reconstrói o índice ao terminar
    const idx = path.join(process.cwd(), 'scripts', 'build-content-index.mjs')
    if (fs.existsSync(idx)) spawn(process.execPath, [idx], { cwd: process.cwd(), detached: true, stdio: 'ignore' }).unref()
  })
  child.unref()
  return NextResponse.json({ status: 'started', trackId, log })
}

export async function GET() {
  // status geral: lições reais por trilha + jobs em andamento
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'content', 'index.json'), 'utf8'))
    const tracks = idx.tracks.map((t: { id: string; name: string; lessons: { has?: boolean }[] }) => ({
      id: t.id, name: t.name,
      total: t.lessons.length,
      real: t.lessons.filter((l) => l.has).length,
      running: running.has(t.id),
    }))
    // fontes de conhecimento locais
    const srcDir = path.join(process.cwd(), 'content', 'sources')
    const sources: Record<string, number> = {}
    if (fs.existsSync(srcDir))
      for (const d of fs.readdirSync(srcDir))
        try { sources[d] = fs.readdirSync(path.join(srcDir, d)).filter((f) => f.endsWith('.json')).length } catch { /* skip */ }
    return NextResponse.json({ tracks, sources })
  } catch {
    return NextResponse.json({ tracks: [], sources: {} })
  }
}
