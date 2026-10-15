# Homies Spec

**Status:** Not started
**Layer:** 1 — Character Creation
**Source:** Existing Homies repo

## Goal

Fork Homies into GANG as the character-creation front door. Migrate browser-only persistence to Supabase so every Homie is readable by Meespace, Dial, Gangland, and the situation engine.

## Data Model

```ts
type Homie = {
  id: string;
  name: string;
  face: string;        // asset key from dot-grok library
  voice: string;       // clip bank key
  backstory: string;
  interests: string[]; // drives situation engine filtering
  attention: number;   // 0–100, drains on Dial, refills via Meespace care
  messSpaceId: string;
  createdAt: string;
};
```

## Files

- `src/lib/homies/types.ts` — Homie type (already partially in src/types)
- `src/lib/homies/creator.ts` — face/voice/backstory/interests UI logic
- `src/lib/homies/migrate.ts` — browser-storage → Supabase migration
- `src/app/homies/page.tsx` — creator route
- `supabase/migrations/001_homies.sql` — table + RLS

## Acceptance Checklist

- [ ] Homie type matches outline exactly
- [ ] Creator saves all five fields to Supabase
- [ ] Browser-storage Homies migrate without data loss
- [ ] Interests array is non-empty on create
- [ ] Attention defaults to 100
- [ ] Existing Tony/Betty/Nori characters survive migration
- [ ] No changes to Homies' animation or episode code

## Risks

- Browser-to-Supabase migration may hit ID collisions with seeded NPCs
- Dot-grok skill docs are heavy; keep them out of AI context during this pass

## Next Steps

After ship: Meespace spec (rename Flyspace, reshape JSON contract).
