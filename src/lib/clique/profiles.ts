import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CliqueProfile } from './types';
import type { ProfileInput } from './validate';

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

/** Signed-in user plus their Clique profile (null if not onboarded). Null overall when auth is off. */
export async function getSessionProfile(): Promise<
  { userId: string; email: string | null; profile: CliqueProfile | null } | null
> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from('clique_profiles').select('*').eq('id', auth.user.id).maybeSingle();
  return { userId: auth.user.id, email: auth.user.email ?? null, profile: (data as CliqueProfile | null) ?? null };
}

export async function saveMyProfile(input: ProfileInput): Promise<Result<CliqueProfile>> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Accounts are not configured on this deployment.', code: 'not_configured' };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Please sign in first.', code: 'unauthenticated' };

  const { data: existing } = await supabase.from('clique_profiles').select('id, onboarded_at').eq('id', auth.user.id).maybeSingle();
  const row = { ...input, id: auth.user.id, onboarded_at: existing?.onboarded_at ?? new Date().toISOString() };
  const query = existing
    ? supabase.from('clique_profiles').update(row).eq('id', auth.user.id)
    : supabase.from('clique_profiles').insert(row);
  const { data, error } = await query.select('*').single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'That username is taken.', code: 'username_taken' };
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true, data: data as CliqueProfile };
}

export async function findProfileByUsername(username: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc('clique_find_profile', { p_username: username });
  const rows = (data ?? []) as Pick<CliqueProfile, 'id' | 'username' | 'display_name' | 'avatar_path'>[];
  return rows[0] ?? null;
}
