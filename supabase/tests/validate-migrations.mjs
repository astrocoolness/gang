// Validates Clique migrations against a throwaway in-memory Postgres (PGlite) with stubbed
// Supabase auth/storage, then exercises key RLS rules. Never touches a real database.
//   npm run db:validate
//   RVA_CORE_SCHEMA=../rva-guru-full-stack-platform/supabase/migrations/20260926_core_schema.sql npm run db:validate
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, '..', 'migrations');
const db = new PGlite();
process.on('uncaughtException', (e) => {
  console.error('\nFAILED:', e?.message ?? e, e?.query ? `\n  query: ${e.query}` : '');
  process.exit(1);
});

await db.exec(readFileSync(join(here, 'stubs.sql'), 'utf8'));
if (process.env.RVA_CORE_SCHEMA) {
  // Prove coexistence with rva.guru's existing public.profiles + auth trigger.
  // Comma-separated list, applied in order (e.g. core schema, then rva-guru PR #28 migrations).
  for (const f of process.env.RVA_CORE_SCHEMA.split(',')) {
    await db.exec(readFileSync(f, 'utf8'));
    console.log('applied rva.guru schema:', f);
  }
}
const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  await db.exec(readFileSync(join(migDir, f), 'utf8'));
  console.log('applied', f);
}
// Re-apply to prove idempotency.
for (const f of files) await db.exec(readFileSync(join(migDir, f), 'utf8'));
console.log('re-applied all migrations (idempotent)');

