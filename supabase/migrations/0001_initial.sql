-- Duolingo da TI — schema inicial sem sistema de vidas
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Dev', username text unique,
  avatar_url text, bio text, college text, course text,
  english_level text not null default 'A1 — Iniciante', skills text[] not null default '{}',
  xp_total integer not null default 0 check (xp_total >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  gems integer not null default 0 check (gems >= 0),
  daily_goal integer not null default 30,
  last_seen timestamptz default now(), created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.worlds (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  name text not null, description text not null, color text not null, position integer not null default 0
);
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(), world_id uuid not null references public.worlds on delete cascade,
  slug text not null, title text not null, description text, position integer not null default 0,
  unique(world_id, slug)
);
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(), module_id uuid not null references public.modules on delete cascade,
  slug text not null, title text not null, subtitle text, content_md text not null,
  diagram_mermaid text, xp_reward integer not null default 50, position integer not null default 0,
  published boolean not null default true, unique(module_id, slug)
);
create table if not exists public.exercise_items (
  id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.lessons on delete cascade,
  type text not null check(type in ('choice','fill','sentence','listen','speak','match','truefalse','code')),
  prompt text not null, payload jsonb not null, answer jsonb not null, explanation text not null, position integer not null default 0
);
create table if not exists public.lesson_progress (
  user_id uuid not null references public.profiles on delete cascade,
  lesson_id uuid not null references public.lessons on delete cascade,
  status text not null default 'started' check(status in ('started','completed','mastered')),
  best_score integer not null default 0, attempts integer not null default 0, completed_at timestamptz,
  primary key(user_id, lesson_id)
);
create table if not exists public.exercise_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
  exercise_id uuid not null references public.exercise_items on delete cascade,
  is_correct boolean not null, response jsonb, duration_ms integer, created_at timestamptz default now()
);
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
  amount integer not null check(amount > 0), source text not null, source_id uuid, created_at timestamptz default now()
);
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.profiles on delete cascade,
  addressee_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','blocked')),
  created_at timestamptz default now(), unique(requester_id, addressee_id), check(requester_id <> addressee_id)
);
create table if not exists public.presence (
  user_id uuid primary key references public.profiles on delete cascade,
  status_text text default 'Online', current_lesson_id uuid references public.lessons on delete set null,
  is_online boolean not null default false, updated_at timestamptz default now()
);
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(), name text unique not null, tier integer unique not null, color text not null
);
create table if not exists public.league_members (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  week_start date not null, weekly_xp integer not null default 0,
  primary key(league_id,user_id,week_start)
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null,
  description text not null, difficulty text not null, stack text[] not null default '{}', brief_md text not null, published boolean default true
);
create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null references public.profiles on delete cascade, github_url text not null,
  status text not null default 'draft', feedback text, created_at timestamptz default now()
);
create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  description text, category text not null, price_gems integer not null check(price_gems >= 0), asset_key text, active boolean default true
);
create table if not exists public.user_shop_items (
  user_id uuid not null references public.profiles on delete cascade,
  item_id uuid not null references public.shop_items on delete cascade,
  equipped boolean default false, unlocked_at timestamptz default now(), primary key(user_id,item_id)
);
create table if not exists public.mascot_states (
  slug text primary key, label text not null, layers jsonb not null, animation text
);

alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.exercise_attempts enable row level security;
alter table public.xp_events enable row level security;
alter table public.friendships enable row level security;
alter table public.presence enable row level security;
alter table public.project_submissions enable row level security;
alter table public.user_shop_items enable row level security;

create policy "Perfis são públicos para leitura" on public.profiles for select using (true);
create policy "Usuário edita o próprio perfil" on public.profiles for update using (auth.uid() = id);
create policy "Usuário cria o próprio perfil" on public.profiles for insert with check (auth.uid() = id);
create policy "Progresso privado" on public.lesson_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Tentativas privadas" on public.exercise_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "XP próprio" on public.xp_events for select using (auth.uid() = user_id);
create policy "Amizades dos envolvidos" on public.friendships for all using (auth.uid() in (requester_id,addressee_id)) with check (auth.uid() = requester_id);
create policy "Presença pública" on public.presence for select using (true);
create policy "Atualiza própria presença" on public.presence for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Submissões próprias" on public.project_submissions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Itens próprios" on public.user_shop_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,name,username)
  values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),split_part(new.email,'@',1)||'_'||left(new.id::text,6));
  insert into public.presence(user_id) values(new.id);
  return new;
end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into public.worlds(slug,name,description,color,position) values
('academic','Mundo Acadêmico','Engenharia de Software com base sólida.','#7c3aed',1),
('english','Inglês Técnico','Inglês usado por times de tecnologia.','#ec4899',2),
('bootcamp','Mundo Bootcamp','Projetos full-stack de ponta a ponta.','#0ea5e9',3)
on conflict(slug) do nothing;
insert into public.leagues(name,tier,color) values ('Bronze',1,'#b77942'),('Prata',2,'#9ca3af'),('Ouro',3,'#f59e0b'),('Diamante',4,'#22d3ee') on conflict do nothing;
insert into public.shop_items(slug,name,description,category,price_gems,asset_key) values
('headphone-neon','Headphone Neon','Devito no modo foco.','outfit',120,'headphone'),
('bone-hacker','Boné Hacker','Código limpo, estilo também.','outfit',180,'cap'),
('caneca-code','Caneca CODE + CAFÉ','Energia para mais uma lição.','prop',90,'coffee'),
('cyber-night','Tema Cyber Night','Cores neon exclusivas.','theme',240,'theme') on conflict do nothing;
insert into public.mascot_states(slug,label,layers,animation) values
('feliz','Feliz','["head","eyes","glasses","beak","hoodie","wings"]','blink'),
('apaixonado','Apaixonado','["head","happy-eyes","glasses","beak","hoodie","wings-up","hearts"]','float'),
('cansado','Cansado + café','["head","tired-eyes","glasses","beak","hoodie","coffee"]','sway'),
('conectando','Conectando','["head","wink-eyes","cap","beak","usb"]','bounce'),
('programando','Programando','["head","eyes","glasses","beak","hoodie","keyboard"]','typing'),
('ouvindo_musica','Ouvindo música','["head","happy-eyes","glasses","headphone","notes"]','dance'),
('bravo','Bravo','["head","angry-eyes","glasses","beak","laptop","anger"]','beakShake'),
('erro404','Erro 404','["head","sad-eyes","glasses","beak","monitor","tears"]','tearDrop') on conflict(slug) do update set layers=excluded.layers,animation=excluded.animation;
