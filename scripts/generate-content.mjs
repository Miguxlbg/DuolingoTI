#!/usr/bin/env node
/**
 * generate-content.mjs
 * ====================
 * Motor REAL de geração de conteúdo. Para cada lição do syllabus:
 *  - chama o LLM pedindo JSON estruturado (markdown + 8-15 exercícios + diagrama)
 *  - valida programaticamente (comprimento, placeholders, duplicação, gabaritos)
 *  - regenera em caso de falha (até 3 tentativas)
 *  - grava em content/generated/<trackId>/<nn>.json
 *
 * Uso:
 *   node scripts/generate-content.mjs                 # gera tudo que falta
 *   node scripts/generate-content.mjs logic-algorithms # só uma trilha
 *   CONCURRENCY=6 node scripts/generate-content.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ALL_TRACKS } from './syllabus.mjs';
import { validateLessonCode } from './exec-code.mjs';
import { jsonrepair } from 'jsonrepair';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'content', 'generated');
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const MODEL = process.env.GEN_MODEL || 'gpt-5-mini';

// --- .env.local (GEMINI_API_KEY etc.) sem depender de dotenv ---------------
for (const envFile of ['.env.local', '.env']) {
  const p = path.join(ROOT, envFile);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// --- fontes de conhecimento do usuário (Supabase knowledge_sources +
//     arquivos locais em content/sources/<trackId>/*.json) ------------------
async function loadKnowledgeSources() {
  const byTrack = {};
  const add = (trackId, src) => {
    if (!trackId) return;
    (byTrack[trackId] ||= []).push(src);
  };
  // 1) locais
  const localDir = path.join(ROOT, 'content', 'sources');
  if (fs.existsSync(localDir)) {
    for (const track of fs.readdirSync(localDir)) {
      const dir = path.join(localDir, track);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        try {
          const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          add(track, { fileName: s.fileName || f, title: s.title || f, text: s.text || s.textContent || '' });
        } catch { /* ignora arquivo corrompido */ }
      }
    }
  }
  // 2) Supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/knowledge_sources?select=title,file_name,track_id,text_content`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        for (const s of await res.json())
          add(s.track_id, { fileName: s.file_name, title: s.title, text: s.text_content || '' });
      }
    } catch { /* offline — segue só com locais */ }
  }
  const n = Object.values(byTrack).reduce((a, b) => a + b.length, 0);
  if (n) console.log(`Fontes de conhecimento do usuário: ${n} documento(s) em ${Object.keys(byTrack).length} trilha(s).`);
  return byTrack;
}

// --- credenciais: ~/.genspark_llm.yaml ou env ------------------------------
async function loadLLMConfig() {
  const candidates = [];
  // 1) Gemini (Google AI Studio — free tier). Recomendado: GEMINI_API_KEY.
  if (process.env.GEMINI_API_KEY)
    candidates.push({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY });
  // 2) Qualquer endpoint compatível com OpenAI.
  if (process.env.OPENAI_API_KEY)
    candidates.push({ provider: 'openai', apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' });
  const yamlPath = path.join(os.homedir(), '.genspark_llm.yaml');
  if (fs.existsSync(yamlPath)) {
    const text = fs.readFileSync(yamlPath, 'utf8');
    const apiKey = text.match(/api_key:\s*(\S+)/)?.[1];
    const baseURL = text.match(/base_url:\s*(\S+)/)?.[1];
    if (apiKey) candidates.push({ provider: 'openai', apiKey, baseURL });
  }
  if (process.env.GSK_TOKEN)
    candidates.push({ provider: 'openai', apiKey: process.env.GSK_TOKEN, baseURL: 'https://www.genspark.ai/api/llm_proxy/v1' });

  for (const c of candidates) {
    try {
      const pong = await chatWith(c, [{ role: 'user', content: 'Responda apenas: ok' }], 60);
      if (typeof pong === 'string' && !/can't be used|subscribe|invalid/i.test(pong)) {
        console.log(`LLM ok via ${c.provider}${c.baseURL ? ' ' + c.baseURL : ''}`);
        return c;
      }
    } catch { /* tenta o próximo */ }
  }
  throw new Error('Nenhuma credencial LLM funcional. Configure GEMINI_API_KEY (grátis em https://aistudio.google.com/apikey) ou OPENAI_API_KEY.');
}

async function chatWith(cfg, messages, maxTokens = 9000) {
  if (cfg.provider === 'gemini') {
    const model = process.env.GEN_MODEL || 'gemini-flash-latest';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        systemInstruction: messages.find((m) => m.role === 'system') ? { parts: [{ text: messages.find((m) => m.role === 'system').content }] } : undefined,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7, responseMimeType: 'application/json' },
      }),
    });
    if (res.status === 429 || res.status === 503) {
      const body = await res.text();
      const wait = Number(body.match(/retry.{0,10}?(\d+(?:\.\d+)?)s/i)?.[1] || 30);
      throw Object.assign(new Error(`Gemini HTTP ${res.status}`), { retryAfter: Math.min(90, wait + 2) });
    }
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  }
  const res = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: MODEL, messages, max_completion_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

