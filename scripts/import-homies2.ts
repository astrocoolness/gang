/**
 * DRAFT importer: HOMIES² (homies2.rva.guru) users + chat -> Clique tables in rva.guru's Supabase.
 * NOT RUN. Review the column assumptions marked VERIFY against the live HOMIES² schema first.
 *
 * Usage (dry run is the default and writes nothing):
 *   HOMIES2_SUPABASE_URL=... HOMIES2_SERVICE_ROLE_KEY=... \
 *   CLIQUE_SUPABASE_URL=... CLIQUE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/import-homies2.ts            # dry run: prints the plan
 *   npx tsx scripts/import-homies2.ts --apply    # writes (after a reviewed dry run on staging)
 *   ... --apply --invite-missing                 # also invite HOMIES² users with no rva.guru account
 *
 * Source and target may be the same project (HOMIES² README says its tables live in "the active
 * RVA.guru Supabase project"; homies2/config.js points at oesdpdcncwdjnfvludxx). If they are the same,
 * user ids carry over 1:1 and no invites are needed.
 *
 * Mapping
 *   auth user (by email)        -> rva.guru auth user (existing, or invited with --invite-missing)
 *   homies_profiles             -> clique_profiles (username from handle, collisions get _2, _3...)
 *   avatar_url (tony/betty/nori)-> clique_homies kind='avatar' (+ profiles.avatar_homie_id)
 *   homies_connections accepted -> clique_friendships accepted (pending/blocked preserved)
 *   homies_threads (+members)   -> clique_threads dm|group (+ clique_thread_members)
 *   homies_messages             -> clique_messages kind='text' (legacy chat has no pictures)
 *   homies_contacts             -> NOT migrated (private phone book; needs a consented flow)
 * Idempotent: every row carries legacy_source='homies2' + legacy_id; re-runs skip existing rows.
 * Uses service-role keys (bypass RLS) — run only from a trusted machine, never in the app.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { toUsernameCandidate } from '../src/lib/clique/validate';

const APPLY = process.argv.includes('--apply');
const INVITE = process.argv.includes('--invite-missing');
const SRC = 'homies2';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

// VERIFY: column names inferred from homies2/app.js + README (the SQL is not in that repo).
interface H2Profile { id: string; display_name: string | null; handle: string | null; bio: string | null; status_text: string | null; avatar_url: string | null }
interface H2Connection { id: string; requester_id: string; addressee_id: string; status: string; created_at?: string }
interface H2Thread { id: string; kind?: string | null; title?: string | null; created_by?: string | null; created_at?: string }
interface H2Member { thread_id: string; user_id: string }
interface H2Message { id: string; thread_id: string; sender_id: string; body: string; created_at: string }

async function all<T>(db: SupabaseClient, table: string, select = '*'): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

async function listUsers(db: SupabaseClient) {
  const users: { id: string; email: string | undefined }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email?.toLowerCase() })));
    if (data.users.length < 1000) return users;
  }
}

async function main() {
  const src = createClient(env('HOMIES2_SUPABASE_URL'), env('HOMIES2_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const dst = createClient(env('CLIQUE_SUPABASE_URL'), env('CLIQUE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const sameProject = env('HOMIES2_SUPABASE_URL') === env('CLIQUE_SUPABASE_URL');
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — same project: ${sameProject}`);

  // 1. Users: map source user id -> target user id by email.
  const [srcUsers, dstUsers] = await Promise.all([listUsers(src), sameProject ? Promise.resolve([]) : listUsers(dst)]);
  const dstByEmail = new Map(dstUsers.map((u) => [u.email, u.id]));
  const userMap = new Map<string, string>();
  const missing: string[] = [];
  for (const u of srcUsers) {
    if (sameProject) { userMap.set(u.id, u.id); continue; }
    const target = u.email ? dstByEmail.get(u.email) : undefined;
    if (target) userMap.set(u.id, target);
    else if (u.email) missing.push(u.email);
  }
  console.log(`users: ${srcUsers.length} source, ${userMap.size} mapped, ${missing.length} without rva.guru account`);
  if (missing.length && INVITE && APPLY) {
    for (const email of missing) {
      const { data, error } = await dst.auth.admin.inviteUserByEmail(email, {
        redirectTo: 'https://rva.guru/clique/auth/callback?next=/onboarding',
      });
      if (error) console.warn(`invite ${email}: ${error.message}`);
      const srcId = srcUsers.find((x) => x.email === email)?.id;
      if (data?.user && srcId) userMap.set(srcId, data.user.id);
    }
  }

  // 2. Profiles (+ avatar homies).
  const profiles = await all<H2Profile>(src, 'homies_profiles');
  const { data: taken } = await dst.from('clique_profiles').select('id, username');
  const used = new Set((taken ?? []).map((r) => r.username as string));
  const already = new Set((taken ?? []).map((r) => r.id as string));
  const profileRows = [];
  const avatarRows = [];
  for (const p of profiles) {
    const uid = userMap.get(p.id);
    if (!uid || already.has(uid)) continue;
    let username = toUsernameCandidate(p.handle || p.display_name || 'homie');
    for (let n = 2; used.has(username); n++) username = `${username.slice(0, 21)}_${n}`;
    used.add(username);
    profileRows.push({
      id: uid, username, display_name: (p.display_name || username).slice(0, 60), bio: (p.bio ?? '').slice(0, 500),
      status: (p.status_text ?? '').slice(0, 80), privacy: 'friends', onboarded_at: new Date().toISOString(),
      legacy_source: SRC, legacy_id: p.id,
    });
    const pet = /(tony|betty|nori)/.exec(p.avatar_url ?? '')?.[1];
    if (pet) avatarRows.push({ owner_id: uid, kind: 'avatar', name: pet[0].toUpperCase() + pet.slice(1), face: pet, legacy_source: SRC, legacy_id: `avatar:${p.id}` });
  }
  console.log(`profiles: ${profileRows.length} to create; avatar homies: ${avatarRows.length}`);

  // 3. Friendships. VERIFY: homies_connections columns/status values.
  const connections = await all<H2Connection>(src, 'homies_connections').catch((e) => { console.warn(String(e)); return []; });
  const friendRows = connections
    .map((c) => ({ a: userMap.get(c.requester_id), b: userMap.get(c.addressee_id), c }))
    .filter((x) => x.a && x.b && x.a !== x.b)
    .map(({ a, b, c }) => ({
      requester_id: a!, addressee_id: b!,
      status: (['pending', 'accepted', 'blocked'].includes(c.status) ? c.status : 'pending') as string,
      blocked_by: c.status === 'blocked' ? a! : null,
    }));
  console.log(`friendships: ${friendRows.length}`);

  // 4. Threads, members, messages.
  const [threads, members, messages] = await Promise.all([
    all<H2Thread>(src, 'homies_threads'),
    all<H2Member>(src, 'homies_thread_members'),
    all<H2Message>(src, 'homies_messages'),
  ]);
  const membersByThread = new Map<string, string[]>();
  for (const m of members) {
    const uid = userMap.get(m.user_id);
    if (uid) membersByThread.set(m.thread_id, [...(membersByThread.get(m.thread_id) ?? []), uid]);
  }
  const threadRows = threads.map((t) => {
    const ms = [...new Set(membersByThread.get(t.id) ?? [])].sort();
    const isDm = ms.length === 2 && t.kind !== 'group';
    return {
      legacy_id: t.id, members: ms,
      row: {
        kind: isDm ? 'dm' : 'group', dm_key: isDm ? `${ms[0]}:${ms[1]}` : null, title: (t.title ?? '').slice(0, 80),
        created_by: t.created_by ? userMap.get(t.created_by) ?? null : null, legacy_source: SRC, legacy_id: t.id,
        created_at: t.created_at,
      },
    };
  }).filter((t) => t.members.length > 0);
  console.log(`threads: ${threadRows.length} (${threadRows.filter((t) => t.row.kind === 'dm').length} DMs); messages: ${messages.length}`);

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply against a staging copy first.');
    return;
  }

  const ins = async (table: string, rows: object[], onConflict?: string) => {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = onConflict
        ? await dst.from(table).upsert(chunk, { onConflict, ignoreDuplicates: true })
        : await dst.from(table).insert(chunk);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };
  await ins('clique_profiles', profileRows, 'id');
  for (const a of avatarRows) {
    const { data, error } = await dst.from('clique_homies').insert(a).select('id').single();
    if (error) { console.warn(`avatar ${a.owner_id}: ${error.message}`); continue; }
    await dst.from('clique_profiles').update({ avatar_homie_id: data.id }).eq('id', a.owner_id).is('avatar_homie_id', null);
  }
  for (const f of friendRows) {
    const { error } = await dst.from('clique_friendships').insert(f);
    if (error && error.code !== '23505') console.warn(`friendship: ${error.message}`);
  }

  const { data: existingThreads } = await dst.from('clique_threads').select('id, legacy_id, dm_key').eq('legacy_source', SRC);
  const threadMap = new Map((existingThreads ?? []).map((t) => [t.legacy_id as string, t.id as string]));
  for (const t of threadRows) {
    if (threadMap.has(t.legacy_id)) continue;
    let id: string | undefined;
    const { data, error } = await dst.from('clique_threads').insert(t.row).select('id').single();
    if (error?.code === '23505' && t.row.dm_key) {
      const { data: dm } = await dst.from('clique_threads').select('id').eq('dm_key', t.row.dm_key).single();
      id = dm?.id;  // DM already exists in Clique: merge history into it
    } else if (error) {
      throw new Error(`thread ${t.legacy_id}: ${error.message}`);
    } else id = data.id;
    if (!id) continue;
    threadMap.set(t.legacy_id, id);
    await ins('clique_thread_members', t.members.map((user_id) => ({ thread_id: id, user_id })), 'thread_id,user_id');
  }

  const msgRows = messages
    .filter((m) => threadMap.has(m.thread_id) && m.body?.trim())
    .map((m) => ({
      thread_id: threadMap.get(m.thread_id)!, sender_id: userMap.get(m.sender_id) ?? null, kind: 'text',
      body: m.body.slice(0, 4000), created_at: m.created_at, legacy_source: SRC, legacy_id: m.id,
    }));
  await ins('clique_messages', msgRows, 'legacy_source,legacy_id');
  console.log(`done: ${profileRows.length} profiles, ${friendRows.length} friendships, ${threadMap.size} threads, ${msgRows.length} messages`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
