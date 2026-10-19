import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  CliqueActivity, CliqueCircle, CliqueFriendship, CliqueHomie, CliqueMessage, CliqueThread, HomieKind,
} from './types';

/** Thin typed wrappers over RLS-protected tables and RPCs. All return null/[] when auth is off. */
async function db() {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// Friends -------------------------------------------------------------------
export async function listFriendships() {
  const s = await db();
  return unwrap<CliqueFriendship[]>(await s.from('clique_friendships').select('*').order('updated_at', { ascending: false }));
}
export async function requestFriend(myId: string, otherId: string) {
  const s = await db();
  return unwrap<CliqueFriendship>(
    await s.from('clique_friendships').insert({ requester_id: myId, addressee_id: otherId }).select('*').single(),
  );
}
export async function respondToFriend(friendshipId: string, status: 'accepted' | 'declined') {
  const s = await db();
  return unwrap<CliqueFriendship>(await s.from('clique_friendships').update({ status }).eq('id', friendshipId).select('*').single());
}
export async function createInvite(opts: { circleId?: string; maxUses?: number } = {}) {
  const s = await db();
  return unwrap<string>(await s.rpc('clique_create_invite', { p_circle: opts.circleId ?? null, p_max_uses: opts.maxUses ?? 1 }));
}
export async function claimInvite(token: string) {
  const s = await db();
  return unwrap<{ inviter_id: string; circle_id: string | null }>(await s.rpc('clique_claim_invite', { p_token: token }));
}

// Homies --------------------------------------------------------------------
export async function listMyHomies(userId: string) {
  const s = await db();
  return unwrap<CliqueHomie[]>(
    await s.from('clique_homies').select('*').or(`owner_id.eq.${userId},claimed_by.eq.${userId}`).order('created_at'),
  );
}
export async function createHomie(input: { kind: HomieKind; name: string; face?: string; backstory?: string; interests?: string[] }) {
  const s = await db();
  return unwrap<CliqueHomie>(await s.from('clique_homies').insert(input).select('*').single());
}
export async function issueHomieClaimCode(homieId: string) {
  const s = await db();
  return unwrap<string>(await s.rpc('clique_issue_homie_claim', { p_homie: homieId }));
}
export async function claimHomie(code: string) {
  const s = await db();
  return unwrap<string>(await s.rpc('clique_claim_homie', { p_code: code }));
}

// Circles -------------------------------------------------------------------
export async function listMyCircles() {
  const s = await db();
  return unwrap<CliqueCircle[]>(await s.from('clique_circles').select('*').order('created_at', { ascending: false }));
}
export async function createCircle(input: { slug: string; name: string; description?: string; visibility?: 'public' | 'private' }) {
  const s = await db();
  return unwrap<CliqueCircle>(await s.from('clique_circles').insert(input).select('*').single());
}

// Dial ----------------------------------------------------------------------
export async function startDm(otherUserId: string) {
  const s = await db();
  return unwrap<string>(await s.rpc('clique_start_dm', { p_other: otherUserId }));
}
export async function listThreads() {
  const s = await db();
  return unwrap<CliqueThread[]>(
    await s.from('clique_threads').select('*').order('last_message_at', { ascending: false, nullsFirst: false }),
  );
}
export async function listMessages(threadId: string, limit = 50) {
  const s = await db();
  return unwrap<CliqueMessage[]>(
    await s.from('clique_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(limit),
  );
}
/** Picture message (Dial default). Upload the file first to clique-chat at chatImagePath(...). */
export async function sendPictureMessage(input: {
  threadId: string; senderId: string; imagePath: string; caption?: string; alt?: string; width?: number; height?: number;
}) {
  const s = await db();
  return unwrap<CliqueMessage>(
    await s.from('clique_messages').insert({
      thread_id: input.threadId, sender_id: input.senderId, kind: 'image', image_path: input.imagePath,
      body: input.caption ?? '', image_alt: input.alt ?? '', image_width: input.width, image_height: input.height,
    }).select('*').single(),
  );
}

// Home feed -----------------------------------------------------------------
export async function getFeed(limit = 30) {
  const s = await db();
  return unwrap<CliqueActivity[]>(
    await s.from('clique_activities').select('*').order('created_at', { ascending: false }).limit(limit),
  );
}
