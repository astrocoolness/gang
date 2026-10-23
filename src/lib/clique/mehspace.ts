import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderMehspace, SANITIZER_VERSION } from '@/lib/mehspace/sanitize';
import { frameDocument } from '@/lib/mehspace/frame';
import { themeOf } from '@/lib/mehspace/themes';
import type { CliqueCircle, CliqueHomie, CliqueMehspace, CliquePost, CliqueProfile, Privacy } from './types';

/**
 * Mehspace data layer. Everything runs as the signed-in user through RLS, except trustedRender(),
 * which writes the sanitizer output with the server-only service role AFTER an RLS update has proved
 * the user may edit that space.
 */
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type PersonLite = Pick<CliqueProfile, 'id' | 'username' | 'display_name'> & { avatar_homie_id?: string | null };
export const MEDIA_BUCKET = 'clique-media';
export const FRAME_MIN = 200;
export const FRAME_MAX = 3000;
export const FRAME_DEFAULT = 600;
export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

async function session() {
  const s = await createClient();
  if (!s) return null;
  const { data } = await s.auth.getUser();
  if (!data.user) return null;
  return { s, userId: data.user.id };
}
type Session = NonNullable<Awaited<ReturnType<typeof session>>>;
type Db = Session['s'];

function friendly(message: string) {
  if (/top friends/i.test(message)) return 'Top 8 can only hold your friends (no repeats).';
  if (/profile privacy/i.test(message)) return 'This page can’t be more public than your profile privacy. Change that in Your profile first.';
  if (/media must be your own/i.test(message)) return 'That file isn’t yours.';
  if (/invalid layout/i.test(message)) return 'That layout is too big.';
  if (/invalid post media/i.test(message)) return 'Posts can have up to 4 of your own images.';
  if (/row-level security|permission/i.test(message)) return "You can't do that on this Mehspace.";
  if (/clique_posts_not_empty/i.test(message)) return 'Write something or add a picture.';
  return message;
}

const layoutOf = (s: Pick<CliqueMehspace, 'layout_json'>) => (s.layout_json && typeof s.layout_json === 'object' ? s.layout_json : {}) as Record<string, unknown>;
export const frameHeight = (s: Pick<CliqueMehspace, 'layout_json'>) => {
  const n = Number(layoutOf(s).frame_height);
  return Number.isFinite(n) ? Math.min(FRAME_MAX, Math.max(FRAME_MIN, Math.round(n))) : FRAME_DEFAULT;
};
export const renderError = (s: Pick<CliqueMehspace, 'layout_json'>) => {
  const e = layoutOf(s).render_error;
  return typeof e === 'string' ? e : null;
};

