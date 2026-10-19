# Clique schema (Phase 2)

Migrations: `supabase/migrations/20261019000100…000800_clique_*.sql`. Target: **rva.guru's Supabase project**.
They only add things. Every object uses the `clique_` prefix, and every table has RLS turned on.

| Migration | Contents |
|---|---|
| 0100 identity | helpers (`clique_is_trusted`, `clique_try_uuid`, code hashing), `clique_profiles`, `clique_friendships` (+ transition guard), `clique_invites`, `clique_find_profile()` |
| 0200 circles | `clique_circles`, `clique_circle_members` (role guard, last-owner protection), `clique_create_invite()`, `clique_claim_invite()` |
| 0300 homies | `clique_homies` (kind `avatar`/`pet`/`friend_page`, hashed expiring claim codes), `clique_homie_events`, `clique_homie_reels`, `clique_influences`, `clique_homie_influences`, `clique_issue_homie_claim()`, `clique_claim_homie()` |
| 0400 mehspace | `clique_mehspaces` (user, homie or circle owner; raw `custom_html/css` + server-only `rendered_*`), `clique_posts`, `clique_blurbs`, `clique_post_likes`; auto-creates a user Mehspace for each new profile |
| 0500 dial | `clique_threads` (dm/group/circle), `clique_thread_members`, `clique_messages` (`kind` defaults to `image`; `image_path` must be `{thread}/{sender}/…`), `clique_dial_sessions`, `clique_start_dm()`, `clique_create_group()`, `clique_add_group_member()`; adds messages to Realtime |
| 0600 activities | `clique_activities` for the Home feed. Written only by triggers on posts, blurbs, homie events, friendships and circle joins. Each activity's visibility is the most restrictive of the source content's visibility and the actor's privacy |
| 0700 storage | private buckets `clique-chat` (thread members only) and `clique-media` (owner writes; reads follow profile privacy). Use signed URLs |
| 0800 grants | Security-definer RPCs: `authenticated`/`service_role` only. Internal trigger helpers aren't callable by clients |

## Coexisting with rva.guru
- rva.guru's `public.profiles` (billing/admin columns, owner-only RLS, `handle_new_user` trigger) is **not modified**.
  Clique identity lives in `clique_profiles` (`id` = `auth.users.id`), so rva.guru users sign in once and onboard into Clique.
- `clique_friendships` has the same columns as rva-guru-full-stack-platform **PR #28** (`feature/clique-mvp`).
  Validation showed this file applies cleanly on top of PR #28's migrations. Recommendation: drop PR #28's
  `20261016_clique_friends.sql` and the `profiles.handle/visibility` additions in favor of this schema. Re-running PR #28's
  friends migration *after* this one would replace `guard_clique_friendship_change()` and remove the trusted
  bypass that invite claims rely on. Also, if PR #28's `app/clique/*` pages ship, they shadow the `/clique` multi-zone rewrite.

## Validation (no live DB)
`npm run db:validate` applies all migrations twice (to check idempotency) to an in-memory PGlite Postgres with stubbed
Supabase `auth`/`storage` schemas and roles, then runs 35 RLS/RPC behavior checks. To prove coexistence:
`RVA_CORE_SCHEMA=<rva core_schema.sql>[,<more.sql>] npm run db:validate`.

## Applying (Kieran)
1. Back up / branch the rva.guru project (Supabase branching or a staging copy).
2. Link the project: `supabase link --project-ref <rva-guru-ref>`. Then **on staging first**: `supabase db push` (or paste each file in order in the SQL editor).
3. Run `supabase gen types typescript` and replace `src/lib/clique/types.ts` when convenient.
4. Auth → URL config: add `https://rva.guru/clique/auth/callback`.
5. Smoke test sign-in → `/clique/onboarding` → profile saved → Mehspace row created.
6. Optional: run `scripts/import-homies2.ts` as a dry run, then `--apply` on staging, then production.
