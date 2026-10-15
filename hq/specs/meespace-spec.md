# Meespace Spec

**Status:** Not started
**Layer:** 2 — Public Profiles
**Source:** Existing Flyspace repo (single HTML file)

## Goal

Rebrand Flyspace as Meespace and reshape its profile JSON so Dial and Gangland can read it. Keep the MySpace DNA — posts, Top 8, mood, glitter, autoplay music — but make the data contract explicit.

## Data Model

```ts
type MessSpace = {
  id: string;
  homieId: string;
  posts: { id: string; text: string; createdAt: string }[];
  layout: LayoutNode[];   // maps to 3D home rooms later
  theme: string;
  mood: string;
  music: string | null;  // track reference from radio DBs
  lastActiveAt: string;  // drives neglect rendering
};

type LayoutNode = {
  type: "room" | "item" | "sign";
  name: string;
  children?: LayoutNode[];
};
```

## Files

- Rename repo flyspace → meespace (GitHub settings, no code change)
- `src/lib/meespace/types.ts` — MessSpace + LayoutNode
- `src/lib/meespace/profile.ts` — CRUD against Supabase
- `src/app/meespace/[id]/page.tsx` — public profile route
- Port Flyspace HTML sections into React components one at a time

## Acceptance Checklist

- [ ] Repo renamed, branding swapped to Meespace
- [ ] Profile JSON matches the contract above
- [ ] Posts, theme, mood, music all persist
- [ ] LayoutNode tree renders in a simple 2D preview
- [ ] lastActiveAt updates on any edit
- [ ] Dial can fetch a Meespace by homieId

## Risks

- Single-file Flyspace has no component boundaries; porting risks breaking glitter/autoplay
- Neglect rendering (run-down state) is visual-only in v1 — no gameplay effect yet

## Next Steps

After ship: Dial image-gen spec (branch already exists).
