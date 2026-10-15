# Situation Engine Spec

**Status:** Queued (starts after Home Builder ships)
**Layer:** 5 — Daily Scenes

## Goal

Once per day per Homie, generate a scene from live data filtered through that Homie's interests. Output feeds Homies' animation pipeline.

## Data Sources

- WUSB/WRIR/WPKN track logs
- News headlines
- On-this-day events
- Local Richmond events (concerts, releases)

## Scenario Seeds

New/old music, new/old books, news, on-this-day, informal discovery, bad day + messy room, cooking, trip planning.

## Files to Touch

- `src/lib/situation-engine/` — scheduler, source fetchers, seed picker, scene composer
- Supabase table: `situation_logs`

## Untouched

- Homies animation core (consumes output only)
- All other layers

## Acceptance Checklist

- [ ] Scheduler fires once per Homie per day
- [ ] At least 2 live sources return data
- [ ] Interests filter source selection
- [ ] Scene output is valid animation input
- [ ] Logs land in situation_logs

## Risks

- Source APIs may be flaky; graceful fallback to seed-only scenes
- Daily volume could spike costs

## Next Steps

After ship: write `npc-generator-spec.md`.