async function signed(s: Db, path: unknown): Promise<string | null> {
  if (typeof path !== 'string' || !path) return null;
  const { data } = await s.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

async function people(s: Db, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map: Record<string, PersonLite> = {};
  if (!unique.length) return map;
  const { data } = await s.from('clique_profiles').select('id, username, display_name, avatar_homie_id').in('id', unique);
  for (const p of (data ?? []) as PersonLite[]) map[p.id] = p;
  return map;
}

async function faces(s: Db, ppl: PersonLite[]) {
  const ids = ppl.map((p) => p.avatar_homie_id).filter((x): x is string => !!x);
  const map: Record<string, string> = {};
  if (!ids.length) return map;
  const { data } = await s.from('clique_homies').select('id, face').in('id', ids);
  for (const h of (data ?? []) as Pick<CliqueHomie, 'id' | 'face'>[]) map[h.id] = h.face;
  return map;
}

// ---------------------------------------------------------------------------
// Finding spaces
// ---------------------------------------------------------------------------
export type Owner =
  | { kind: 'user'; profile: PersonLite }
  | { kind: 'homie'; homie: CliqueHomie }
  | { kind: 'circle'; circle: CliqueCircle };

export function spaceHref(owner: Owner) {
  if (owner.kind === 'user') return `/mehspace/${owner.profile.username}`;
  if (owner.kind === 'homie') return `/mehspace/homie/${owner.homie.id}`;
  return `/mehspace/circle/${owner.circle.slug}`;
}

/** 'hidden' = the profile exists but its Mehspace isn't visible to you. */
export async function findUserSpace(username: string): Promise<{ status: 'off' | 'missing' } | { status: 'hidden'; profile: PersonLite } | { status: 'ok'; view: SpaceView }> {
  const ses = await session();
  if (!ses) return { status: 'off' };
  const { s, userId } = ses;
  const uname = username.toLowerCase();
  const { data: mine } = await s.from('clique_profiles').select('id, username, display_name, avatar_homie_id').eq('id', userId).maybeSingle();
  let profile = mine && (mine as PersonLite).username === uname ? (mine as PersonLite) : null;
  if (!profile) {
    const { data } = await s.rpc('clique_find_profile', { p_username: uname });
    const row = ((data ?? []) as PersonLite[])[0];
    if (!row) return { status: 'missing' };
    profile = (await people(s, [row.id]))[row.id] ?? row;
  }
  const { data: space } = await s.from('clique_mehspaces').select('*').eq('owner_type', 'user').eq('user_id', profile.id).maybeSingle();
  if (!space) return { status: 'hidden', profile };
  return { status: 'ok', view: await buildView(ses, space as CliqueMehspace, { kind: 'user', profile }) };
}

export async function findHomieSpace(homieId: string) {
  const ses = await session();
  if (!ses) return null;
  const { s } = ses;
  const { data: homie } = await s.from('clique_homies').select('*').eq('id', homieId).maybeSingle();
  if (!homie) return null;
  let { data: space } = await s.from('clique_mehspaces').select('*').eq('homie_id', homieId).maybeSingle();
  if (!space) {
    const { data: canEdit } = await s.rpc('clique_can_edit_homie', { p_homie: homieId });
    if (!canEdit) return null;
    const h = homie as CliqueHomie;
    const ins = await s.from('clique_mehspaces')
      .insert({ owner_type: 'homie', homie_id: homieId, title: h.name, visibility: h.visibility })
      .select('*').single();
    if (ins.error) throw new Error(ins.error.message);
    space = ins.data;
  }
  return buildView(ses, space as CliqueMehspace, { kind: 'homie', homie: homie as CliqueHomie });
}

export async function findCircleSpace(slug: string) {
  const ses = await session();
  if (!ses) return null;
  const { s } = ses;
  const { data: circle } = await s.from('clique_circles').select('*').eq('slug', slug.toLowerCase()).maybeSingle();
  if (!circle) return null;
  const c = circle as CliqueCircle;
  let { data: space } = await s.from('clique_mehspaces').select('*').eq('circle_id', c.id).maybeSingle();
  if (!space) {
    const { data: role } = await s.rpc('clique_circle_role', { p_circle: c.id });
    if (role !== 'owner' && role !== 'admin') return null;
    const ins = await s.from('clique_mehspaces')
      .insert({ owner_type: 'circle', circle_id: c.id, title: c.name, visibility: c.visibility === 'public' ? 'public' : 'friends' })
      .select('*').single();
    if (ins.error) throw new Error(ins.error.message);
    space = ins.data;
  }
  return buildView(ses, space as CliqueMehspace, { kind: 'circle', circle: c });
}

/** Canonical URL for a space id (feed links), or null if you can't see it. */
export async function spaceUrl(spaceId: string): Promise<string | null> {
  const ses = await session();
  if (!ses) return null;
  const owner = await ownerOf(ses.s, spaceId);
  return owner ? spaceHref(owner.owner) : null;
}

async function ownerOf(s: Db, spaceId: string): Promise<{ space: CliqueMehspace; owner: Owner } | null> {
  const { data } = await s.from('clique_mehspaces').select('*').eq('id', spaceId).maybeSingle();
  if (!data) return null;
  const space = data as CliqueMehspace;
  if (space.owner_type === 'user') {
    const p = (await people(s, [space.user_id]))[space.user_id!];
    return p ? { space, owner: { kind: 'user', profile: p } } : null;
  }
  if (space.owner_type === 'homie') {
    const { data: h } = await s.from('clique_homies').select('*').eq('id', space.homie_id!).maybeSingle();
    return h ? { space, owner: { kind: 'homie', homie: h as CliqueHomie } } : null;
  }
  const { data: c } = await s.from('clique_circles').select('*').eq('id', space.circle_id!).maybeSingle();
  return c ? { space, owner: { kind: 'circle', circle: c as CliqueCircle } } : null;
}

export async function mySpaceId() {
  const ses = await session();
  if (!ses) return null;
  const { data } = await ses.s.from('clique_mehspaces').select('id').eq('owner_type', 'user').eq('user_id', ses.userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export type SpaceCard = { id: string; href: string; title: string; label: string; mood: string; face: string; mine: boolean };

/** Spaces you can see: yours first, then Homies you edit, Circles, then friends'. */
export async function listSpaces(): Promise<{ userId: string; hasProfile: boolean; cards: SpaceCard[] } | null> {
  const ses = await session();
  if (!ses) return null;
  const { s, userId } = ses;
  const { data } = await s.from('clique_mehspaces').select('*').order('updated_at', { ascending: false }).limit(100);
  const spaces = (data ?? []) as CliqueMehspace[];
  const ppl = await people(s, [userId, ...spaces.map((x) => x.user_id)]);
  const homieIds = spaces.map((x) => x.homie_id).filter((x): x is string => !!x);
  const circleIds = spaces.map((x) => x.circle_id).filter((x): x is string => !!x);
  const [{ data: hs }, { data: cs }] = await Promise.all([
    homieIds.length ? s.from('clique_homies').select('*').in('id', homieIds) : Promise.resolve({ data: [] }),
    circleIds.length ? s.from('clique_circles').select('*').in('id', circleIds) : Promise.resolve({ data: [] }),
  ]);
  const homies = Object.fromEntries(((hs ?? []) as CliqueHomie[]).map((h) => [h.id, h]));
  const circles = Object.fromEntries(((cs ?? []) as CliqueCircle[]).map((c) => [c.id, c]));
  const fc = await faces(s, Object.values(ppl));
  const cards: SpaceCard[] = [];
  for (const sp of spaces) {
    let owner: Owner | null = null;
    if (sp.user_id && ppl[sp.user_id]) owner = { kind: 'user', profile: ppl[sp.user_id] };
    else if (sp.homie_id && homies[sp.homie_id]) owner = { kind: 'homie', homie: homies[sp.homie_id] };
    else if (sp.circle_id && circles[sp.circle_id]) owner = { kind: 'circle', circle: circles[sp.circle_id] };
    if (!owner) continue;
    const mine = owner.kind === 'user' ? sp.user_id === userId
      : owner.kind === 'homie' ? owner.homie.owner_id === userId || owner.homie.claimed_by === userId : false;
    cards.push({
      id: sp.id, href: spaceHref(owner), mine,
      title: sp.title || (owner.kind === 'user' ? owner.profile.display_name || owner.profile.username : owner.kind === 'homie' ? owner.homie.name : owner.circle.name),
      label: owner.kind === 'user' ? `@${owner.profile.username}` : owner.kind === 'homie' ? 'Homie' : 'Circle',
      mood: sp.mood,
      face: owner.kind === 'user' ? (owner.profile.avatar_homie_id ? fc[owner.profile.avatar_homie_id] ?? '🙂' : '🙂') : owner.kind === 'homie' ? owner.homie.face || '🙂' : '👥',
    });
  }
  cards.sort((a, b) => Number(b.mine) - Number(a.mine));
  return { userId, hasProfile: !!ppl[userId], cards };
}

// ---------------------------------------------------------------------------
// One space, fully loaded for display
// ---------------------------------------------------------------------------
export type TopFriend = { id: string; person: PersonLite | null; face: string };
export type PostView = CliquePost & { author: PersonLite | null; likes: number; liked: boolean; images: { url: string; alt: string }[]; mine: boolean };
export type BlurbView = { id: string; body: string; created_at: string; author: PersonLite | null; mine: boolean };
export interface SpaceView {
  userId: string;
  space: CliqueMehspace;
  owner: Owner;
  href: string;
  canEdit: boolean;
  canBlurb: boolean;
  top: TopFriend[];
  posts: PostView[];
  blurbs: BlurbView[];
  photoUrl: string | null;
  songUrl: string | null;
  songIsUpload: boolean;
  frameDoc: string | null;
  frameHeight: number;
}

async function buildView(ses: Session, space: CliqueMehspace, owner: Owner): Promise<SpaceView> {
  const { s, userId } = ses;
  const [{ data: canEdit }, { data: canBlurb }, postsRes, blurbsRes] = await Promise.all([
    s.rpc('clique_can_edit_space', { p_space: space.id }),
    s.rpc('clique_can_blurb', { p_space: space.id }),
    s.from('clique_posts').select('*').eq('space_id', space.id).order('created_at', { ascending: false }).limit(30),
    s.from('clique_blurbs').select('*').eq('space_id', space.id).order('created_at', { ascending: false }).limit(30),
  ]);
  const posts = (postsRes.data ?? []) as CliquePost[];
  const blurbs = (blurbsRes.data ?? []) as { id: string; body: string; created_at: string; author_id: string }[];
  const likeRows = posts.length
    ? ((await s.from('clique_post_likes').select('post_id, user_id').in('post_id', posts.map((p) => p.id))).data ?? []) as { post_id: string; user_id: string }[]
    : [];
  const ppl = await people(s, [...space.top_friends, ...posts.map((p) => p.author_id), ...blurbs.map((b) => b.author_id)]);
  const fc = await faces(s, Object.values(ppl));
  const layout = layoutOf(space);
  const [photoUrl, uploadedSong, images] = await Promise.all([
    signed(s, layout.photo_path),
    signed(s, layout.song_path),
    Promise.all(posts.map((p) => Promise.all((Array.isArray(p.media) ? p.media : []).map(async (m) => ({ url: await signed(s, m.path), alt: m.alt ?? '' }))))),
  ]);
  const theme = themeOf(space.theme);
  return {
    userId, space, owner, href: spaceHref(owner),
    canEdit: !!canEdit, canBlurb: !!canBlurb,
    top: space.top_friends.map((id) => {
      const person = ppl[id] ?? null;
      return { id, person, face: person?.avatar_homie_id ? fc[person.avatar_homie_id] ?? '🙂' : '🙂' };
    }),
    posts: posts.map((p, i) => ({
      ...p,
      author: ppl[p.author_id] ?? null,
      likes: likeRows.filter((l) => l.post_id === p.id).length,
      liked: likeRows.some((l) => l.post_id === p.id && l.user_id === userId),
      images: images[i].filter((m): m is { url: string; alt: string } => !!m.url),
      mine: p.author_id === userId,
    })),
    blurbs: blurbs.map((b) => ({ id: b.id, body: b.body, created_at: b.created_at, author: ppl[b.author_id] ?? null, mine: b.author_id === userId })),
    photoUrl,
    songUrl: uploadedSong ?? space.song_url,
    songIsUpload: !!uploadedSong,
    frameDoc: space.render_status === 'ok' && space.rendered_html !== null
      ? frameDocument(space.rendered_html, space.rendered_css ?? '', { ink: theme.ink, accent: theme.accent })
      : null,
    frameHeight: frameHeight(space),
  };
}

/** For the editor: the raw row plus owner, only if you can edit it. */
export async function loadForEdit(spaceId: string) {
  const ses = await session();
  if (!ses) return null;
  const { s, userId } = ses;
  const found = await ownerOf(s, spaceId);
  if (!found) return null;
  const { data: canEdit } = await s.rpc('clique_can_edit_space', { p_space: spaceId });
  if (!canEdit) return null;
  return { userId, ...found, href: spaceHref(found.owner), friends: await friendsFor(s, userId, found) };
}

/** Who may go in this space's Top 8 (the DB re-checks with clique_top_friend_allowed). */
async function friendsFor(s: Db, userId: string, found: { space: CliqueMehspace; owner: Owner }) {
  let ids: string[] = [];
  if (found.owner.kind === 'circle') {
    const { data } = await s.from('clique_circle_members').select('user_id').eq('circle_id', found.owner.circle.id);
    ids = ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
  } else {
    const { data } = await s.from('clique_friendships').select('requester_id, addressee_id').eq('status', 'accepted');
    ids = ((data ?? []) as { requester_id: string; addressee_id: string }[])
      .filter((f) => f.requester_id === userId || f.addressee_id === userId)
      .map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
    if (found.owner.kind === 'homie') ids.push(found.owner.homie.owner_id, ...(found.owner.homie.claimed_by ? [found.owner.homie.claimed_by] : []));
    else ids = ids.filter((id) => id !== userId);
  }
  const ppl = await people(s, ids);
  return Object.values(ppl).sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
export interface Basics {
  title: string; mood: string; about: string; interests: string[]; heroes: string[];
  theme: string; visibility: Privacy; song_url: string | null; frame_height: number;
}

async function current(s: Db, spaceId: string) {
  const { data, error } = await s.from('clique_mehspaces').select('*').eq('id', spaceId).maybeSingle();
  if (error) return { ok: false as const, error: friendly(error.message) };
  if (!data) return { ok: false as const, error: 'Mehspace not found.' };
  return { ok: true as const, data: data as CliqueMehspace };
}

async function update(s: Db, spaceId: string, patch: Partial<CliqueMehspace>): Promise<Result<CliqueMehspace>> {
  const { data, error } = await s.from('clique_mehspaces').update(patch).eq('id', spaceId).select('*').maybeSingle();
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data) return { ok: false, error: "You can't edit this Mehspace." };
  return { ok: true, data: data as CliqueMehspace };
}

export async function saveBasics(spaceId: string, b: Basics): Promise<Result<CliqueMehspace>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const cur = await current(ses.s, spaceId);
  if (!cur.ok) return cur;
  const { frame_height, ...rest } = b;
  return update(ses.s, spaceId, { ...rest, layout_json: { ...layoutOf(cur.data), frame_height } });
}

export async function saveTopFriends(spaceId: string, ids: string[]): Promise<Result<CliqueMehspace>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  return update(ses.s, spaceId, { top_friends: [...new Set(ids)].slice(0, 8) });
}

export async function saveMedia(spaceId: string, kind: 'song' | 'photo', path: string | null): Promise<Result<CliqueMehspace>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  if (path !== null && !new RegExp(`^${ses.userId}/mehspace/[A-Za-z0-9._-]{1,120}$`).test(path)) return { ok: false, error: 'That file isn’t yours.' };
  const cur = await current(ses.s, spaceId);
  if (!cur.ok) return cur;
  const layout = { ...layoutOf(cur.data) };
  if (path) layout[`${kind}_path`] = path; else delete layout[`${kind}_path`];
  return update(ses.s, spaceId, { layout_json: layout });
}