const llm = await loadLLMConfig();
const chat = (messages, maxTokens) => chatWith(llm, messages, maxTokens);

// --- prompt ----------------------------------------------------------------
function lessonPrompt(track, lessonTitle, index, sources = []) {
  const isEnglish = track.kind === 'english';
  const refBlock = sources.length
    ? `\n\nMATERIAL DE REFERÊNCIA DO ALUNO (prioridade máxima — baseie-se nele quando cobrir o mesmo tópico e NUNCA o contradiga; se ele não cobrir o tópico desta lição, use conhecimento técnico consolidado normalmente):\n${sources.map((s) => `--- ${s.title} (${s.fileName}) ---\n${String(s.text).slice(0, 4500)}`).join('\n\n')}`
    : '';
  return `Você é o autor de um curso técnico sério embalado em formato gamificado (estilo Duolingo, mas denso).
Gere a lição em JSON VÁLIDO (somente JSON, sem markdown em volta) com este schema exato:

{
  "title": string,                       // título da lição
  "context": string,                     // 2-4 parágrafos: por que isso importa no dia a dia de um dev (markdown)
  "theory": string,                      // explicação técnica completa em markdown, com pelo menos 1 exemplo de código real COMENTADO (blocos \`\`\`), mínimo 350 palavras
  "useCase": string,                     // cenário aplicado, ex: bug em produção, decisão de arquitetura (markdown, 1-2 parágrafos)
  "diagram": null | {                    // opcional: roteiro de diagrama simples
    "kind": "flow" | "tree" | "cycle",
    "title": string,
    "nodes": [{"id": string, "label": string}],
    "edges": [{"from": string, "to": string, "label"?: string}]
  },
  "vocabulary": [{"term": string, "definition": string, "example": string}],   // 3-6 termos técnicos da lição
  "exercises": [                         // ENTRE 9 E 13 exercícios, formatos VARIADOS
    {
      "kind": "multiple_choice" | "fill_blank" | "order_tokens" | "match_pairs" | "true_false" | "listen_type" | "translate" | "open_writing",
      "prompt": string,                  // enunciado
      "code": string | null,             // trecho de código/frase de apoio (null se não houver)
      "options": string[] | null,        // multiple_choice/true_false: alternativas; order_tokens: tokens embaralhados; match_pairs: ["a::1","b::2"...]
      "answer": string,                  // resposta correta (para order_tokens: sequência correta unida por espaço; match_pairs: pares corretos "a::1|b::2")
      "explanation": string              // por que a resposta certa é certa (2+ frases, cita o conceito)
    }
  ]
}

REGRAS OBRIGATÓRIAS:
- Idioma da interface/explicações: português brasileiro.${isEnglish ? `
- Esta é uma lição de INGLÊS TÉCNICO nível CEFR ${track.cefr}: os textos-alvo, frases, vocabulário e exercícios devem estar em INGLÊS calibrado para ${track.cefr}, com enunciados/explicações em português. Inclua pelo menos 2 exercícios "listen_type" (frase em inglês no campo code para TTS) e 1 "translate".` : `
- Esta é uma lição TÉCNICA de engenharia de software. Inclua código real na teoria e pelo menos 2 exercícios envolvendo leitura de código.`}
- Variedade: use no mínimo 4 kinds diferentes de exercício.
- Nada de placeholders ("TODO", "lorem", "exemplo aqui", "..."). Conteúdo completo e específico.
- Dificuldade progressiva: esta é a lição ${index + 1} de ${track.lessons.length} da trilha "${track.name}".
- Para multiple_choice: exatamente 4 opções, resposta = texto exato de uma opção.
- Para true_false: options = ["Verdadeiro","Falso"].

RIGOR TÉCNICO (INEGOCIÁVEL — lição será REJEITADA se violar):
- Todo fato técnico deve ser verdadeiro e verificável: sintaxe real, comportamento real de ferramenta, complexidade real de algoritmo, definição correta de padrão. NUNCA invente um fato "plausível".
- PROIBIDO: métodos/funções de biblioteca que não existem, comandos incorretos, sintaxe inválida, estatísticas sem fonte, citações fabricadas.
- Todo bloco de código apresentado como exemplo real SERÁ EXECUTADO automaticamente (JS/TS/Python rodam; C++ compila). Ele deve rodar sozinho, sem dependências externas, e produzir exatamente o resultado descrito no texto. Se precisar de saída, use console.log/print. Pseudocódigo deve usar \u0060\u0060\u0060text.
- Conceitos com múltiplas abordagens válidas (SQL vs NoSQL, monolito vs microsserviços…) devem ser apresentados como trade-offs reais com prós e contras, nunca como verdade única.
- Profundidade de curso técnico sério, NÃO de app de vocabulário: contexto concreto de dia a dia de dev, teoria completa, caso aplicado "você recebeu isso em produção/na faculdade". Uma definição de dicionário seguida de perguntas rasas é inaceitável.${refBlock}

TRILHA: ${track.name} — ${track.description}
LIÇÃO: "${lessonTitle}"`;
}

