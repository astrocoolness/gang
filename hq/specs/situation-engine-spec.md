# Situation Engine Spec

**Status:** Not started
**Layer:** 5 — Daily Scenes
**Depends on:** Homies (interests), Meespace (profile state), radio DBs, event sources

## Goal

Once per day per Homie, generate a scene from live data filtered through that character's interests. Output feeds Homies' animation pipeline.

## Sources

- WUSB / WRIR / WPKN track logs (new + old / nostalgic)
- News headlines
- On-this-day events
- Local Richmond events (concerts, releases)
- Informal discovery (random from any source)

## Scenario Seeds

Music (new/old), books (new/old), news, on-this-day, discovery, bad day + messy room, cooking (new/old recipe), trip planning (hike/vacation/concert).

## Files

- `src/lib/situation/sources.ts` — data fetchers
- `src/lib/situation/seeds.ts` — scenario pool
- `src/lib/situation/filter.ts` — interests → source weighting
- `src/lib/situation/scheduler.ts` — daily cron
- `src/lib/situation/animate.ts` — handoff to Homies episode system

## Acceptance Checklist

- [ ] Scheduler fires once per Homie per day
- [ ] At least three distinct sources return data
- [ ] Interests change which source wins
- [ ] Scene output triggers an animation
- [ ] Logs land in situation_logs table
- [ ] No user input required

## Risks

- External APIs may be down; need fallback seeds
- Cron on Vercel needs a workaround (use Supabase edge function or external ping)

## Next Steps

After ship: npc-generator spec.
