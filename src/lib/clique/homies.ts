import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CliqueActivity, CliqueHomie, CliqueHomieEvent, CliqueInfluence, CliqueProfile } from './types';
import { mintProfile } from '@/lib/homies/mint';
import {
  columnsOf, compact, isAction, isFriendAction, newPetSim, project, readSim, viewOf,
  type CareEvent, type PetSim, type PetView, type Species,
} from '@/lib/homies/sim';
import type { CreateInput, HomieFields } from '@/lib/homies/validate';
import type { Action } from '@/lib/homies/engine/types';

/**
 * Homies section data layer. Every query runs as the signed-in user through RLS; nothing here uses
 * a service key. Pets: the sim snapshot lives in clique_homies.profile.sim and care arrives as
 * clique_homie_events, replayed by whoever views the Homie and persisted by its editors.
 */
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const PERSIST_EVERY_MS = 5 * 60_000;

async function session() {
  const s = await createClient();
  if (!s) return null;
  const { data } = await s.auth.getUser();
  if (!data.user) return null;
  return { s, userId: data.user.id };
}
type Session = NonNullable<Awaited<ReturnType<typeof session>>>;

export type PersonLite = Pick<CliqueProfile, 'id' | 'username' | 'display_name'>;

async function peopleById(s: Session['s'], ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map: Record<string, PersonLite> = {};
  if (!unique.length) return map;
  const { data } = await s.from('clique_profiles').select('id, username, display_name').in('id', unique);
  for (const p of (data ?? []) as PersonLite[]) map[p.id] = p;
  return map;
}

