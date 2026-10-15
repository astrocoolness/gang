# Connections Spec

**Status:** Not started
**Layer:** 7 — Social Graph
**Depends on:** Homies, Meespace, Dial

## Goal

Mutual links between Homies. Every connection is a shared space. Dial messages route through connections.

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

## Files

- `src/lib/connections/types.ts`
- `src/lib/connections/mutual.ts` — add/remove flow
- `src/lib/connections/routing.ts` — Dial → connection
- `src/app/connections/page.tsx` — list view

## Acceptance Checklist

- [ ] Adding is mutual (both sides see it)
- [ ] Shared space ID created on link
- [ ] Dial can target a connection
- [ ] Connection list renders both Homies
- [ ] Removing breaks the link both ways

## Risks

- Mutual confirmation flow adds UX complexity

## Next Steps

After ship: attention mechanics spec (cross-layer).
