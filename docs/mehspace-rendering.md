# Mehspace custom HTML/CSS: storage and sanitized-render plan

Decision: full MySpace-style custom HTML/CSS, sanitized and rendered in isolation.

**Storage (implemented in the 0400 migration)**
- `custom_html` (≤100 KB) and `custom_css` (≤50 KB) are stored exactly as the user wrote them. They are **never rendered directly**.
- `rendered_html`, `rendered_css`, `render_status` (`pending|ok|rejected`), `sanitizer_version`, `sanitized_at` can only be written in a trusted
  context (service role / security-definer). A trigger resets them to `NULL`/`pending` whenever the raw fields change, and ignores
  client writes to them.

**Sanitize step (Phase 4)**
1. Server action / route handler (service role, server-only) runs after a save, or a queue/cron picks up `render_status = 'pending'`.
2. HTML: `sanitize-html` (or DOMPurify + jsdom) with an allowlist. Allowed: structural/text tags, `img`, `a`, `marquee`, tables, `style` attrs.
   Stripped: `script`, `iframe`, `object`, `embed`, `form`, `input`, `meta`, `base`, `link`, all `on*` attributes, and `javascript:`/`data:` URLs (except
   `data:image/*`). `a` gets `rel="noopener nofollow ugc" target="_blank"`.
3. CSS: parse with `postcss`. Drop `@import`, `expression()`, `behavior`, `-moz-binding`, and `url()` that isn't `https:` or `data:image/*`.
   Scope all selectors under `.mehspace-root`, and cap `position: fixed` / huge `z-index`.
4. Write `rendered_*`, `render_status='ok'` (or `rejected` + reason in `layout_json.render_error`), `sanitizer_version`.

**Render (isolation)**
- Show `rendered_html/css` only inside `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc=…>`.
  No `allow-scripts`, no `allow-same-origin`, so the content can't run JS, can't read Clique cookies, and can't touch the parent DOM.
- In srcdoc: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https:; media-src https:">`.
- Later hardening: serve from a separate origin (e.g. `mehspace-usercontent.rva.guru`) instead of srcdoc.
- The rest of the Mehspace (Top 8, song, posts, blurbs) renders as normal React from structured fields.
