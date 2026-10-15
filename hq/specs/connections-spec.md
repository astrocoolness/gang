# Connections Spec

**Status:** Queued (starts after NPC Generator ships)
**Layer:** 7 — Social Graph

## Goal

Mutual add flow between Homies. Every connection is a two-person shared space. Connection list in the central app.

## Data Model

```ts
type Connection = {
  id: string;
  homieA: string;
  homieB: string;
  sharedSpaceId: string;
  createdAt: string;
};
```

## Files to Touch

- `src/lib/connections.ts` — mutual add, list, shared space
- `src/app/connections/page.tsx` — list view
- Supabase table: `connections`

## Untouched

- Dial send flow (consumes connections)
- Gangland (proximity uses connections)

## Acceptance Checklist

- [ ] Adding a Homie requires mutual confirmation
- [ ] Connection creates a shared space record
- [ ] Connection list renders all mutual links
- [ ] Dial can only send to connected Homies
- [ ] Removing a connection cleans up shared space

## Risks

- Mutual confirmation flow needs clear UX
- Shared space schema may need expansion later

## Next Steps

After ship: full system integration pass across all layers.