// RLS coverage: every clique_ table has RLS enabled.
const noRls = await db.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and relname like 'clique\\_%' and not relrowsecurity`);
assert.equal(noRls.rows.length, 0, 'tables without RLS: ' + JSON.stringify(noRls.rows));

// ---- helpers ----
const users = {};
for (const name of ['ann', 'bob', 'cat', 'dan']) {
  const r = await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@example.com`]);
  users[name] = r.rows[0].id;
}
async function as(user, sql, params = []) {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ? users[user] : '']);
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role`);
  }
}
async function fails(user, sql, params, re) {
  try {
    await as(user, sql, params);
  } catch (e) {
    if (re) assert.match(String(e.message), re);
    return;
  }
  assert.fail(`expected failure: ${sql}`);
}
let passed = 0;
const ok = (label) => { passed++; console.log('  ✓', label); };

// ---- profiles ----
for (const [u, privacy] of [['ann', 'friends'], ['bob', 'friends'], ['cat', 'public'], ['dan', 'private']]) {
  await as(u, `insert into clique_profiles (id, username, display_name, privacy) values (auth.uid(), $1, $2, $3)`,
    [u, u.toUpperCase(), privacy]);
}
ok('users create their own profiles');
await fails('ann', `insert into clique_profiles (id, username, display_name) values ($1, 'evil', 'x')`, [users.bob]);
ok('cannot create a profile for someone else');
await fails('ann', `update clique_profiles set username = 'Bad Name!' where id = auth.uid()`, [], /check/);
ok('username format enforced');
assert.equal((await as('ann', `select id from clique_profiles where id = $1`, [users.bob])).rows.length, 0);
assert.equal((await as('ann', `select id from clique_profiles where id = $1`, [users.cat])).rows.length, 1);
ok('friends-only profile hidden from non-friend; public profile visible');
assert.equal((await as(null, `select id from clique_profiles`).catch(() => ({ rows: [] }))).rows.length, 0);
ok('anon sees no profiles');
assert.equal((await as('ann', `select * from clique_find_profile('dan')`)).rows.length, 0);
assert.equal((await as('ann', `select * from clique_find_profile('bob')`)).rows.length, 1);
ok('username lookup hides private profiles');
assert.equal((await as('ann', `select id from clique_mehspaces where user_id = auth.uid()`)).rows.length, 1);
ok('profile insert auto-creates the user Mehspace');

// ---- friendships via request + invite ----
await as('ann', `insert into clique_friendships (requester_id, addressee_id) values (auth.uid(), $1)`, [users.bob]);
await fails('ann', `update clique_friendships set status = 'accepted' where addressee_id = $1`, [users.bob], /recipient/);
ok('requester cannot self-accept');
await as('bob', `update clique_friendships set status = 'accepted' where requester_id = $1`, [users.ann]);
assert.equal((await as('ann', `select id from clique_profiles where id = $1`, [users.bob])).rows.length, 1);
ok('accepted friend can see friends-only profile');
const token = (await as('cat', `select clique_create_invite() as t`)).rows[0].t;
await fails('cat', `select clique_claim_invite($1)`, [token], /not found/);
ok('cannot claim your own invite');
await as('dan', `select clique_claim_invite($1)`, [token]);
assert.equal((await as('dan', `select clique_are_friends($1, auth.uid()) as f`, [users.cat])).rows[0].f, true);
await fails('ann', `select clique_claim_invite($1)`, [token], /not found/);
ok('invite claim befriends inviter and is single-use');
assert.equal((await as('ann', `select token_hash from clique_invites`)).rows.length, 0);
ok('invites are invisible to non-owners');

// ---- homies + claim ----
await as('ann', `insert into clique_homies (kind, name) values ('avatar', 'Ann Avatar')`);
await fails('ann', `insert into clique_homies (kind, name) values ('avatar', 'Second')`, [], /unique|duplicate/);
ok('one avatar homie per user');
await fails('ann', `insert into clique_homies (kind, name, claimed_by) values ('friend_page', 'x', $1)`, [users.bob]);
ok('cannot forge claim fields on insert');
const page = (await as('ann', `insert into clique_homies (kind, name, visibility) values ('friend_page', 'Page for Cat', 'private') returning id`)).rows[0].id;
const code = (await as('ann', `select clique_issue_homie_claim($1) as c`, [page])).rows[0].c;
assert.equal((await as('cat', `select id from clique_homies where id = $1`, [page])).rows.length, 0);
ok('private friend page hidden before claim');
await as('cat', `select clique_claim_homie($1)`, [code]);
assert.equal((await as('cat', `select claimed_by from clique_homies where id = $1`, [page])).rows[0].claimed_by, users.cat);
await as('cat', `update clique_homies set backstory = 'mine now' where id = $1`, [page]);
await fails('cat', `update clique_homies set owner_id = auth.uid() where id = $1`, [page], /managed by the server/);
ok('claimant can edit page but not take ownership');
await fails('dan', `select clique_claim_homie($1)`, [code], /not found/);
ok('claim code is single-use');
const pet = (await as('bob', `insert into clique_homies (kind, name) values ('pet', 'Nori') returning id`)).rows[0].id;
await as('ann', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'care', '{"action":"feed","food":"fav"}')`, [pet]);
await fails('ann', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'evolve', '{"to":"kid"}')`, [pet]);
ok('friends can care for a homie but not evolve it');

// ---- Phase 3: care rules + care activity ----
await fails('ann', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'care', '{"action":"play"}')`, [pet], /cooldown/);
ok('friend care has a cooldown');
await fails('cat', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'care', '{"action":"feed"}')`, [pet]);
ok('non-friends cannot care for a friends-only homie');
await fails('bob', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'care', '{"action":"dance"}')`, [pet], /invalid care action/);
await fails('bob', `insert into clique_homie_events (homie_id, actor_id, type) values ($1, auth.uid(), 'care')`, [pet], /invalid care action/);
await fails('bob', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'care', '{"action":"feed","food":{"x":1}}')`, [pet], /invalid care food/);
ok('care payload is validated');
for (const action of ['feed', 'play', 'sleep', 'wake', 'medicine']) {
  await as('bob', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'care', jsonb_build_object('action', $2::text))`, [pet, action]);
}
ok('owner care has no cooldown and may use every action');
await fails('bob', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'evolve', '{"to":"wizard"}')`, [pet], /invalid evolve/);
await as('bob', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'evolve', '{"from":"baby","to":"kid"}')`, [pet]);
ok('owner evolves with a valid stage');
const petFeed = (await as('bob', `select verb, actor_id, target_user_id, summary from clique_activities where homie_id = $1 order by created_at`, [pet])).rows;
const cared = petFeed.filter((r) => r.verb === 'homie_cared');
assert.equal(cared.length, 1, JSON.stringify(petFeed));
assert.equal(cared[0].actor_id, users.ann); assert.equal(cared[0].target_user_id, users.bob);
assert.equal(cared[0].summary.action, 'feed');
assert.ok(petFeed.some((r) => r.verb === 'homie_evolved' && r.summary.to === 'kid'));
ok("friend care reaches the owner's Home; owner care does not flood it; evolution is announced");
assert.equal((await as('ann', `select count(*)::int as n from clique_activities where verb = 'homie_cared' and homie_id = $1`, [pet])).rows[0].n, 1);
assert.equal((await as('cat', `select count(*)::int as n from clique_activities where homie_id = $1`, [pet])).rows[0].n, 0);
assert.equal((await as('bob', `select visibility from clique_activities where verb = 'homie_cared'`)).rows[0].visibility, 'private');
ok("care activity is private to the friend and the owner (no leak to the friend's friends)");
// A friend who claimed a page cares as an editor (no cooldown, no activity spam).
await as('cat', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'care', '{"action":"sleep"}')`, [page]);
await as('cat', `insert into clique_homie_events (homie_id, actor_id, type, payload) values ($1, auth.uid(), 'care', '{"action":"talk"}')`, [page]);
assert.equal((await as('ann', `select count(*)::int as n from clique_activities where verb = 'homie_cared' and homie_id = $1`, [page])).rows[0].n, 0);
ok('claimant cares as an editor');
await as('bob', `update clique_homies set stats = '{"hunger": 50}', stage = 'kid', profile = jsonb_build_object('sim', jsonb_build_object('v', 1)) where id = $1`, [pet]);
await as('ann', `update clique_homies set stats = '{"hunger": 100}' where id = $1`, [pet]);
assert.equal((await as('bob', `select stats->>'hunger' as h from clique_homies where id = $1`, [pet])).rows[0].h, '50');
ok('only editors persist the sim snapshot');
await fails('ann', `select clique_guard_homie_event()`, [], /permission|trigger/);
ok('care guard is internal');
// Influence library basics.
const inf = (await as('bob', `insert into clique_influences (title, kind, url, visibility) values ('Blue Train', 'music', 'https://example.com/x', 'friends') returning id`)).rows[0].id;
await fails('bob', `insert into clique_influences (title, url) values ('bad', 'javascript:alert(1)')`, [], /check/);
await as('bob', `insert into clique_homie_influences (homie_id, influence_id, weight) values ($1, $2, 0.8)`, [pet, inf]);
assert.equal((await as('ann', `select count(*)::int as n from clique_homie_influences where homie_id = $1`, [pet])).rows[0].n, 1);
await fails('ann', `insert into clique_homie_influences (homie_id, influence_id) values ($1, $2)`, [pet, inf]);
const priv = (await as('ann', `insert into clique_influences (title) values ('secret') returning id`)).rows[0].id;
await fails('bob', `insert into clique_homie_influences (homie_id, influence_id) values ($1, $2)`, [pet, priv]);
assert.equal((await as('bob', `select id from clique_influences where id = $1`, [priv])).rows.length, 0);
ok('influences: private by default, attach only your own visible ones to Homies you edit');

// ---- mehspace sanitized render ----
const space = (await as('ann', `select id from clique_mehspaces where user_id = auth.uid()`)).rows[0].id;
await as('ann', `update clique_mehspaces set custom_html = '<script>x</script>', rendered_html = '<script>x</script>', render_status = 'ok' where id = $1`, [space]);
const sp = (await as('ann', `select rendered_html, render_status from clique_mehspaces where id = $1`, [space])).rows[0];
assert.equal(sp.rendered_html, null); assert.equal(sp.render_status, 'pending');
ok('clients cannot write sanitized render fields');
await db.exec(`set role service_role`);
await db.query(`update clique_mehspaces set rendered_html = '<p>x</p>', render_status = 'ok' where id = $1`, [space]);
await db.exec(`reset role`);
assert.equal((await as('ann', `select render_status from clique_mehspaces where id = $1`, [space])).rows[0].render_status, 'ok');
ok('trusted sanitizer (service_role) can publish rendered HTML');
await as('bob', `insert into clique_posts (space_id, body) values ($1, 'hey ann')`, [space]);
await fails('dan', `insert into clique_posts (space_id, body) values ($1, 'spam')`, [space]);
ok('friends can post on Mehspace; strangers cannot');

// ---- Phase 4: Mehspace social rules ----
await as('ann', `update clique_mehspaces set top_friends = array[$1::uuid] where id = $2`, [users.bob, space]);
await fails('ann', `update clique_mehspaces set top_friends = array[$1::uuid] where id = $2`, [users.dan, space], /friends/);
await fails('ann', `update clique_mehspaces set top_friends = array[$1::uuid, $1::uuid] where id = $2`, [users.bob, space], /distinct/);
await fails('ann', `update clique_mehspaces set top_friends = array[auth.uid()] where id = $1`, [space], /friends/);
assert.equal((await as('ann', `select clique_top_friend_allowed('user', $1, null, null, $2) as a`, [users.cat, users.dan])).rows[0].a, false);
ok('Top 8: friends only, no duplicates or self; no friendship oracle for other people');
await as('ann', `update clique_mehspaces set layout_json = jsonb_build_object('song_path', auth.uid() || '/mehspace/song.mp3') where id = $1`, [space]);
await fails('ann', `update clique_mehspaces set layout_json = jsonb_build_object('photo_path', $1::text || '/mehspace/x.png') where id = $2`, [users.bob, space], /own/);
await fails('ann', `update clique_mehspaces set layout_json = jsonb_build_object('photo_path', auth.uid() || '/mehspace/../avatars/x.png') where id = $1`, [space], /own/);
await fails('ann', `update clique_mehspaces set layout_json = '[]' where id = $1`, [space], /invalid layout/);
await as('ann', `update clique_mehspaces set layout_json = layout_json || '{"render_error": "forged"}' where id = $1`, [space]);
assert.equal((await as('ann', `select layout_json ? 'render_error' as e from clique_mehspaces where id = $1`, [space])).rows[0].e, false);
await db.exec(`set role service_role`);
await db.query(`update clique_mehspaces set layout_json = layout_json || '{"render_error": "CSS too big"}', render_status = 'rejected' where id = $1`, [space]);
await db.exec(`reset role`);
await as('ann', `update clique_mehspaces set mood = '' where id = $1`, [space]);
assert.equal((await as('ann', `select layout_json->>'render_error' as e from clique_mehspaces where id = $1`, [space])).rows[0].e, 'CSS too big');
await as('ann', `update clique_mehspaces set custom_css = 'p{}' where id = $1`, [space]);
const afterEdit = (await as('ann', `select layout_json->>'render_error' as e, render_status from clique_mehspaces where id = $1`, [space])).rows[0];
assert.deepEqual([afterEdit.e, afterEdit.render_status], [null, 'pending']);
ok('layout media paths must be your own mehspace files; render_error is sanitizer-only and clears on edit');
await fails('ann', `update clique_mehspaces set visibility = 'public' where id = $1`, [space], /profile privacy/);
await as('ann', `update clique_mehspaces set visibility = 'private' where id = $1`, [space]);
await as('ann', `update clique_mehspaces set visibility = 'friends' where id = $1`, [space]);
const catSpace = (await as('cat', `select id, visibility from clique_mehspaces where user_id = auth.uid()`)).rows[0];
assert.equal(catSpace.visibility, 'public');
await as('cat', `update clique_profiles set privacy = 'friends' where id = auth.uid()`);
assert.equal((await as('cat', `select visibility from clique_mehspaces where id = $1`, [catSpace.id])).rows[0].visibility, 'friends');
await as('cat', `update clique_profiles set privacy = 'public' where id = auth.uid()`);
await as('cat', `update clique_mehspaces set visibility = 'public' where id = $1`, [catSpace.id]);
ok('Mehspace visibility is capped by profile privacy, and tightening privacy tightens the space');
await as('bob', `insert into clique_blurbs (space_id, body) values ($1, 'ann is the best')`, [space]);
await fails('ann', `insert into clique_blurbs (space_id, body) values ($1, 'i am great')`, [space]);
await fails('dan', `insert into clique_blurbs (space_id, body) values ($1, 'hi')`, [space]);
await as('dan', `insert into clique_blurbs (space_id, body) values ($1, 'cat rules')`, [catSpace.id]);
await fails('bob', `insert into clique_blurbs (space_id, body) values ($1, 'who?')`, [catSpace.id]);
await as('bob', `insert into clique_posts (space_id, body) values ($1, 'nice public page')`, [catSpace.id]);
const bl = (await as('ann', `select target_user_id, visibility from clique_activities where verb = 'blurbed' and actor_id = $1`, [users.bob])).rows;
assert.equal(bl.length, 1); assert.equal(bl[0].target_user_id, users.ann);
ok('blurbs are friend-made (not by the page editor, not by strangers on public pages); Home targets the owner');
await as('bob', `insert into clique_posts (space_id, body, media) values ($1, '', jsonb_build_array(jsonb_build_object('path', auth.uid() || '/posts/a.png', 'mime', 'image/png')))`, [space]);
await fails('bob', `insert into clique_posts (space_id, body, media) values ($1, 'x', jsonb_build_array(jsonb_build_object('path', $2::text || '/posts/a.png', 'mime', 'image/png')))`, [space, users.ann], /media/);
await fails('bob', `insert into clique_posts (space_id, body, media) values ($1, 'x', jsonb_build_array(jsonb_build_object('path', auth.uid() || '/posts/a.html', 'mime', 'text/html')))`, [space], /media/);
await fails('bob', `insert into clique_posts (space_id, body, media) values ($1, 'x', (select jsonb_agg(jsonb_build_object('path', auth.uid() || '/posts/' || i || '.png', 'mime', 'image/png')) from generate_series(1, 5) i))`, [space], /media/);
ok('post media must be your own images in clique-media/{uid}/posts (max 4)');
await as('ann', `update clique_mehspaces set mood = '😴 sleepy' where id = $1`, [space]);
await as('ann', `update clique_mehspaces set mood = '🔥 hyped' where id = $1`, [space]);
const moods = (await as('bob', `select summary->>'mood' as m from clique_activities where verb = 'mood_changed' and actor_id = $1`, [users.ann])).rows;
assert.deepEqual(moods.map((r) => r.m), ['🔥 hyped']);
assert.equal((await as('dan', `select id from clique_activities where verb = 'mood_changed'`)).rows.length, 0);
ok('mood changes reach friends on Home (latest only), not strangers');
const petSpace = (await as('bob', `insert into clique_mehspaces (owner_type, homie_id, title) values ('homie', $1, 'Pet page') returning id`, [pet])).rows[0].id;
ok('Homie Mehspace insert ... returning works for its editor (Phase 2 select-policy fix)');
await as('ann', `insert into clique_posts (space_id, body) values ($1, 'cute pet')`, [petSpace]);
const hp = (await as('bob', `select target_user_id, summary from clique_activities where verb = 'posted' and actor_id = $1 and homie_id = $2`, [users.ann, pet])).rows[0];
assert.equal(hp.target_user_id, users.bob); assert.equal(hp.summary.owner_type, 'homie'); assert.ok(hp.summary.homie_name);
await as('bob', `update clique_mehspaces set top_friends = array[$1::uuid] where id = $2`, [users.ann, petSpace]);
await fails('bob', `update clique_mehspaces set top_friends = array[$1::uuid] where id = $2`, [users.dan, petSpace], /friends/);
ok('Homie Mehspace: posts target the Homie owner; Top 8 from the editor’s friends');
await fails('ann', `select clique_guard_mehspace_social()`, [], /permission|trigger/);
await fails(null, `select clique_can_blurb($1)`, [space], /permission/);
ok('Phase 4 helpers are not exposed to anon; trigger functions are internal');

// ---- dial ----
const dm = (await as('ann', `select clique_start_dm($1) as id`, [users.bob])).rows[0].id;
assert.equal((await as('bob', `select clique_start_dm($1) as id`, [users.ann])).rows[0].id, dm);
ok('DM thread is unique per pair');
await fails('ann', `select clique_start_dm($1)`, [users.dan], /friends/);
ok('cannot DM non-friends');
await fails('ann', `insert into clique_messages (thread_id, sender_id, kind) values ($1, auth.uid(), 'image')`, [dm], /image_required|check/);
ok('picture message requires an image');
await as('ann', `insert into clique_messages (thread_id, sender_id, image_path) values ($1::uuid, auth.uid(), $1::text || '/' || auth.uid() || '/a.webp')`, [dm]);
await fails('ann', `insert into clique_messages (thread_id, sender_id, image_path) values ($1::uuid, auth.uid(), $1::text || '/' || $2 || '/a.webp')`, [dm, users.bob], /your_user_id/);
ok('image path must be in your folder of the thread');
assert.equal((await as('bob', `select id from clique_messages where thread_id = $1`, [dm])).rows.length, 1);
assert.equal((await as('cat', `select id from clique_messages where thread_id = $1`, [dm])).rows.length, 0);
ok('only thread members read messages');
await fails('ann', `insert into clique_threads (kind, title) values ('group', 'x')`);
ok('threads only via RPC');

// ---- storage ----
await as('ann', `insert into storage.objects (bucket_id, name) values ('clique-chat', $1::text || '/' || auth.uid() || '/a.webp')`, [dm]);
await fails('cat', `insert into storage.objects (bucket_id, name) values ('clique-chat', $1::text || '/' || auth.uid() || '/b.webp')`, [dm]);
assert.equal((await as('bob', `select id from storage.objects where bucket_id = 'clique-chat'`)).rows.length, 1);
assert.equal((await as('cat', `select id from storage.objects where bucket_id = 'clique-chat'`)).rows.length, 0);
ok('chat images readable by thread members only');
await fails('ann', `insert into storage.objects (bucket_id, name) values ('clique-media', $1 || '/avatars/x.png')`, [users.bob]);
await as('ann', `insert into storage.objects (bucket_id, name) values ('clique-media', auth.uid() || '/avatars/x.png')`);
assert.equal((await as('dan', `select id from storage.objects where bucket_id = 'clique-media'`)).rows.length, 0);
assert.equal((await as('bob', `select id from storage.objects where bucket_id = 'clique-media'`)).rows.length, 1);
ok('media writes scoped to own folder; reads follow profile privacy');

// ---- circles ----
const circle = (await as('ann', `insert into clique_circles (slug, name) values ('rva-crew', 'RVA Crew') returning id`)).rows[0].id;
assert.equal((await as('ann', `select role from clique_circle_members where circle_id = $1`, [circle])).rows[0].role, 'owner');
assert.equal((await as('ann', `select id from clique_threads where circle_id = $1`, [circle])).rows.length, 1);
ok('circle creator is owner and a circle thread exists');
await fails('dan', `insert into clique_circle_members (circle_id, user_id) values ($1, auth.uid())`, [circle], /invite/);
ok('cannot self-join a private circle');
const cinv = (await as('ann', `select clique_create_invite($1, 5) as t`, [circle])).rows[0].t;
await as('dan', `select clique_claim_invite($1)`, [cinv]);
assert.equal((await as('dan', `select clique_is_circle_member($1) as m`, [circle])).rows[0].m, true);
await as('dan', `update clique_circle_members set role = 'owner' where circle_id = $1 and user_id = auth.uid()`, [circle]);
assert.equal((await as('dan', `select clique_circle_role($1) as r`, [circle])).rows[0].r, 'member');
ok('circle invite joins as member; no self-promotion');
await fails('ann', `delete from clique_circle_members where circle_id = $1 and user_id = auth.uid()`, [circle], /owner/);
ok('last owner cannot leave');

// ---- activities ----
const feedBob = (await as('bob', `select verb from clique_activities`)).rows.map((r) => r.verb);
assert.ok(feedBob.includes('befriended') && feedBob.includes('posted'), JSON.stringify(feedBob));
const feedCatOfAnnCircle = (await as('cat', `select verb from clique_activities where circle_id = $1`, [circle])).rows;
assert.equal(feedCatOfAnnCircle.length, 0);
await fails('bob', `insert into clique_activities (actor_id, verb, object_type, object_id) values (auth.uid(), 'posted', 'post', gen_random_uuid())`);
ok('activity feed is trigger-written and visibility-filtered');

// ---- grants ----
await fails(null, `select clique_start_dm($1)`, [users.bob], /permission/);
await fails('ann', `select clique_actor_visibility(auth.uid())`, [], /permission/);
ok('anon cannot call RPCs; internal helpers not callable');

// ---- HOMIES² same-project importer (supabase/scripts/import_homies2.sql) ----
// Stub HOMIES² tables using the column names the importer assumes (VERIFY against live schema).
await db.exec(`
  create table public.homies_profiles (id uuid primary key, display_name text, handle text, bio text,
    status_text text, avatar_url text, created_at timestamptz default now());
  create table public.homies_connections (id uuid primary key default gen_random_uuid(), requester_id uuid,
    addressee_id uuid, status text, created_at timestamptz default now());
  create table public.homies_threads (id uuid primary key default gen_random_uuid(), title text, created_by uuid,
    created_at timestamptz default now());
  create table public.homies_thread_members (thread_id uuid, user_id uuid);
  create table public.homies_messages (id uuid primary key default gen_random_uuid(), thread_id uuid, sender_id uuid,
    body text, created_at timestamptz default now());
  create table public.homies_contacts (owner_id uuid, label text, phone_e164 text);
