-- Duolingo da TI — v3: social real, duelos, corridas, metas, temas e glossário
-- Rode este arquivo APÓS o 0001_initial.sql no SQL Editor do Supabase.

-- ===== Amizades e presença =====
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz default now(), responded_at timestamptz,
  unique(requester, addressee),
  check (requester <> addressee)
);

create table if not exists public.presence (
  user_id uuid primary key references public.profiles on delete cascade,
  online boolean not null default false,
  activity text, -- ex.: "estudando logic-algorithms lição 3"
  updated_at timestamptz default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('lesson_completed','streak_milestone','duel_won','race_won','level_up','goal_met')),
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);
create index if not exists activity_events_user_idx on public.activity_events(user_id, created_at desc);

-- ===== Duelos (1x1) =====
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references public.profiles on delete cascade,
  opponent uuid not null references public.profiles on delete cascade,
  track_id text not null, lesson_n integer not null,
  status text not null default 'pending' check (status in ('pending','active','finished','declined','expired')),
  winner uuid references public.profiles,
  created_at timestamptz default now(), finished_at timestamptz,
  check (challenger <> opponent)
);

create table if not exists public.duel_attempts (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  score integer not null default 0, mistakes integer not null default 0,
  duration_ms integer, finished_at timestamptz default now(),
  unique(duel_id, user_id)
);

-- ===== Corridas em grupo =====
create table if not exists public.race_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null, owner uuid not null references public.profiles on delete cascade,
  track_id text not null, target_lessons integer not null default 5,
  starts_at timestamptz default now(), ends_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.race_group_members (
  group_id uuid not null references public.race_groups on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

create table if not exists public.race_progress (
  group_id uuid not null references public.race_groups on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  lessons_done integer not null default 0, xp_earned integer not null default 0,
  updated_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- ===== Metas semanais/mensais =====
create table if not exists public.periodic_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  period text not null check (period in ('weekly','monthly')),
  period_start date not null,
  target_xp integer not null default 200,
  earned_xp integer not null default 0,
  met boolean not null default false,
  unique(user_id, period, period_start)
);

-- ===== Preferências de tema =====
create table if not exists public.theme_preferences (
  user_id uuid primary key references public.profiles on delete cascade,
  mode text not null default 'system' check (mode in ('light','dark','system')),
  accent_color text not null default '#58cc02',
  reduced_motion boolean not null default false,
  updated_at timestamptz default now()
);

-- ===== Glossário pessoal (sincroniza o localStorage) =====
create table if not exists public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  term text not null, definition text not null, example text,
  track_id text not null, lesson_title text,
  created_at timestamptz default now(),
  unique(user_id, term)
);

-- ===== Log de lembretes de ofensiva (Resend) =====
create table if not exists public.streak_reminders_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  sent_at timestamptz default now(), channel text not null default 'email'
);

-- ===== RLS =====
alter table public.friendships enable row level security;
alter table public.presence enable row level security;
alter table public.activity_events enable row level security;
alter table public.duels enable row level security;
alter table public.duel_attempts enable row level security;
alter table public.race_groups enable row level security;
alter table public.race_group_members enable row level security;
alter table public.race_progress enable row level security;
alter table public.periodic_goals enable row level security;
alter table public.theme_preferences enable row level security;
alter table public.glossary_terms enable row level security;
alter table public.streak_reminders_log enable row level security;

-- amizades: só envolvidos veem/gerenciam
create policy "friendships_select" on public.friendships for select using (auth.uid() in (requester, addressee));
create policy "friendships_insert" on public.friendships for insert with check (auth.uid() = requester);
create policy "friendships_update" on public.friendships for update using (auth.uid() in (requester, addressee));
create policy "friendships_delete" on public.friendships for delete using (auth.uid() in (requester, addressee));

-- presença: todos autenticados leem, dono escreve
create policy "presence_select" on public.presence for select using (auth.role() = 'authenticated');
create policy "presence_upsert" on public.presence for insert with check (auth.uid() = user_id);
create policy "presence_update" on public.presence for update using (auth.uid() = user_id);

-- feed: autenticados leem, dono escreve
create policy "activity_select" on public.activity_events for select using (auth.role() = 'authenticated');
create policy "activity_insert" on public.activity_events for insert with check (auth.uid() = user_id);

-- duelos: envolvidos
create policy "duels_select" on public.duels for select using (auth.uid() in (challenger, opponent));
create policy "duels_insert" on public.duels for insert with check (auth.uid() = challenger);
create policy "duels_update" on public.duels for update using (auth.uid() in (challenger, opponent));
create policy "duel_attempts_select" on public.duel_attempts for select using (
  exists (select 1 from public.duels d where d.id = duel_id and auth.uid() in (d.challenger, d.opponent))
);
create policy "duel_attempts_insert" on public.duel_attempts for insert with check (auth.uid() = user_id);

-- corridas: membros veem, dono cria
create policy "race_groups_select" on public.race_groups for select using (auth.role() = 'authenticated');
create policy "race_groups_insert" on public.race_groups for insert with check (auth.uid() = owner);
create policy "race_groups_update" on public.race_groups for update using (auth.uid() = owner);
create policy "race_members_select" on public.race_group_members for select using (auth.role() = 'authenticated');
create policy "race_members_insert" on public.race_group_members for insert with check (auth.uid() = user_id);
create policy "race_members_delete" on public.race_group_members for delete using (auth.uid() = user_id);
create policy "race_progress_select" on public.race_progress for select using (auth.role() = 'authenticated');
create policy "race_progress_upsert" on public.race_progress for insert with check (auth.uid() = user_id);
create policy "race_progress_update" on public.race_progress for update using (auth.uid() = user_id);

-- metas / tema / glossário / lembretes: apenas o dono
create policy "goals_all" on public.periodic_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "theme_all" on public.theme_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "glossary_all" on public.glossary_terms for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reminders_select" on public.streak_reminders_log for select using (auth.uid() = user_id);
