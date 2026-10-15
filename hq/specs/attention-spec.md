# Attention Mechanics Spec

**Status:** Not started
**Layer:** Cross-layer
**Depends on:** Homies, Meespace, Dial, Gangland

## Goal

One resource everywhere. Dial calls drain attention. Meespace care refills it. Visible in Gangland. Neglect makes homes run-down.

## Rules

- Dial session costs attention per minute
- Refill: likes, layout edits, comments on that Homie's Meespace
- NPC attention self-regenerates on a schedule
- Player Homie at 0 = muted line, dark home
- Gangland renders attention as glow/companion/decay state

## Files

- `src/lib/attention/drain.ts`
- `src/lib/attention/refill.ts`
- `src/lib/attention/regen.ts` — NPC scheduler
- `src/lib/attention/render.ts` — Gangland visual states

## Acceptance Checklist

- [ ] Dial drain matches outline rates
- [ ] Meespace actions refill correctly
- [ ] NPC regen doesn't exceed cap
- [ ] Zero-attention Homie can't receive Dial
- [ ] Visual state updates in Gangland in real time

## Risks

- Balancing drain vs refill is playtest-only

## Next Steps

System complete at v1. Then: live WebRTC audio upgrade for Dial, home-builder vocabulary expansion, additional Gangland zones.
