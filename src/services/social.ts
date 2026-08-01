// Social 100% REAL via Supabase — sem bots, sem dados falsos.
// Se o Supabase não estiver configurado ou as migrations não tiverem sido
// rodadas, as funções retornam estados vazios e a UI mostra instruções.

import { getSupabase } from '@/lib/supabase'

export interface SocialProfile { id: string; name: string; username: string | null; avatar_url: string | null; xp_total: number; streak_days: number }
export interface FriendEntry extends SocialProfile { friendshipId: string; status: 'pending' | 'accepted'; direction: 'sent' | 'received' }

export function socialAvailable(): boolean { return !!getSupabase() }

export async function currentUserId(): Promise<string | null> {
  const sb = getSupabase(); if (!sb) return null
  const { data } = await sb.auth.getUser()
  return data.user?.id ?? null
}

export async function searchUsers(query: string): Promise<SocialProfile[]> {
  const sb = getSupabase(); if (!sb || query.trim().length < 2) return []
  const { data, error } = await sb.from('profiles')
    .select('id,name,username,avatar_url,xp_total,streak_days')
    .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(10)
  if (error) throw new Error(error.message)
  const me = await currentUserId()
  return (data || []).filter((p) => p.id !== me)
}

export async function sendFriendRequest(addressee: string): Promise<void> {
  const sb = getSupabase(); if (!sb) throw new Error('Supabase não configurado')
  const me = await currentUserId(); if (!me) throw new Error('Faça login para adicionar amigos')
  const { error } = await sb.from('friendships').insert({ requester: me, addressee })
  if (error) throw new Error(error.code === '23505' ? 'Convite já enviado' : error.message)
}

export async function respondFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const sb = getSupabase(); if (!sb) throw new Error('Supabase não configurado')
  if (accept) {
    const { error } = await sb.from('friendships').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', friendshipId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await sb.from('friendships').delete().eq('id', friendshipId)
    if (error) throw new Error(error.message)
  }
}

export async function listFriends(): Promise<FriendEntry[]> {
  const sb = getSupabase(); if (!sb) return []
  const me = await currentUserId(); if (!me) return []
  const { data, error } = await sb.from('friendships')
    .select('id,status,requester,addressee, requester_profile:profiles!friendships_requester_fkey(id,name,username,avatar_url,xp_total,streak_days), addressee_profile:profiles!friendships_addressee_fkey(id,name,username,avatar_url,xp_total,streak_days)')
    .in('status', ['pending', 'accepted'])
  if (error) throw new Error(error.message)
  return (data || []).map((f) => {
    const sent = f.requester === me
    const other = (sent ? f.addressee_profile : f.requester_profile) as unknown as SocialProfile
    return { ...other, friendshipId: f.id as string, status: f.status as 'pending' | 'accepted', direction: sent ? 'sent' as const : 'received' as const }
  })
}

// Ranking REAL apenas entre você e seus amigos aceitos
export async function friendLeaderboard(): Promise<SocialProfile[]> {
  const sb = getSupabase(); if (!sb) return []
  const me = await currentUserId(); if (!me) return []
  const friends = (await listFriends()).filter((f) => f.status === 'accepted')
  const ids = [me, ...friends.map((f) => f.id)]
  const { data, error } = await sb.from('profiles')
    .select('id,name,username,avatar_url,xp_total,streak_days')
    .in('id', ids)
    .order('xp_total', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

// ===== Duelos de lição =====
export interface DuelRow { id: string; challenger: string; opponent: string; track_id: string; lesson_n: number; status: string; winner: string | null }
export async function createDuel(opponent: string, trackId: string, lessonN: number): Promise<void> {
  const sb = getSupabase(); if (!sb) throw new Error('Supabase não configurado')
  const me = await currentUserId(); if (!me) throw new Error('Faça login')
  const { error } = await sb.from('duels').insert({ challenger: me, opponent, track_id: trackId, lesson_n: lessonN })
  if (error) throw new Error(error.message)
}
export async function listDuels(): Promise<DuelRow[]> {
  const sb = getSupabase(); if (!sb) return []
  const me = await currentUserId(); if (!me) return []
  const { data, error } = await sb.from('duels').select('*').or(`challenger.eq.${me},opponent.eq.${me}`).order('created_at', { ascending: false }).limit(20)
  if (error) throw new Error(error.message)
  return data || []
}
export async function submitDuelScore(duelId: string, score: number, mistakes: number, durationMs: number): Promise<void> {
  const sb = getSupabase(); if (!sb) throw new Error('Supabase não configurado')
  const me = await currentUserId(); if (!me) throw new Error('Faça login')
  const { error } = await sb.from('duel_attempts').upsert({ duel_id: duelId, user_id: me, score, mistakes, duration_ms: durationMs })
  if (error) throw new Error(error.message)
}

// ===== Duelo de PROJETOS (avaliação por IA 0–100) =====
export interface ProjectDuelRow {
  id: string; challenger: string; opponent: string
  same_project: boolean; brief_challenger: string; brief_opponent: string
  deadline: string; status: string
}
export async function createProjectDuel(opponent: string, sameProject: boolean, briefChallenger: string, briefOpponent: string, deadline: string): Promise<void> {
  const sb = getSupabase(); if (!sb) throw new Error('Supabase não configurado')
  const me = await currentUserId(); if (!me) throw new Error('Faça login')
  const { error } = await sb.from('project_duels').insert({
    challenger: me, opponent, same_project: sameProject,
    brief_challenger: briefChallenger, brief_opponent: sameProject ? briefChallenger : briefOpponent, deadline,
  })
  if (error) throw new Error(error.message)
}
export async function listProjectDuels(): Promise<ProjectDuelRow[]> {
  const sb = getSupabase(); if (!sb) return []
  const me = await currentUserId(); if (!me) return []
  const { data, error } = await sb.from('project_duels').select('*').or(`challenger.eq.${me},opponent.eq.${me}`).order('created_at', { ascending: false }).limit(20)
  if (error) throw new Error(error.message)
  return data || []
}
export async function submitProjectEntry(duelId: string, repoUrl: string, description: string): Promise<void> {
  const sb = getSupabase(); if (!sb) throw new Error('Supabase não configurado')
  const me = await currentUserId(); if (!me) throw new Error('Faça login')
  const { error } = await sb.from('project_duel_entries').upsert({ duel_id: duelId, user_id: me, repo_url: repoUrl, description })
  if (error) throw new Error(error.message)
}

export interface ProjectEvaluation {
  score: number
  frontend: { score: number; notes: string }
  backend: { score: number; notes: string }
  security: { score: number; notes: string }
  architecture: { score: number; notes: string }
  tests: { score: number; notes: string }
  docs: { score: number; notes: string }
  summary: string
}
// Avaliação automática 0–100 via /api/evaluate-project (Gemini no servidor)
export async function evaluateProject(repoUrl: string, description: string): Promise<ProjectEvaluation> {
  const res = await fetch('/api/evaluate-project', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, description }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'A avaliação por IA falhou. Verifique a GEMINI_API_KEY.')
  }
  return res.json()
}
