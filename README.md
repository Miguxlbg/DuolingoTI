# Duolingo da TI — v3

Plataforma pessoal de aprendizado gamificado para **Engenharia de Software** e **Inglês Técnico (A1–C2)**, construída com Next.js 15 + TypeScript + Supabase, pronta para hospedar na **Vercel**.

> Sem sistema de vidas: errar nunca bloqueia o estudo.

---

## ✅ O que está pronto (v3)

### Mascote REAL (imagens originais, sem redesenho)
- Script `scripts/process-mascot-assets.py` segmenta os arquivos originais (`assets-src/`) com remoção de fundo por flood-fill (preserva brancos internos como olhos e caneca).
- 8 estados extraídos em `public/mascot/states/` + 11 peças de efeito em `public/mascot/fx/`.
- Componente `Mascot.tsx` com crossfade entre estados, animações CSS (bounce, breathe, shake, corações, lágrimas, faíscas) e respeito a `prefers-reduced-motion`.
- **Escopo atual (a pedido): apenas HAPPY e ANGRY animados.** Os outros 6 estados já estão processados e mapeados — basta ativar no `ACTIVE` map do `Mascot.tsx`.

### Motor de conteúdo REAL (nada de lorem ipsum)
- **16 trilhas / 161 lições** definidas em `scripts/syllabus.mjs`:
  - 10 disciplinas tech: Lógica e Algoritmos, Programação Multi-linguagem, Estruturas de Dados, Bancos de Dados, Design de Software/APIs, Cloud & DevOps, Testes, Git, Ágil, Soft Skills.
  - 6 níveis CEFR de inglês técnico: A1, A2, B1, B2, C1, C2.
- `scripts/generate-content.mjs`: gera lições por IA (Gemini/OpenAI) com **validação automática** — rejeita placeholders, exige teoria ≥900 caracteres, código real em trilhas tech, 9–13 exercícios de ≥4 formatos diferentes, com 3 tentativas por lição.
- `scripts/build-content-index.mjs`: publica o conteúdo em `public/content/` (estático — funciona na Vercel sem servidor).
- **2 lições exemplares completas já incluídas** (logic-algorithms/01 e english-a1/01) provando o pipeline.

### App
- `LessonPlayer.tsx`: fase de teoria (contexto + teoria + caso prático + **diagrama SVG gerado por código**) seguida de exercícios em **8 formatos**: múltipla escolha, preencher lacuna, ordenar blocos, parear, verdadeiro/falso, ouvir e digitar (TTS), traduzir, escrita livre.
- Tela "Aprender" com as 16 trilhas reais, progresso por trilha, desbloqueio sequencial de lições e barra de progresso.
- Glossário pessoal: termos de vocabulário salvos automaticamente ao concluir lições.
- Login redesenhado: fundo com blobs animados, glassmorphism, chips de código flutuantes.
- Fundos animados (`.bg-anim`), tema claro/escuro, XP/gems/ofensiva, bônus por lição perfeita.
- **PWA**: manifest + ícones gerados do mascote (instalável no celular).
- Responsivo (375px / 768px / 1440px) e acessível (aria, reduced-motion).

### Banco (Supabase)
- `supabase/migrations/0001_initial.sql`: perfis, mundos, lições, progresso, XP, RLS.
- `supabase/migrations/0002_social.sql` (novo): amizades, presença, feed de atividade, **duelos 1x1**, **corridas em grupo**, metas semanais/mensais, preferências de tema, glossário sincronizado, log de lembretes de ofensiva — tudo com RLS.

---

## ⚠️ O que falta (e como resolver)

