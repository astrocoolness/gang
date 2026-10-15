# Gangland Zone 1 Spec

**Status:** Queued (starts after Dial image-gen ships)
**Layer:** 4 — 3D World
**Source:** Homies dot-grok skills (Babylon/Three.js/Phaser/ECS)

## Goal

One shared low-poly zone. Walkable avatars. Proximity-based Dial trigger.

## Scope (v1)

- Single zone, no quests, no combat
- Avatars from Homies face assets
- Walk controls (keyboard)
- Standing near another Homie opens Dial
- NPC avatars populate the zone

## Files to Touch

- `src/components/gangland/` — new folder: scene, avatar, controls
- `src/lib/gangland.ts` — zone config, spawn logic
- `src/app/gangland/page.tsx` — route

## Untouched

- Home builder (separate spec)
- All other layers

## Acceptance Checklist

- [ ] Zone loads in browser
- [ ] Avatar walks with keyboard input
- [ ] Proximity to another avatar triggers Dial UI
- [ ] At least 3 NPC avatars visible
- [ ] 60fps on a mid-range laptop

## Risks

- Performance with many avatars; cap at 20 in v1
- Asset reuse from Homies may need format conversion

## Next Steps

After ship: write `home-builder-spec.md`.
