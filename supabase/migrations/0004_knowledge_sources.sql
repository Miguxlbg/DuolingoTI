-- 0004: fontes de conhecimento extraídas dos documentos do usuário.
-- O motor de conteúdo (scripts/generate-content.mjs) lê esta tabela e usa o
-- texto como material de referência prioritário na geração de lições.

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  file_name text not null default '',
  kind text not null default 'outro' check (kind in ('pdf','certificado','aula','projeto','outro')),
  track_id text,               -- trilha do syllabus associada (null = sem associação segura)
  text_content text not null default '',
  summary text not null default '',
  skills text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists knowledge_sources_track_idx on public.knowledge_sources (track_id);
create index if not exists knowledge_sources_user_idx on public.knowledge_sources (user_id);

alter table public.knowledge_sources enable row level security;

drop policy if exists "knowledge_sources_select_own" on public.knowledge_sources;
create policy "knowledge_sources_select_own" on public.knowledge_sources
  for select using (auth.uid() = user_id);

drop policy if exists "knowledge_sources_insert_own" on public.knowledge_sources;
create policy "knowledge_sources_insert_own" on public.knowledge_sources
  for insert with check (auth.uid() = user_id);

drop policy if exists "knowledge_sources_update_own" on public.knowledge_sources;
create policy "knowledge_sources_update_own" on public.knowledge_sources
  for update using (auth.uid() = user_id);

drop policy if exists "knowledge_sources_delete_own" on public.knowledge_sources;
create policy "knowledge_sources_delete_own" on public.knowledge_sources
  for delete using (auth.uid() = user_id);

-- Histórico de execuções do motor de conteúdo (painel /admin/content-engine)
create table if not exists public.content_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  track_id text not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  lessons_generated int not null default 0,
  lessons_failed int not null default 0,
  token_cost_estimate int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.content_generation_jobs enable row level security;

drop policy if exists "cgj_select_all" on public.content_generation_jobs;
create policy "cgj_select_all" on public.content_generation_jobs
  for select using (auth.role() = 'authenticated');
