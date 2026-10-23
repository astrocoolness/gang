# Mehspace custom HTML/CSS: storage, sanitizing and rendering

Decision: full MySpace-style custom HTML/CSS, sanitized on the server and rendered in isolation.
Implemented in Phase 4. Defense in depth: allowlist sanitizer → sandboxed iframe (no scripts, opaque
origin) → strict CSP inside the frame → `<` escaped in CSS so nothing can close the `<style>`.

## Storage (migration 0400, tightened in 20261023000200)
- `custom_html` (≤100 KB) and `custom_css` (≤50 KB) are stored exactly as written and are **never rendered directly**.
- `rendered_html`, `rendered_css`, `render_status` (`pending|ok|rejected`), `sanitizer_version`, `sanitized_at` and
  `layout_json.render_error` can only be written by a trusted writer (service role / security definer). A trigger
  resets them to `NULL`/`pending` whenever the raw fields change and ignores client writes to them.

## The trusted sanitize step (`src/lib/clique/mehspace.ts` → `saveCustom` / `trustedRender`)
1. The editor's server action updates `custom_html/css` **as the user** through RLS. This is what proves edit rights.
2. A server-only admin client (`src/lib/supabase/admin.ts`, `SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`) re-reads
   the row, runs `renderMehspace()` and writes `rendered_*`, `render_status`, `sanitizer_version`, `sanitized_at` and
   `layout_json.render_error`, guarded by `updated_at` so a concurrent edit is never overwritten by stale output.
3. Without the service key, saves still work and the page shows "waiting to publish" (`pending`). Editors can retry
   ("Try publishing again"), which also re-sanitizes after a sanitizer upgrade (`sanitizer_version`).
4. The editor's **Preview** runs the same sanitizer in a server action and shows the result in the same sandboxed frame. Nothing is stored.

## Sanitizer (`src/lib/mehspace/sanitize.ts`, version `mehspace-1`, tests in `__tests__/sanitize.test.ts`)
- HTML (`sanitize-html`): tag allowlist (text/structure, tables, `img`, `a`, `font`, `center`, `marquee`, `blink`,
  `details/summary`, `audio/video/source`). Everything else is dropped, and the contents of `script`, `style`, `iframe`,
  `object`, `embed`, `template`, `svg`, `math`, `noscript`, `xmp` and similar are dropped too. All `on*` attributes are
  removed. Per-tag attribute allowlist. `href/src/poster` must be `https:` (`mailto:` for links, `data:image/png|jpeg|gif|webp;base64`
  for images); no protocol-relative URLs; control characters are stripped before the scheme check (`jav&#9;ascript:`).
  Links are forced to `target="_blank" rel="noopener noreferrer nofollow ugc"`. Inline `style` goes through the CSS rules below.
- CSS (`postcss`): parse errors reject the whole sheet (with a reason). Allowed at-rules: `@media`, `@supports`,
  `@keyframes`, `@font-face` (with `src`). `@import`, `@charset`, `@namespace` and the rest are dropped. Declarations are dropped if they use
  `expression()`, `javascript:`/`vbscript:`, `behavior`, `-moz-binding`, backslash escapes, `<`/`>`, `image-set("…")` or any
  `url()` that isn't https/data-image. `position: fixed` becomes `absolute`; `z-index` is capped at ±1000. Every selector is
  scoped under `.mehspace-root` (`html`, `body` and `:root` map to the root).
- Size caps: 100 KB HTML / 50 KB CSS (also enforced by the DB).

## Render (`src/lib/mehspace/frame.ts`, `src/components/mehspace/MehspaceFrame.tsx`)
- `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc=… referrerpolicy="no-referrer">`. There is no
  `allow-scripts`, `allow-same-origin`, `allow-forms` or `allow-top-navigation`, so the content can't run JS, can't read
  Clique cookies or storage, can't touch the parent DOM and can't navigate Clique. Links open in a new tab.
- The srcdoc carries `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:;
  style-src 'unsafe-inline'; font-src https:; media-src https:; form-action 'none'; base-uri 'none'; frame-src 'none';
  child-src 'none'; script-src 'none'; object-src 'none'">` and `<meta name="referrer" content="no-referrer">`.
- The frame height is fixed (`layout_json.frame_height`, 200–3000 px, default 600), so a page can't resize or overlay Clique.
- Everything else on the page (header, mood, song, photo, Top 8, posts, likes, blurbs) is normal React from structured fields,
  themed with a preset (`src/lib/mehspace/themes.ts`). The editor offers starter templates, and each template passes the sanitizer (tested).

## Known tradeoffs and later hardening
- External `https:` images and fonts are allowed (MySpace pages need them). That means the image host can see the viewer's IP
  (a tracking pixel), but no referrer and no cookies, because the frame has an opaque origin. Later: proxy images through an image service.
- Later: serve user content from a separate origin (e.g. `mehspace-usercontent.rva.guru`) instead of srcdoc.

## Social rules (20261023000200)
- Top 8 holds only real friends (user pages), friends or the owner/claimant (Homie pages) or members (Circle pages): distinct, max 8.
- Song/photo uploads live in `clique-media/{uid}/mehspace/…`; post images (≤4, images only) live in `clique-media/{uid}/posts/…`.
  Viewers get 1-hour signed URLs created as themselves, so storage RLS (`clique_can_see_user`) applies.
- A user's Mehspace can't be more public than their profile privacy. Tightening the profile tightens the page.
- Blurbs are friend-made: friends of the page's person (members for Circles), never the page's own editors.
- Mood changes, posts and blurbs flow to Home with the least visibility of the page and the actor. Mood is deduplicated to one row per 6 hours.

## Routes
`/mehspace` (index; device Homies when Supabase isn't configured) · `/mehspace/{username}` · `/mehspace/homie/{id}` ·
`/mehspace/circle/{slug}` · `/mehspace/s/{spaceId}` (stable link → canonical) · `/mehspace/edit` (mine) · `/mehspace/edit/{spaceId}` ·
`/mehspace/device` and `/mehspace/{local-uuid}` (gang:v1, this device only). Usernames that collide with static
segments (`edit`, `device`, `homie`, `circle`) are shadowed by those routes. Onboarding now rejects them; an existing account
with one of those usernames would need renaming. (`s` is too short to be a username.)