function friendlyError(message: string) {
  if (/cooldown/i.test(message)) return 'You just looked after this Homie. Give it a few minutes.';
  if (/friends can feed/i.test(message)) return 'Friends can feed, play, clean or talk.';
  if (/row-level security|permission/i.test(message)) return "You can't do that with this Homie.";
  if (/clique_homies_one_avatar_per_owner|duplicate key/i.test(message)) return 'You already have an avatar Homie. Edit that one instead.';
  if (/not found|expired/i.test(message)) return 'That code is not valid (or it expired).';
  return message;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------
export async function listHomiesOverview() {
  const ses = await session();
  if (!ses) return null;
  const { s, userId } = ses;
  const { data, error } = await s.from('clique_homies').select('*').order('created_at', { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CliqueHomie[];
  const mine = rows.filter((h) => h.owner_id === userId && !h.claimed_by);
  const made = rows.filter((h) => h.owner_id === userId && h.claimed_by);
  const claimed = rows.filter((h) => h.claimed_by === userId && h.owner_id !== userId);
  const others = rows.filter((h) => h.owner_id !== userId && h.claimed_by !== userId);
  const people = await peopleById(s, [...others.map((h) => h.owner_id), ...made.map((h) => h.claimed_by)]);
  return { userId, mine, made, claimed, others, people, hasAvatar: rows.some((h) => h.owner_id === userId && h.kind === 'avatar') };
}

// ---------------------------------------------------------------------------
// Create / edit / delete
// ---------------------------------------------------------------------------
export async function createHomieRow(input: CreateInput): Promise<Result<CliqueHomie>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { s, userId } = ses;
  const custom = input.kind === 'pet' && input.species === 'custom' && input.mint ? mintProfile(input.mint) : null;
  if (input.kind === 'pet' && input.species === 'custom' && !custom) return { ok: false, error: 'That pet needs a name.' };

  const { data, error } = await s
    .from('clique_homies')
    .insert({
      kind: input.kind, name: input.name, face: input.face, backstory: input.backstory,
      interests: input.interests, visibility: input.visibility,
      stage: input.kind === 'pet' ? input.stage : 'adult',
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: friendlyError(error.message) };
  let row = data as CliqueHomie;

  if (input.kind === 'pet' && input.species) {
    const sim = newPetSim({ homieId: row.id, species: input.species, custom, stage: input.stage, nowMs: Date.now() });
    const { data: updated, error: upErr } = await s
      .from('clique_homies')
      .update({ ...columnsOf(sim), profile: { ...row.profile, species: input.species, sim: compact(sim) } })
      .eq('id', row.id)
      .select('*')
      .single();
    if (upErr) return { ok: false, error: friendlyError(upErr.message) };
    row = updated as CliqueHomie;
  }
  if (input.kind === 'avatar') {
    // Best effort: un-onboarded users have no profile row yet.
    await s.from('clique_profiles').update({ avatar_homie_id: row.id }).eq('id', userId);
  }
  return { ok: true, data: row };
}

export async function updateHomieFields(id: string, fields: HomieFields): Promise<Result<CliqueHomie>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { s } = ses;
  const { data: current } = await s.from('clique_homies').select('kind').eq('id', id).maybeSingle();
  if (!current) return { ok: false, error: 'Homie not found.' };
  // A pet's name belongs to its sim (it is in every line it says), so it is fixed at birth.
  const patch = current.kind === 'pet' ? { ...fields, name: undefined } : fields;
  const { data, error } = await s.from('clique_homies').update(patch).eq('id', id).select('*');
  if (error) return { ok: false, error: friendlyError(error.message) };
  if (!data?.length) return { ok: false, error: "You can't edit this Homie." };
  return { ok: true, data: data[0] as CliqueHomie };
}

export async function deleteHomieRow(id: string): Promise<Result<null>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { data, error } = await ses.s.from('clique_homies').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: friendlyError(error.message) };
  if (!data?.length) return { ok: false, error: 'Only the person who made a Homie can delete it.' };
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Detail + pet projection
// ---------------------------------------------------------------------------
export type HomieDetail = {
  homie: CliqueHomie;
  userId: string;
  isOwner: boolean;
  canEdit: boolean;
  species: Species | null;
  pet: PetView | null;
  events: (CliqueHomieEvent & { actor: PersonLite | null })[];
  owner: PersonLite | null;
  claimer: PersonLite | null;
  influences: { weight: number; influence: CliqueInfluence }[];
  myInfluences: CliqueInfluence[];
  careResults: Record<string, string>;
  persisted: boolean;
};

async function materialize(ses: Session, homie: CliqueHomie, canEdit: boolean) {
  const { s } = ses;
  const species = (homie.profile?.species as Species | undefined) ?? null;
  let sim: PetSim | null = readSim(homie.profile?.sim);
  const now = Date.now();
  let fresh = false;
  if (!sim && species && canEdit) {
    sim = newPetSim({ homieId: homie.id, species: species === 'custom' ? 'tony' : species, nowMs: now });
    fresh = true;
  }
  if (!sim) return { sim: null, results: {}, persisted: false, homie };

  let q = s.from('clique_homie_events').select('id, created_at, actor_id, payload')
    .eq('homie_id', homie.id).eq('type', 'care').order('created_at', { ascending: true }).limit(200);
  if (sim.appliedAt) q = q.gte('created_at', sim.appliedAt);
  else q = q.gte('created_at', homie.created_at);
  const { data: evs } = await q;
  const proj = project(sim, (evs ?? []) as CareEvent[], now);

  let persisted = false;
  if (canEdit && (fresh || proj.applied > 0 || proj.evolved || now - sim.syncedMs > PERSIST_EVERY_MS)) {
    const { data: up } = await s
      .from('clique_homies')
      .update({ ...columnsOf(proj.sim), profile: { ...homie.profile, sim: compact(proj.sim) } })
      .eq('id', homie.id)
      .eq('updated_at', homie.updated_at) // optimistic lock: a concurrent viewer already saved
      .select('*');
    if (up?.length) {
      persisted = true;
      homie = up[0] as CliqueHomie;
      if (proj.evolved) {
        await s.from('clique_homie_events').insert({
          homie_id: homie.id, actor_id: ses.userId, type: 'evolve',
          payload: { from: proj.evolved.from, to: proj.evolved.to, line: proj.evolved.line },
        });
      }
    }
  }
  return { sim: proj.sim, results: proj.results, persisted, homie };
}

export async function loadHomie(id: string): Promise<HomieDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const ses = await session();
  if (!ses) return null;
  const { s, userId } = ses;
  const { data } = await s.from('clique_homies').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  let homie = data as CliqueHomie;
  const isOwner = homie.owner_id === userId;
  const canEdit = isOwner || homie.claimed_by === userId;

  let pet: PetView | null = null;
  let careResults: Record<string, string> = {};
  let persisted = false;
  if (homie.kind === 'pet') {
    const m = await materialize(ses, homie, canEdit);
    homie = m.homie;
    careResults = m.results;
    persisted = m.persisted;
    pet = m.sim ? viewOf(m.sim) : null;
  }

  const [{ data: evs }, { data: links }, mine] = await Promise.all([
    s.from('clique_homie_events').select('*').eq('homie_id', id).order('created_at', { ascending: false }).limit(25),
    s.from('clique_homie_influences').select('weight, influence:clique_influences(*)').eq('homie_id', id),
    canEdit ? s.from('clique_influences').select('*').eq('owner_id', userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const events = (evs ?? []) as CliqueHomieEvent[];
  const people = await peopleById(s, [homie.owner_id, homie.claimed_by, ...events.map((e) => e.actor_id)]);
  const influences = ((links ?? []) as unknown as { weight: number; influence: CliqueInfluence | null }[])
    .filter((l): l is { weight: number; influence: CliqueInfluence } => !!l.influence);

  return {
    homie, userId, isOwner, canEdit,
    species: (homie.profile?.species as Species | undefined) ?? null,
    pet,
    events: events.map((e) => ({ ...e, actor: e.actor_id ? people[e.actor_id] ?? null : null })),
    owner: people[homie.owner_id] ?? null,
    claimer: homie.claimed_by ? people[homie.claimed_by] ?? null : null,
    influences,
    myInfluences: ((mine.data ?? []) as CliqueInfluence[]),
    careResults,
    persisted,
  };
}

// ---------------------------------------------------------------------------
// Care (owner, claimant, or any friend who can see the Homie)
// ---------------------------------------------------------------------------
export async function careFor(id: string, action: Action, food?: string): Promise<Result<{ text: string }>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { s, userId } = ses;
  if (!isAction(action)) return { ok: false, error: 'Unknown care action.' };
  const { data: row } = await s.from('clique_homies').select('id, kind, name, owner_id, claimed_by').eq('id', id).maybeSingle();
  if (!row) return { ok: false, error: 'Homie not found.' };
  const editor = row.owner_id === userId || row.claimed_by === userId;
  if (!editor && !isFriendAction(action)) return { ok: false, error: 'Friends can feed, play, clean or talk.' };
  const payload: Record<string, string> = { action };
  if (food) payload.food = food.slice(0, 40);
  const { data: ev, error } = await s
    .from('clique_homie_events')
    .insert({ homie_id: id, actor_id: userId, type: 'care', payload })
    .select('id')
    .single();
  if (error) return { ok: false, error: friendlyError(error.message) };
  if (row.kind !== 'pet') {
    const verbs: Record<string, string> = { talk: 'You checked in on', play: 'You hung out with', feed: 'You brought snacks for', clean: 'You tidied up for' };
    return { ok: true, data: { text: `${verbs[action] ?? 'You showed love to'} ${row.name}.` } };
  }
  const detail = await loadHomie(id);
  return { ok: true, data: { text: detail?.careResults[(ev as { id: string }).id] || `${row.name} noticed.` } };
}

// ---------------------------------------------------------------------------
// Friend-page claim codes
// ---------------------------------------------------------------------------
export async function issueClaim(id: string): Promise<Result<string>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { data, error } = await ses.s.rpc('clique_issue_homie_claim', { p_homie: id, p_ttl_days: 14 });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true, data: data as string };
}

