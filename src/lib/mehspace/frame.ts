/**
 * Builds the srcdoc document for a sanitized Mehspace. Rendered ONLY by <MehspaceFrame>, whose iframe
 * has sandbox="allow-popups allow-popups-to-escape-sandbox" (no allow-scripts, no allow-same-origin):
 * content can't run JS, read Clique cookies/storage, or touch the parent page.
 */
import { ROOT_CLASS } from './sanitize';

export const FRAME_CSP = [
  "default-src 'none'",
  'img-src https: data:',
  "style-src 'unsafe-inline'",
  'font-src https:',
  'media-src https:',
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "script-src 'none'",
  "object-src 'none'",
].join('; ');

export const FRAME_SANDBOX = 'allow-popups allow-popups-to-escape-sandbox';

const BASE_CSS = `*{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent}
body{font-family:Verdana,Arial,sans-serif;color:var(--ink,#eee);font-size:14px;line-height:1.45;overflow-wrap:anywhere}
.${ROOT_CLASS}{min-height:100%;padding:12px}
.${ROOT_CLASS} img,.${ROOT_CLASS} video{max-width:100%;height:auto}
.${ROOT_CLASS} a{color:var(--accent,#7ec8ff)}`;

/** rendered_html / rendered_css must already be sanitized output; this only wraps them. */
export function frameDocument(renderedHtml: string, renderedCss: string, vars: { ink: string; accent: string }) {
  // Belt and braces: the sanitizer already escapes "<" in CSS; never let it close our <style>.
  const css = renderedCss.replace(/</g, '\\3c ');
  const v = `:root{--ink:${safeColor(vars.ink)};--accent:${safeColor(vars.accent)}}`;
  return `<!doctype html><html><head><meta charset="utf-8">`
    + `<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">`
    + `<meta name="referrer" content="no-referrer">`
    + `<style>${v}\n${BASE_CSS}\n${css}</style></head>`
    + `<body><div class="${ROOT_CLASS}">${renderedHtml}</div></body></html>`;
}

function safeColor(c: string) {
  return /^#[0-9a-f]{3,8}$/i.test(c) ? c : '#eeeeee';
}
