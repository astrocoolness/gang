# NPC Generator Spec

**Status:** Not started
**Layer:** 6 — NPC Population
**Depends on:** Homies types, influencing-concepts database (user-built)

## Goal

Generate NPCs in two modes from identical pools: Custom (user picks) and Random (full roll). User's concept database biases weights.

## Pools

- Name, appearance, voice, backstory, interests
- Concepts from user DB add weighted flavor

## Files

- `src/lib/npc/pools.ts`
- `src/lib/npc/generator.ts` — custom + random modes
- `src/lib/npc/concepts.ts` — loads user concept DB
- `src/app/npc/page.tsx` — creation UI

## Acceptance Checklist

- [ ] Custom mode lets user set every field
- [ ] Random mode rolls all fields
- [ ] Same pools used in both modes
- [ ] Concept DB weights affect output
- [ ] Generated NPC saves to Supabase with always-on attention regen
- [ ] NPCs appear in Gangland

## Risks

- Concept DB format not defined yet — user to specify
- Random mode may produce incoherent combos; light LLM pass optional

## Next Steps

After ship: connections spec.
