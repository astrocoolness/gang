# Dial Image-Gen Spec

**Status:** Not started
**Layer:** 3 — Messaging
**Source:** Existing Dial repo, branch `image-gen`

## Goal

Keep the three-dial text rewriter untouched. Add one step after rewrite: pass the rewritten text to an image model and display the resulting picture as the outgoing message.

## Flow

1. User types seed, sets Tone/Voice/Cut stops (unchanged)
2. `generateMessage` calls xAI chat API → rewritten text (unchanged)
3. **New:** rewritten text calls an image endpoint (xAI image model or chosen provider)
4. Composer shows `<img>` with download button instead of a text paragraph
5. History stores image URLs
6. Sent image attaches to a GANG connection (wired later in connections spec)

## Files

- `src/lib/generate.ts` — add image call after text rewrite
- `src/lib/image.ts` — image model client, prompt composition
- `src/components/composer.tsx` — swap result rendering to image
- `src/lib/store.ts` — result type becomes `{ text, imageUrl }`

## Acceptance Checklist

- [ ] Text rewrite still works identically
- [ ] Image generates from rewritten text alone
- [ ] No templates or dial-to-style mapping in v1
- [ ] Composer renders image with download
- [ ] History cards show thumbnails
- [ ] Errors surface cleanly if image model is down

## Risks

- Image model latency may make the send feel slow; consider async generation
- Cost per image vs free text rewrite — may need rate limits

## Next Steps

After ship: Gangland zone 1 spec.
