import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/supabase/env';
import { validatedHttpsOrigin } from './policy';
import { assessLinkReadiness } from './readiness';

export function linkingConfigured() {
  return assessLinkReadiness(process.env).ready;
}

/** Server-only privileged client. No user JWT, no browser persistence. */
export function linkDb(): SupabaseClient | null {
  if (!linkingConfigured()) return null;
  return createClient(SUPABASE_URL, process.env.CLIQUE_LINK_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function issueChallenge(db: SupabaseClient, ownerId: string) {
  const challenge = randomUUID();
  const { data, error } = await db.rpc('clique_link_start', {
    p_owner_id: ownerId, p_challenge_id: challenge,
  });
  if (error) return { error: 'storage_unavailable' as const };
  if (data !== 'issued') return { error: data === 'rate_limited' ? 'rate_limited' as const : 'storage_unavailable' as const };
  const homies = validatedHttpsOrigin(process.env.CLIQUE_HOMIES_LINK_ORIGIN);
  const site = validatedHttpsOrigin(process.env.CLIQUE_PUBLIC_RETURN_ORIGIN);
  if (!homies || !site) return { error: 'linking_unavailable' as const };
  const destination = new URL('/clique/link', homies);
  destination.searchParams.set('challenge', challenge);
  destination.searchParams.set('returnTo', new URL('/clique/apps?linked=homies', site).toString());
  return { url: destination.toString() };
}
export async function finishChallenge(db: SupabaseClient, challenge: string, subject: string) {
  const { data, error } = await db.rpc('clique_link_complete', {
    p_challenge_id: challenge, p_external_subject: subject,
  });
  if (error) return { error: 'storage_unavailable' as const };
  if (data === 'linked' || data === 'already_linked') return { status: data as 'linked' | 'already_linked' };
  return { error: data === 'conflict' ? 'link_conflict' as const : 'invalid_or_expired_challenge' as const };
}
