# NPC Generator Spec

**Status:** Queued (starts after Situation Engine ships)
**Layer:** 6 — NPC Population

## Goal

Generate NPCs in two modes — Custom (user picks from pools) and Random (rolls everything) — from one shared system. User-curated influencing-concepts database biases the pools.

## Data Model

```ts
type NPC = {
  id: string;
  name: string;
  face: string;
  voice: string;
  backstory: string;
  interests: string[];
  mode: 'custom' | 'random';
  attention: number;
  selfRegenRate: number;
  messSpaceId: string;
  conceptIds: string[]; // links to influencing-concepts DB
  createdAt: string;
};
```

## Files to Touch

- `src/lib/npc/` — pools, roller, custom builder, concept DB client
- Supabase tables: `npcs`, `concept_db`
- `src/components/npc-creator/` — custom mode UI

## Untouched

- Player Homies
- Gangland spawn logic (consumes NPCs)

## Acceptance Checklist

- [ ] Custom mode lets user pick each field from pools
- [ ] Random mode rolls all fields
- [ ] Concept DB influences roll weights
- [ ] NPCs get self-regenerating attention
- [ ] Generated NPCs appear in Gangland

## Risks

- Concept DB starts empty; seed it with 20-30 entries
- Over-reliance on LLM flavor text; keep pools primary

## Next Steps

After ship: write `connections-spec.md`.