`);
const h2 = {};
for (const name of ['eve', 'fay', 'gus']) {
  h2[name] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@example.com`])).rows[0].id;
}
await db.query(`insert into homies_profiles (id, display_name, handle, avatar_url) values
  ($1, 'Eve', '@ann', 'assets/homies/tony-adult.png'), ($2, 'Fay F', '@fay', 'assets/homies/nori-adult.png'),
  ($3, 'Gus', null, null), (gen_random_uuid(), 'Ghost', '@ghost', null), ($4, 'Ann again', '@ann2', null)`,
  [h2.eve, h2.fay, h2.gus, users.ann]);
await db.query(`insert into homies_connections (requester_id, addressee_id, status) values
  ($1, $2, 'accepted'), ($2, $3, 'pending'), ($1, $4, 'accepted')`, [h2.eve, h2.fay, h2.gus, users.ann]);
const t1 = (await db.query(`insert into homies_threads (title, created_by) values ('', $1) returning id`, [h2.eve])).rows[0].id;
const t2 = (await db.query(`insert into homies_threads (title, created_by) values ('The Block', $1) returning id`, [h2.eve])).rows[0].id;
await db.query(`insert into homies_thread_members values ($1, $2), ($1, $3), ($4, $2), ($4, $3), ($4, $5)`,
  [t1, h2.eve, h2.fay, t2, h2.gus]);