export async function claimByCode(code: string): Promise<Result<string>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const clean = code.trim().replace(/\s+/g, '');
  if (!clean || clean.length > 64) return { ok: false, error: 'Enter the code your friend sent you.' };
  const { data, error } = await ses.s.rpc('clique_claim_homie', { p_code: clean });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true, data: data as string };
}

// ---------------------------------------------------------------------------
// Influence library
// ---------------------------------------------------------------------------
export const INFLUENCE_KINDS = ['music', 'book', 'film', 'art', 'place', 'person', 'url', 'other'] as const;

export async function listInfluences() {
  const ses = await session();
  if (!ses) return null;
  const { data, error } = await ses.s.from('clique_influences').select('*').eq('owner_id', ses.userId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CliqueInfluence[];
  const { data: links } = rows.length
    ? await ses.s.from('clique_homie_influences').select('influence_id, homie_id').in('influence_id', rows.map((r) => r.id))
    : { data: [] };
  const uses: Record<string, number> = {};
  for (const l of (links ?? []) as { influence_id: string }[]) uses[l.influence_id] = (uses[l.influence_id] ?? 0) + 1;
  return { influences: rows, uses };
}

export async function createInfluence(input: Pick<CliqueInfluence, 'title' | 'kind' | 'url' | 'notes' | 'tags' | 'visibility'>): Promise<Result<CliqueInfluence>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { data, error } = await ses.s.from('clique_influences').insert(input).select('*').single();
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true, data: data as CliqueInfluence };
}

export async function deleteInfluence(id: string): Promise<Result<null>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { error } = await ses.s.from('clique_influences').delete().eq('id', id);
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true, data: null };
}

export async function attachInfluence(homieId: string, influenceId: string, weight: number): Promise<Result<null>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const w = Math.max(0, Math.min(1, Number.isFinite(weight) ? weight : 0.5));
  const { error } = await ses.s.from('clique_homie_influences')
    .upsert({ homie_id: homieId, influence_id: influenceId, weight: w }, { onConflict: 'homie_id,influence_id' });
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true, data: null };
}

export async function detachInfluence(homieId: string, influenceId: string): Promise<Result<null>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { error } = await ses.s.from('clique_homie_influences').delete().eq('homie_id', homieId).eq('influence_id', influenceId);
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Home feed
// ---------------------------------------------------------------------------
export async function getHomeFeed(limit = 30) {
  const ses = await session();
  if (!ses) return null;
  const { data, error } = await ses.s.from('clique_activities').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CliqueActivity[];
  const people = await peopleById(ses.s, rows.flatMap((a) => [a.actor_id, a.target_user_id]));
  return { userId: ses.userId, activities: rows, people };
}
