# Meespace Spec

**Status:** Queued (starts after Homies ships)
**Layer:** 2 — Public Profiles
**Source:** Existing Flyspace repo

## Goal

Rename Flyspace to Meespace, rebrand, and reshape its profile JSON so Dial and Gangland can consume it.

## Data Model

```ts
type MessSpace = {
  id: string;
  homieId: string;
  posts: { id: string; text: string; createdAt: string }[];
  layout: object;   // maps to 3D home rooms in Gangland
  theme: string;
  mood: string;
  music: string | null;
  updatedAt: string;
};
```

## Files to Touch

- Flyspace repo: rename + rebrand (separate PR)
- `src/types/index.ts` — add MessSpace type
- `src/lib/meespace.ts` — new: Supabase CRUD
- `src/app/meespace/[id]/page.tsx` — public profile route

## Untouched

- Dial repo (Layer 3)
- Gangland assets

## Acceptance Checklist

- [ ] Repo renamed to meespace
- [ ] Branding swapped (Flyspace → Meespace)
- [ ] Profile JSON matches data model
- [ ] Posts, layout, theme, mood, music all persist to Supabase
- [ ] Public route renders a profile from an id
- [ ] Layout JSON is valid input for the home builder (Layer 4)

## Risks

- Flyspace is a single HTML file; modularizing it is the real work
- Neglect rendering (run-down state) is visual-only in v1

## Next Steps

After ship: write `dial-image-gen-spec.md`.