await db.query(`insert into homies_messages (thread_id, sender_id, body) values ($1, $2, 'yo'), ($1, $3, 'hey'),
  ($4, $2, 'block party'), ($4, $2, '   ')`, [t1, h2.eve, h2.fay, t2]);
const t3 = (await db.query(`insert into homies_threads (title) values ('') returning id`)).rows[0].id;
await db.query(`insert into homies_thread_members values ($1, $2), ($1, $3)`, [t3, users.ann, users.bob]);
await db.query(`insert into homies_messages (thread_id, sender_id, body) values ($1, $2, 'old ann->bob')`, [t3, users.ann]);
await db.query(`insert into homies_contacts values ($1, 'Mom', '+18045550100')`, [h2.eve]);
await db.exec(readFileSync(join(here, '..', 'scripts', 'import_homies2.sql'), 'utf8'));

const before = (await db.query(`select count(*)::int as n from clique_profiles`)).rows[0].n;
const dry = (await db.query(`select clique_import_homies2() as r`)).rows[0].r;
assert.equal(dry.mode, 'dry_run');
assert.equal(dry.profiles, 3);
assert.equal((await db.query(`select count(*)::int as n from clique_profiles`)).rows[0].n, before);
assert.equal((await db.query(`select count(*)::int as n from clique_threads where legacy_source = 'homies2'`)).rows[0].n, 0);
ok('importer dry run reports counts and writes nothing');
const run1 = (await db.query(`select clique_import_homies2(true) as r`)).rows[0].r;
assert.deepEqual(
  [run1.profiles, run1.avatar_homies, run1.friendships, run1.threads_created, run1.dm_threads_merged, run1.messages,
   run1.homies2_profiles_without_auth_user],
  [3, 2, 3, 2, 1, 4, 1], JSON.stringify(run1));