/** Save raw HTML/CSS as the user (RLS proves edit rights), then run the trusted sanitizer. */
export async function saveCustom(spaceId: string, html: string, css: string): Promise<Result<{ status: CliqueMehspace['render_status']; error?: string }>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const res = await update(ses.s, spaceId, { custom_html: html, custom_css: css });
  if (!res.ok) return res;
  return { ok: true, data: await trustedRender(res.data) };
}

/** Re-run the sanitizer on the stored raw fields (e.g. after a sanitizer upgrade). Editors only. */
export async function rerender(spaceId: string) {
  const ses = await session();
  if (!ses) return { ok: false as const, error: 'Please sign in first.' };
  const { data: canEdit } = await ses.s.rpc('clique_can_edit_space', { p_space: spaceId });
  if (!canEdit) return { ok: false as const, error: "You can't edit this Mehspace." };
  const cur = await current(ses.s, spaceId);
  if (!cur.ok) return cur;
  return { ok: true as const, data: await trustedRender(cur.data) };
}

/**
 * The trusted step. Caller must already have proven edit rights. Re-reads the row with the service
 * role, sanitizes, and writes rendered_* only if the raw fields haven't changed since (updated_at guard).
 */
async function trustedRender(row: CliqueMehspace): Promise<{ status: CliqueMehspace['render_status']; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { status: 'pending', error: 'Custom HTML is saved; publishing needs SUPABASE_SERVICE_ROLE_KEY on the server.' };
  const { data } = await admin.from('clique_mehspaces').select('*').eq('id', row.id).maybeSingle();
  if (!data) return { status: 'pending' };
  const fresh = data as CliqueMehspace;
  const out = renderMehspace(fresh.custom_html, fresh.custom_css);
  const layout = { ...layoutOf(fresh) };
  if (out.error) layout.render_error = out.error; else delete layout.render_error;
  const { data: written, error } = await admin.from('clique_mehspaces').update({
    rendered_html: out.status === 'ok' ? out.html : null,
    rendered_css: out.status === 'ok' ? out.css : null,
    render_status: out.status,
    sanitizer_version: SANITIZER_VERSION,
    sanitized_at: new Date().toISOString(),
    layout_json: layout,
  }).eq('id', fresh.id).eq('updated_at', fresh.updated_at).select('id').maybeSingle();
  if (error) return { status: 'pending', error: error.message };
  if (!written) return { status: 'pending', error: 'The page changed while publishing; save again.' };
  return { status: out.status, error: out.error };
}

