# Gangland Zone 1 Spec

**Status:** Not started
**Layer:** 4 — 3D World
**Source:** Homies dot-grok skills (Babylon.js / Three.js / Phaser / ECS)

## Goal

One shared low-poly zone. Walkable avatars. Proximity triggers Dial. Nothing else in v1.

## Scope

- Single ground plane + basic structures from modular blocks
- Avatar controller: walk, turn, jump
- Avatar spawns from Homie face asset
- Proximity radius: standing near another avatar opens Dial
- No combat, no quests, no building tools yet

## Files

- `src/lib/gangland/zone.ts` — zone setup, lighting, ground
- `src/lib/gangland/avatar.ts` — controller + spawn
- `src/lib/gangland/proximity.ts` — distance checks → Dial trigger
- `src/app/gangland/page.tsx` — route

## Acceptance Checklist

- [ ] Zone loads with walkable ground
- [ ] Avatar moves with keyboard
- [ ] Second avatar (NPC or test) spawns
- [ ] Proximity under threshold fires Dial open
- [ ] 32-bit low-poly look holds
- [ ] Runs at 60fps on a mid-range laptop

## Risks

- Babylon vs Three.js choice not finalized — pick one before coding
- Asset loading from dot-grok folder may need path rework

## Next Steps

After ship: home-builder spec.
