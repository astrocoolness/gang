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
  voice: string;       // clip bank id
  backstory: string;
  interests: string[]; // drives situation engine filtering
  attention: number;   // 0–100, drains on Dial, refills via Meespace care
  messSpaceId: string;
  createdAt: string;
  updatedAt: string;
};
```

## Files to Touch

- `src/types/index.ts` — replace placeholder Homie type with above
- `src/lib/homies.ts` — new: Supabase CRUD for Homies
- `src/components/creator/` — new folder: face picker, voice picker, backstory input, interests tags
- `src/app/homies/page.tsx` — new route rendering the creator

## Untouched

- Existing animation/episode system (extended later by situation engine)
- dot-grok skills folder (reused by Gangland, not modified)

## Acceptance Checklist

- [ ] Homie type matches data model exactly
- [ ] Creator UI renders face, voice, backstory, interests
- [ ] Saving a Homie writes to Supabase `homies` table
- [ ] Loading a Homie reads from Supabase, not localStorage
- [ ] Interests field accepts free text, stored as string array
- [ ] No regressions in existing Homies animation playback

## Risks

- Browser-to-Supabase migration may orphan existing local Homies; add a one-time import prompt
- Attention field is new; default to 100 on create

## Next Steps

After ship: write `meespace-spec.md` using the Meespace data contract below as input.
