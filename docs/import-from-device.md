# Import from this device (gang:v1 → Clique)

Before accounts existed, gang kept everything in `localStorage['gang:v1']` (`{ homies: Homie[], spaces: MessSpace[] }`).

**What ships in this PR**
- `src/lib/clique/device-import.ts`: a pure mapper that defensively parses untrusted JSON and caps counts.
  It maps each Homie to `clique_homies` (kind `pet`), each MessSpace to a homie `clique_mehspaces` row, and posts to `clique_posts` (posted as that Homie).
  Likes are dropped because they referenced local homie ids.
- `src/lib/clique/device-import-action.ts`: a server action that runs under the user's own session and RLS (no service role).
  It's idempotent: rows carry `legacy_source='gang:v1'` + `legacy_id`, and re-imports skip existing Homies/posts.
- `/onboarding` → "Import from this device" (shown once a profile exists). It checks this browser's `localStorage` or accepts an uploaded export file.
- `/homies` → "Export my data" downloads the `gang:v1` JSON.

**The origin problem**
`localStorage` is scoped per origin. Data created on `gang-henna-seven.vercel.app` is not visible on `rva.guru/clique`.
So the flow is: open the old site → Homies → **Export my data** → sign in at rva.guru/clique → onboarding → **Upload export file**.
Since gang (with this export button) is deployed at both origins, the button exists wherever the old data lives.
The same pattern can cover `homies` (local store) and `homies3` (`homies20.v1`): add an export button to those apps, plus a mapper.