// --- validação -------------------------------------------------------------
// Case-sensitive para TODO/FIXME/XXX ("todo" é palavra normal em português).
const BAD_MARKERS = /\b(TODO|FIXME|XXX)\b|lorem ipsum|\bplaceholder\b|exemplo aqui/;
function validateLesson(l, track) {
  const errs = [];
  if (!l.title || l.title.length < 6) errs.push('title curto');
  if (!l.context || l.context.length < 200) errs.push('context curto');
  if (!l.theory || l.theory.length < 900) errs.push('theory curta');
  if (!l.useCase || l.useCase.length < 120) errs.push('useCase curto');
  if (track.kind === 'tech' && !/```/.test(l.theory)) errs.push('theory sem bloco de código');
  if (!Array.isArray(l.vocabulary) || l.vocabulary.length < 3) errs.push('vocabulário insuficiente');
  if (!Array.isArray(l.exercises) || l.exercises.length < 8 || l.exercises.length > 16) errs.push(`exercícios: ${l.exercises?.length}`);
  const kinds = new Set((l.exercises || []).map((e) => e.kind));
  if (kinds.size < 4) errs.push('pouca variedade de formatos');
  for (const [i, e] of (l.exercises || []).entries()) {
    if (!e.prompt || e.prompt.length < 12) errs.push(`ex${i}: prompt curto`);
    if (!e.answer) errs.push(`ex${i}: sem answer`);
    if (!e.explanation || e.explanation.length < 40) errs.push(`ex${i}: explicação curta`);
    if (e.kind === 'multiple_choice' && (!Array.isArray(e.options) || e.options.length !== 4 || !e.options.includes(e.answer)))
      errs.push(`ex${i}: multiple_choice inválido`);
    if (e.kind === 'true_false' && !['Verdadeiro', 'Falso'].includes(e.answer)) errs.push(`ex${i}: true_false inválido`);
  }
  const full = JSON.stringify(l);
  if (BAD_MARKERS.test(full)) errs.push('contém marcador de placeholder');
  return errs;
}

// Validação completa: estrutura + EXECUÇÃO real dos blocos de código.
async function validateLessonFull(l, track) {
  const errs = validateLesson(l, track);
  if (errs.length === 0 && process.env.SKIP_CODE_EXEC !== '1') {
    const { errors } = await validateLessonCode(l);
    errs.push(...errors);
  }
  return errs;
}

function parseJSONLoose(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('sem JSON');
  const slice = t.slice(start, end + 1);
  try { return JSON.parse(slice); } catch { /* repara */ }
  return JSON.parse(jsonrepair(slice));
}

// --- geração ---------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FORCE = process.env.FORCE_REGEN === '1';

async function generateLesson(track, lessonTitle, index, sources = []) {
  const dir = path.join(OUT, track.id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${String(index + 1).padStart(2, '0')}.json`);
  if (fs.existsSync(file) && !FORCE) {
    try {
      const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
      if ((await validateLessonFull(existing, track)).length === 0) return { skipped: true };
    } catch { /* regenerate */ }
  }
  let lastErrs = [];
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const raw = await chat([
        { role: 'system', content: 'Você gera conteúdo didático técnico em JSON estrito, com rigor técnico absoluto (nenhum fato inventado, código 100% executável). Responda SOMENTE com o objeto JSON.' },
        { role: 'user', content: lessonPrompt(track, lessonTitle, index, sources) + (lastErrs.length ? `\n\nA tentativa anterior falhou na validação automática: ${lastErrs.join('; ')}. Corrija exatamente esses pontos (se um bloco de código falhou na execução, reescreva-o para rodar sozinho e sem erros).` : '') },
      ]);
      const lesson = parseJSONLoose(raw);
      lesson.trackId = track.id;
      lesson.world = track.world;
      lesson.order = index + 1;
      lesson.slug = `${track.id}-${index + 1}`;
      lesson.xp = 20 + Math.min(30, index * 3);
      lesson.source = sources.length
        ? { kind: 'user_material', files: sources.map((s) => s.fileName) }
        : { kind: 'consolidated' };
      lastErrs = await validateLessonFull(lesson, track);
      if (lastErrs.length === 0) {
        fs.writeFileSync(file, JSON.stringify(lesson, null, 1));
        return { ok: true };
      }
      console.warn(`  ⚠ ${track.id}#${index + 1} tentativa ${attempt}: ${lastErrs.join('; ').slice(0, 300)}`);
    } catch (err) {
      if (err.retryAfter) {
        console.warn(`  ⏳ rate limit — aguardando ${err.retryAfter}s…`);
        await sleep(err.retryAfter * 1000);
        attempt--; // não conta como tentativa de conteúdo
        continue;
      }
      lastErrs = [String(err.message).slice(0, 160)];
      console.warn(`  ⚠ ${track.id}#${index + 1} tentativa ${attempt}: ${lastErrs[0]}`);
    }
  }
  return { failed: true, errs: lastErrs };
}

