# Duolingo da TI

Plataforma pessoal de aprendizado gamificado para **Inglês Técnico**, **Engenharia de Software** e **bootcamps**, construída com Next.js, TypeScript e Supabase para hospedagem na Vercel.

> O projeto não inclui sistema de vidas. Erros não bloqueiam o estudo.

## Funcionalidades concluídas

- Login/cadastro simples por e-mail e senha com Supabase Auth quando configurado; modo local de demonstração como fallback.
- Dashboard responsivo com meta diária, XP, ofensiva, gems e liga semanal.
- Tema claro/escuro no topo, salvo no navegador.
- Perfil no canto superior e página de perfil customizável:
  - foto por upload local ou URL;
  - nome, usuário, bio, faculdade e curso;
  - nível CEFR de inglês;
  - tecnologias e conhecimentos (Next.js, Python etc.).
- Três mundos navegáveis: Acadêmico, Inglês Técnico e Bootcamp.
- Mapa de aprendizagem com lições concluídas, atual, bloqueadas e checkpoints.
- Player de lição funcional com respostas, feedback, XP e gems.
- TTS gratuito pelo Web Speech API.
- Tutor com Gemini opcional e fallback local gratuito.
- Ranking semanal, amigos/status online, projetos e loja sem dinheiro real.
- Mascote modular em camadas CSS com oito estados:
  - feliz, apaixonado, cansado, conectando, programando, ouvindo música, bravo e erro 404;
  - piscadas, lágrimas, bico tremendo, dança, flutuação e movimentos reduzidos conforme preferência de acessibilidade.
- Layout adaptado para desktop, tablet e celular.
- Migração SQL do Supabase com RLS, trigger de perfil e dados iniciais.
- Assets de referência fornecidos preservados em `public/references/`.

## Rotas e entradas

| URI | Uso |
|---|---|
| `/` | Aplicação completa; login e todas as áreas internas funcionam como SPA |
| `/api/ai` | `POST { "prompt": "..." }`; usa Gemini se configurado ou resposta local |
| rota inexistente | Tela 404 com mascote triste animado |

As seções internas (Início, Aprender, Projetos, Ranking, Amigos, Loja e Perfil) são controladas no cliente para manter transições imediatas.

## Stack

- Next.js App Router 15
- React 19 + TypeScript
- CSS autoral responsivo (sem dependência visual paga)
- Supabase Free: Postgres, Auth, RLS e Realtime/presença preparados
- Gemini API opcional
- Web Speech API
- Vercel

## Estrutura

```text
src/app/                 rotas, layout, estilos e endpoint de IA
src/components/          app principal, mascote e tema
src/lib/                 dados, tipos, Supabase e fallback local
src/services/            abstrações de IA e voz
supabase/migrations/     schema SQL, políticas RLS e seeds
public/references/       imagens fornecidas como referência
```

## Configuração local

1. Instale Node.js 20 ou 22.
2. Instale dependências:
   ```bash
   npm install
   ```
3. Copie o arquivo de ambiente:
   ```bash
   cp .env.example .env.local
   ```
4. Preencha somente as variáveis que usar.
5. Rode:
   ```bash
   npm run dev
   ```
6. Abra `http://localhost:3000`.

Sem `.env.local`, o app continua funcional em modo demonstração com `localStorage` e tutor offline.

## Supabase

1. Abra o SQL Editor do projeto Supabase.
2. Execute `supabase/migrations/0001_initial.sql`.
3. Em Authentication, habilite Email/Password.
4. Configure a URL do site e callback para sua URL da Vercel.
5. Defina na Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` apenas se futuras rotas administrativas exigirem.

A chave de service role nunca pode usar o prefixo `NEXT_PUBLIC_`.

## Deploy na Vercel

1. Importe esta pasta/repositório na Vercel.
2. Framework Preset: **Next.js**.
3. Build Command: `npm run build`.
4. Adicione as variáveis de ambiente.
5. Faça o deploy.
6. Atualize no Supabase as URLs de autenticação com o domínio gerado.

O build de produção foi validado em Linux com sucesso.

## Modelo de dados

A migração inclui `profiles`, `worlds`, `modules`, `lessons`, `exercise_items`, `lesson_progress`, `exercise_attempts`, `xp_events`, `friendships`, `presence`, `leagues`, `league_members`, `projects`, `project_submissions`, `shop_items`, `user_shop_items` e `mascot_states`.

- Conteúdo publicado: leitura pública a ser consumida no app.
- Perfil: leitura pública, edição apenas pelo dono.
- Progresso, tentativas, submissões e inventário: privados por usuário via RLS.
- Presença: leitura pública entre usuários, atualização apenas pelo dono.

## Serviços e fallbacks

| Recurso | Primário | Fallback |
|---|---|---|
| Banco/Auth | Supabase Free | localStorage/demo |
| Tutor IA | Gemini Free | explicação local |
| TTS | Web Speech API | botão fica sem áudio em navegador incompatível |
| STT | Web Speech API | entrada digitada |
| Imagens de perfil | Supabase/Cloudinary futuro | arquivo convertido localmente ou URL |
| E-mail | Resend futuro | notificações internas |

Nenhuma integração obrigatória exige cartão ou pagamento.

## Segurança

- `.env`, `.env.local`, `.env.production` e chaves são ignorados pelo Git.
- Nunca coloque service role, PAT do GitHub, segredo Cloudinary ou chave Resend no frontend.
- As credenciais que tenham sido compartilhadas em mensagens devem ser revogadas antes do deploy.
- O login local é apenas fallback de demonstração; para uso online entre amigos, configure Supabase Auth e aplique a migração.

## Ainda não implementado

- Motor administrativo completo de geração em lote e PDFs.
- Persistência remota de todas as interações da interface (o schema e cliente já estão preparados).
- Github OAuth/submissão automática — mantido fora do login por solicitação de login simples.
- Certificados verificáveis, notificações por e-mail e avaliação STT completa.
- Cron de fechamento automático das ligas semanais.

## Próximos passos recomendados

1. Revogar as credenciais publicadas e cadastrar novas diretamente na Vercel.
2. Aplicar a migração no Supabase.
3. Conectar ações de XP, loja, amizades e progresso às tabelas já criadas.
4. Adicionar `GEMINI_API_KEY` somente se desejar geração dinâmica.
5. Criar painel de conteúdo com revisão humana antes de publicar lições geradas.

## Estado

- Build: aprovado (`next build`)
- Desenvolvimento local: aprovado na porta 3000
- Produção: pronta para importação na Vercel; URL ainda não criada
- Última atualização: 18 de julho de 2026
