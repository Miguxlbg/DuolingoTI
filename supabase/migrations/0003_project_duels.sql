-- Duolingo da TI — v4: duelo de projetos com avaliação por IA (0–100)
-- Rode APÓS 0001 e 0002 no SQL Editor do Supabase.

create table if not exists public.project_duels (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references public.profiles on delete cascade,
  opponent uuid not null references public.profiles on delete cascade,
  same_project boolean not null default true,
  brief_challenger text not null,
  brief_opponent text not null,
  deadline timestamptz not null,
  status text not null default 'pending' check (status in ('pending','active','submitted','evaluated','declined','expired')),
  winner uuid references public.profiles,
  created_at timestamptz default now(),
  check (challenger <> opponent)
);

create table if not exists public.project_duel_entries (
  duel_id uuid not null references public.project_duels on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  repo_url text not null,
  description text,
  submitted_at timestamptz default now(),
  -- avaliação da IA
  score integer check (score between 0 and 100),
  evaluation jsonb, -- {frontend:{score,notes},backend:{...},security:{...},architecture:{...},tests:{...},docs:{...},summary}
  evaluated_at timestamptz,
  primary key (duel_id, user_id)
);

alter table public.project_duels enable row level security;
alter table public.project_duel_entries enable row level security;

create policy "pduels_select" on public.project_duels for select using (auth.uid() in (challenger, opponent));
create policy "pduels_insert" on public.project_duels for insert with check (auth.uid() = challenger);
create policy "pduels_update" on public.project_duels for update using (auth.uid() in (challenger, opponent));

create policy "pentries_select" on public.project_duel_entries for select using (
  exists (select 1 from public.project_duels d where d.id = duel_id and auth.uid() in (d.challenger, d.opponent))
);
create policy "pentries_insert" on public.project_duel_entries for insert with check (auth.uid() = user_id);
create policy "pentries_update" on public.project_duel_entries for update using (auth.uid() = user_id);

-- Documentos do usuário (PDFs, certificados, aulas, projetos) — sincroniza o local
create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('pdf','certificado','aula','projeto','outro')),
  title text not null, description text, skills text[] not null default '{}',
  file_name text, text_content text, url text,
  created_at timestamptz default now()
);
alter table public.user_documents enable row level security;
create policy "docs_all" on public.user_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