async function run() {
  const filter = process.argv[2];
  const tracks = filter ? ALL_TRACKS.filter((t) => t.id === filter) : ALL_TRACKS;
  const knowledge = await loadKnowledgeSources();
  const jobs = [];
  for (const track of tracks)
    track.lessons.forEach((title, i) => jobs.push({ track, title, i }));

  console.log(`Gerando ${jobs.length} lições (${tracks.length} trilhas), concorrência ${CONCURRENCY}…`);
  let done = 0, ok = 0, skip = 0, fail = 0;
  const failures = [];
  const queue = [...jobs];
  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      const r = await generateLesson(job.track, job.title, job.i, knowledge[job.track.id] || []);
      done++;
      if (r.ok) ok++;
      else if (r.skipped) skip++;
      else { fail++; failures.push(`${job.track.id}#${job.i + 1}: ${(r.errs || []).join('; ').slice(0, 200)}`); console.error(`  ✗ FALHOU: ${job.track.id}#${job.i + 1}`); }
      if (done % 10 === 0 || queue.length === 0)
        console.log(`  progresso ${done}/${jobs.length} (novos:${ok} existentes:${skip} falhas:${fail})`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nConcluído. novos=${ok} existentes=${skip} falhas=${fail}`);
  if (failures.length) { console.log('Falhas detalhadas:'); failures.forEach((f) => console.log('  -', f)); }
  if (fail > 0) process.exit(1);
}
run();
