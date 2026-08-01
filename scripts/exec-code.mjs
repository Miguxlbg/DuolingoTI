/**
 * exec-code.mjs — validador de código por EXECUÇÃO real.
 *
 * Ordem de preferência:
 *  1. Piston self-hosted/whitelisted (defina PISTON_URL) — a API pública
 *     emkc.org virou whitelist-only em 15/02/2026.
 *  2. Runtimes locais do ambiente: node (JS/TS via --experimental-strip-types),
 *     python3, g++ (checagem de compilação para C++).
 *
 * Retorna { ok, mode, error } — mode: 'run' | 'compile' | 'skip'.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PISTON_URL = process.env.PISTON_URL || '';
const TIMEOUT = 10_000;

const LANG_ALIASES = {
  js: 'javascript', javascript: 'javascript', node: 'javascript',
  ts: 'typescript', typescript: 'typescript',
  py: 'python', python: 'python', python3: 'python',
  'c++': 'cpp', cpp: 'cpp', cxx: 'cpp',
  java: 'java',
  sql: 'skip', bash: 'skip', sh: 'skip', shell: 'skip', text: 'skip', txt: 'skip',
  html: 'skip', css: 'skip', json: 'skip', yaml: 'skip', yml: 'skip',
  pseudocode: 'skip', pseudo: 'skip', '': 'skip', diff: 'skip', http: 'skip',
  markdown: 'skip', md: 'skip', gitignore: 'skip', dockerfile: 'skip', env: 'skip',
};

export function normalizeLang(lang) {
  return LANG_ALIASES[String(lang || '').trim().toLowerCase()] ?? 'skip';
}

function tmpFile(ext, content) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'duoti-')), `snippet${ext}`);
  fs.writeFileSync(file, content);
  return file;
}

function runLocal(cmd, args) {
  try {
    execFileSync(cmd, args, { timeout: TIMEOUT, stdio: 'pipe', encoding: 'utf8' });
    return { ok: true };
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || '').toString().slice(0, 400);
    return { ok: false, error: msg };
  }
}

async function runPiston(language, code) {
  const res = await fetch(`${PISTON_URL.replace(/\/$/, '')}/api/v2/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, version: '*', files: [{ content: code }] }),
  });
  if (!res.ok) throw new Error(`Piston HTTP ${res.status}`);
  const data = await res.json();
  const run = data.run || {};
  if (run.code === 0) return { ok: true, mode: 'run' };
  return { ok: false, mode: 'run', error: (run.stderr || run.stdout || '').slice(0, 400) };
}

/**
 * Executa/valida um snippet. Snippets de linguagens não executáveis (SQL,
 * bash, HTML…) são pulados — a validação semântica deles fica com o LLM.
 */
export async function checkSnippet(rawLang, code) {
  const lang = normalizeLang(rawLang);
  if (lang === 'skip' || lang === 'java') return { ok: true, mode: 'skip' };
  if (!code || code.trim().length < 5) return { ok: true, mode: 'skip' };

  if (PISTON_URL) {
    try { return await runPiston(lang, code); } catch { /* cai para local */ }
  }

  if (lang === 'javascript') {
    const f = tmpFile('.mjs', code);
    const r = runLocal('node', [f]);
    return { ...r, mode: 'run' };
  }
  if (lang === 'typescript') {
    const f = tmpFile('.ts', code);
    const r = runLocal('node', ['--experimental-strip-types', '--no-warnings', f]);
    return { ...r, mode: 'run' };
  }
  if (lang === 'python') {
    const f = tmpFile('.py', code);
    const r = runLocal('python3', [f]);
    return { ...r, mode: 'run' };
  }
  if (lang === 'cpp') {
    const f = tmpFile('.cpp', code);
    const r = runLocal('g++', ['-fsyntax-only', '-std=c++17', f]);
    return { ...r, mode: 'compile' };
  }
  return { ok: true, mode: 'skip' };
}

/** Extrai blocos ```lang ...``` de um markdown. */
export function extractCodeBlocks(markdown) {
  const blocks = [];
  const re = /```([\w+#-]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(markdown || ''))) blocks.push({ lang: m[1], code: m[2] });
  return blocks;
}

/**
 * Valida todos os blocos de código executáveis de uma lição.
 * Retorna { errors: string[], executed: number, skipped: number }.
 */
export async function validateLessonCode(lesson) {
  const errors = [];
  let executed = 0, skipped = 0;
  const sources = [lesson.theory, lesson.context, lesson.useCase].filter(Boolean);
  for (const src of sources) {
    for (const { lang, code } of extractCodeBlocks(src)) {
      const r = await checkSnippet(lang, code);
      if (r.mode === 'skip') { skipped++; continue; }
      executed++;
      if (!r.ok) errors.push(`bloco ${normalizeLang(lang)} falhou (${r.mode}): ${String(r.error).split('\n').slice(-3).join(' ').slice(0, 220)}`);
    }
  }
  return { errors, executed, skipped };
}