assert.equal((await db.query(`select count(*)::int as n from clique_messages where thread_id = $1`, [dm])).rows[0].n, 2);
assert.equal((await db.query(`select count(*)::int as n from clique_messages m join homies_contacts c on m.body = c.phone_e164`)).rows[0].n, 0);
ok('existing Clique DM is reused (history merged); contacts not imported');
const eve = (await db.query(`select username, avatar_homie_id from clique_profiles where id = $1`, [h2.eve])).rows[0];
assert.equal(eve.username, 'ann_2'); assert.ok(eve.avatar_homie_id);
assert.equal((await db.query(`select username from clique_profiles where id = $1`, [users.ann])).rows[0].username, 'ann');
ok('importer reuses auth ids, resolves username collisions, never overwrites existing profiles');
assert.equal((await db.query(`select kind from clique_threads where legacy_id = $1`, [t1])).rows[0].kind, 'dm');
assert.equal((await db.query(`select kind from clique_threads where legacy_id = $1`, [t2])).rows[0].kind, 'group');
const flood = await db.query(`select count(*)::int as n from clique_activities where verb = 'befriended' and actor_id in ($1, $2, $3)`, [h2.eve, h2.fay, h2.gus]);
assert.equal(flood.rows[0].n, 0);
ok('importer maps DMs vs groups and does not flood Home with old friendships');
const run2 = (await db.query(`select clique_import_homies2(true) as r`)).rows[0].r;
assert.deepEqual([run2.profiles, run2.friendships, run2.threads_created, run2.thread_members, run2.messages], [0, 0, 0, 0, 0], JSON.stringify(run2));
ok('importer is idempotent');
await fails('fay', `select clique_import_homies2(true)`, [], /permission/);
ok('importer is not callable through the API');

console.log(`\nAll ${passed} checks passed against ${files.length} migrations.`);
await db.close();
