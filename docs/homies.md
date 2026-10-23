# Homies in Clique

The Homies section (`/clique/homies`) now runs on the `clique_` tables. If the Supabase env vars aren't set, or you're signed out, it falls back to the original on-device (`gang:v1`) Homies.

## Kinds
- **avatar**: the Homie that is you. You get one; it becomes `clique_profiles.avatar_homie_id`.
- **pet**: a Homie you raise. Pick Tony, Betty, Nori, or your own custom one, then a starting age.
- **friend_page**: a page you make for a friend. On the page, click **Generate claim code** (valid 14 days; the server stores only a hash) and send it to them.
  - They open `/clique/claim/<code>` or `/clique/homies/claim`.
  - Claiming makes the page editable by them, and the two of you become friends.

## Pet engine
- `src/lib/homies/engine/*` is ported unchanged from the homies repo's `src/game/*` (source commit b55a357).
- `src/lib/homies/sim.ts` adapts it to Clique.
- Pacing: 6 game minutes per real minute. A game day is 4 real hours, and baby→kid takes about 80 real minutes.
- Custom homies use the built-in portrait art (`mint.ts` is template-only). The homies repo's AI minting was not ported.

## Care model (event-sourced)
- The pet's engine save is kept in `clique_homies.profile.sim`. Mirror columns (`stage`, `mood`, `stats`) exist for lists.
- Every care action is a row in `clique_homie_events` (`type='care'`, `payload {action, food?}`).
- On view, the server replays new care events in (created_at, id) order on top of the snapshot, then advances to now.
- Anyone who can see the pet sees the same projection. Only editors (owner or claimant) write it back, using an optimistic lock on `updated_at`.
- When the projection crosses a life stage, an `evolve` event is written, and that event creates Home activity.
- Friends can care without UPDATE rights on `clique_homies`. Stats are never computed by the client.

## Guard rails (`20261023000100_clique_homie_care.sql`)
- **Care payloads:** `clique_guard_homie_event` validates them.
  - Non-editors can only feed, play, clean, or talk.
  - Each actor gets one care action per homie every 10 minutes.
- **Evolve:** must name a valid stage.
- **Home activity:** friend care creates `homie_cared` activity.
  - At most one per carer, per homie, per day.
  - Visible only to the carer and the owner (`private`, target = owner).
- **Known limitation:** owners can still edit their own pet's stats directly through RLS, which is a single-player cheat only.

## Influences
- The library lives at `/clique/homies/library`. Influences are private by default.
- Attach them to a Homie from its page. RLS only lets you attach to Homies you can edit.

## Applying
Apply `20261023000100_clique_homie_care.sql` after the Phase 2 migrations. Follow the process in `docs/clique-schema.md`: staging first, after review. `npm run db:validate` runs every migration, including this one, against an in-memory PGlite.
