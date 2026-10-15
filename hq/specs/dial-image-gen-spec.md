# Dial Image-Gen Spec

**Status:** Queued (starts after Meespace ships)
**Layer:** 3 — Messaging
**Source:** Existing Dial repo, branch `image-gen`

## Goal

Keep the three-dial text rewriter untouched. Add one step: the rewritten text goes to an image model and returns a picture the user sends to a connected Homie.

## Flow

1. User types seed message
2. Dials (Tone, Voice, Cut) rewrite via xAI chat API — unchanged
3. Rewritten text passes to image model
4. Image renders with words inlaid
5. Image is the outgoing message, sent to a connected Homie
6. History stores image URLs

## Files to Touch

- `src/lib/generate.ts` — swap chat completion for image endpoint
- `src/components/composer.tsx` — render `<img>` + download instead of text paragraph
- `src/lib/store.ts` — history items become `{ id, mix, imageUrl }`
- New: `src/lib/image.ts` — image model call wrapper

## Untouched

- Dial programming UI (program-dialog.tsx)
- Auth migrations, PWA support

## Acceptance Checklist

- [ ] Rewrite step still produces identical text output
- [ ] Image step receives rewritten text only
- [ ] Composer shows image, not text
- [ ] Download button works
- [ ] History cards show thumbnails
- [ ] Error handling covers image API failures

## Risks

- Image API latency; add loading state
- Cost per image; consider caching identical rewrites

## Next Steps

After ship: write `gangland-zone1-spec.md`.