| Item | O que fazer |
|---|---|
| **GEMINI_API_KEY** (único bloqueio real) | Crie grátis em https://aistudio.google.com/apikey → cole no `.env.local` → rode `node scripts/generate-content.mjs` para gerar as 159 lições restantes. As chaves testadas no sandbox não tinham crédito de IA. |
| **Rodar migrations no Supabase** | Painel do Supabase → SQL Editor → cole e execute `0001_initial.sql`, depois `0002_social.sql`. Sem isso o login usa modo local (funciona, mas sem conta real). |
| **Social ao vivo (duelos/corridas/presença)** | As tabelas estão prontas (0002). A UI atual mostra dados locais; ligar a UI ao Supabase Realtime é a próxima etapa. |
| Mascote: 6 estados restantes | Já processados. Ativar quando você avisar (edição de 1 arquivo). |
| Resend (e-mail de ofensiva) / Cloudinary (avatar) | Chaves já no `.env.local`; falta apenas o `CLOUDINARY_API_SECRET` (painel do Cloudinary → Settings → API Keys). Opcionais. |

---

## 🚀 Como rodar localmente

```bash
npm install
cp .env.example .env.local   # e preencha (ou use o .env.local já preparado)
npm run dev                  # http://localhost:3000
```

### Gerar as lições restantes por IA

```bash
# 1. coloque GEMINI_API_KEY=... no .env.local (grátis em aistudio.google.com/apikey)
# 2. gere tudo (ou uma trilha por vez):
node scripts/generate-content.mjs                 # todas as trilhas
node scripts/generate-content.mjs english-a2      # só uma trilha
# 3. publique para o app:
node scripts/build-content-index.mjs
```

O gerador **valida cada lição** (sem placeholders, tamanho mínimo, variedade de exercícios) e tenta 3 vezes antes de desistir. Lições já válidas são puladas — pode rodar quantas vezes quiser.

---

## 🌐 Hospedagem na Vercel — tutorial completo

### Opção A — Automática pelo GitHub (recomendada)

1. Acesse https://vercel.com e faça login com sua conta **GitHub** (Miguxlbg).
2. Clique em **Add New… → Project**.
3. Em "Import Git Repository", escolha **Miguxlbg/DuolingoTI** (autorize o Vercel no GitHub se pedir).
4. O Vercel detecta Next.js automaticamente — não mude Build Command nem Output.
5. Abra **Environment Variables** e adicione:
   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://mdzlnwzvmsratsbsrzbd.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sua chave publishable |
   | `SUPABASE_SERVICE_ROLE_KEY` | sua chave secret (Server only) |
   | `RESEND_API_KEY` | opcional |
6. Clique em **Deploy**. Em ~2 minutos você recebe a URL `https://duolingo-ti-xxx.vercel.app`.
7. **A partir daí, todo `git push` na branch principal publica sozinho.**

### Opção B — Pelo terminal (CLI)

```bash
npm i -g vercel          # instala a CLI
cd DuolingoTI
vercel login             # abre o navegador para autenticar
vercel                   # primeiro deploy (preview) — aceite os padrões
# adicione as variáveis de ambiente:
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# deploy final de produção:
vercel --prod
```

> 💡 Gere o conteúdo das lições ANTES do deploy (`node scripts/generate-content.mjs && node scripts/build-content-index.mjs`) e faça commit da pasta `public/content/` — o conteúdo é estático e viaja junto com o site.

---

## 📁 Estrutura

```
scripts/
  process-mascot-assets.py   # segmenta o mascote original (PIL+numpy+scipy)
  syllabus.mjs               # 16 trilhas / 161 lições
  generate-content.mjs       # motor de geração por IA com validação
  build-content-index.mjs    # publica conteúdo em public/content
content/generated/           # lições fonte (JSON)
public/content/              # conteúdo servido ao app + index.json
public/mascot/               # estados e efeitos do mascote processados
src/components/
  DuoTIApp.tsx               # app principal (views)
  LessonPlayer.tsx           # player com teoria + 8 formatos de exercício
  Mascot.tsx                 # mascote real com animações
src/lib/content.ts           # loaders, progresso local e glossário
supabase/migrations/         # 0001 (base) + 0002 (social/duelos/metas)
```

## 🔑 Variáveis de ambiente (`.env.local`, nunca commitado)

Veja `.env.example`. Resumo: Supabase (URL + anon + service), `GEMINI_API_KEY` (geração de conteúdo), `RESEND_API_KEY` e Cloudinary (opcionais).
