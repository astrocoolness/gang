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

## HOMIES² import (same project)
HOMIES² (`oesdpdcncwdjnfvludxx`) is the same Supabase project as rva.guru, so the import is a single SQL function that copies
`homies_*` rows into `clique_*` and reuses `auth.users` ids directly. No email matching, no invites, no service keys.
It lives in `supabase/scripts/import_homies2.sql`, **outside `migrations/`**, so `supabase db push` never runs it.
- `select public.clique_import_homies2();` is a **dry run** (the default). It does all the work inside a subtransaction, rolls it back, and returns counts.
- `select public.clique_import_homies2(true);` applies. It's idempotent (`legacy_source='homies2'` + `legacy_id`, `ON CONFLICT DO NOTHING`), so re-runs add only new rows.
- Existing Clique profiles are never overwritten. Username collisions get `_2`, `_3`, … An existing Clique DM for the same pair is reused, and its history is merged.
- `homies_contacts` (private phone book) is **not** imported. `homies_profile_links` is a follow-up.
- Imported friendships don't generate "became friends" Home activity.
- Only postgres/service_role can execute it (revoked from anon/authenticated). Drop it when done.
- **VERIFY**: HOMIES² column names are inferred from `homies2/app.js`. Uncertain columns are read via `to_jsonb(row)->>'col'`, so a
  missing column becomes NULL rather than an error. The header lists the columns that must exist. Check them on staging with the dry run.

## Validation (no live DB)
`npm run db:validate` applies all migrations twice (to check idempotency) to an in-memory PGlite Postgres with stubbed
Supabase `auth`/`storage` schemas and roles, then runs 41 checks: RLS/RPC behavior plus the HOMIES² importer (dry run writes nothing, counts, collisions, DM merge,
idempotency, contacts skipped, not API-callable) against stub `homies_*` tables. To prove coexistence:
`RVA_CORE_SCHEMA=<rva core_schema.sql>[,<more.sql>] npm run db:validate`.

## Applying (Kieran)
1. Make a Supabase branch or staging copy of the rva.guru project (`oesdpdcncwdjnfvludxx`; it's also the HOMIES² project).
2. Apply the migrations there: `supabase link --project-ref <staging-or-branch-ref>`, then `supabase db push`
   (or paste `supabase/migrations/20261019*.sql` in order into the SQL editor).
3. Auth → URL configuration: add `https://rva.guru/clique/auth/callback`.
4. Smoke test: sign in → `/clique/onboarding` → save profile → a Mehspace row exists.
5. HOMIES² import, in the SQL editor on staging: paste `supabase/scripts/import_homies2.sql`, run `select public.clique_import_homies2();`
   (dry run) and check the counts. If a VERIFY column is wrong, adjust and re-run. Then `select public.clique_import_homies2(true);`.
   Then `drop function public.clique_import_homies2(boolean);`.
6. Repeat 2–5 on production. The old `homies_*` tables are left untouched (read-only fallback), and homies2.rva.guru keeps working.
7. Optional: `supabase gen types typescript` → replace `src/lib/clique/types.ts`.