export async function addPost(spaceId: string, body: string, media: CliquePost['media']): Promise<Result<string>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { data, error } = await ses.s.from('clique_posts').insert({ space_id: spaceId, body, media }).select('id').single();
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: data.id as string };
}

export async function deletePost(postId: string): Promise<Result<null>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { error } = await ses.s.from('clique_posts').delete().eq('id', postId);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: null };
}

export async function toggleLike(postId: string): Promise<Result<boolean>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { s, userId } = ses;
  const { data: existing } = await s.from('clique_post_likes').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
  if (existing) {
    const { error } = await s.from('clique_post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: false };
  }
  const { error } = await s.from('clique_post_likes').insert({ post_id: postId });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: true };
}

export async function addBlurb(spaceId: string, body: string): Promise<Result<string>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { data, error } = await ses.s.from('clique_blurbs').insert({ space_id: spaceId, body }).select('id').single();
  if (error) return { ok: false, error: /row-level security/i.test(error.message) ? 'Only friends can write blurbs here (and not on your own page).' : friendly(error.message) };
  return { ok: true, data: data.id as string };
}

export async function deleteBlurb(blurbId: string): Promise<Result<null>> {
  const ses = await session();
  if (!ses) return { ok: false, error: 'Please sign in first.' };
  const { error } = await ses.s.from('clique_blurbs').delete().eq('id', blurbId);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: null };
}
