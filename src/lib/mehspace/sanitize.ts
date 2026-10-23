/**
 * Trusted Mehspace sanitizer: turns a user's raw custom_html / custom_css into rendered_html /
 * rendered_css. Pure and dependency-light so it can be unit-tested (npm run test:mehspace).
 *
 * Defense in depth: output is ALSO rendered only inside a sandboxed iframe (no allow-scripts,
 * no allow-same-origin) with a strict CSP (see frame.ts). The sanitizer is the first wall, not the only one.
 */
import sanitizeHtml from 'sanitize-html';
import postcss, { type AtRule, type ChildNode, type Declaration, type Root, type Rule } from 'postcss';

export const SANITIZER_VERSION = 'mehspace-1';
export const MAX_HTML = 100_000;
export const MAX_CSS = 50_000;
export const ROOT_CLASS = 'mehspace-root';

const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

/** https: only (http upgraded is NOT done: mixed content would be blocked anyway). */
export function safeUrl(raw: string, opts: { allowDataImage?: boolean; allowMailto?: boolean } = {}): string | null {
  // Strip whitespace/control chars browsers ignore inside schemes (e.g. "jav\tascript:").
  const v = raw.replace(/[\u0000-\u001f\u007f-\u009f]+/g, '').trim();
  if (!v) return null;
  if (opts.allowDataImage && SAFE_DATA_IMAGE.test(v)) return v;
  if (opts.allowMailto && /^mailto:[^<>"'\s]+$/i.test(v)) return v;
  if (/^#[\w-]*$/.test(v)) return v; // same-document anchors
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
const BLOCKED_PROPS = /^(behavior|-moz-binding|-ms-behavior|binding)$/i;
const BLOCKED_VALUE = /(expression\s*\(|javascript:|vbscript:|livescript:|-moz-binding|behavior\s*:|@import|<\/?\s*style)/i;
const ALLOWED_AT = new Set(['media', 'keyframes', '-webkit-keyframes', 'font-face', 'supports']);
const MAX_Z = 1000;

/** Sanitize a declaration in place. Returns false if it must be dropped. */
function cleanDecl(d: Declaration): boolean {
  const prop = d.prop.trim().toLowerCase();
  if (!/^-?[a-z][a-z0-9-]*$/.test(prop) && !/^--[a-z0-9-]+$/i.test(prop)) return false;
  if (BLOCKED_PROPS.test(prop)) return false;
  const value = d.value;
  // Backslash escapes are how filters get dodged (\6a avascript:, \75 rl). No legit need here.
  if (value.includes('\\') || /[<>]/.test(value)) return false;
  if (BLOCKED_VALUE.test(value)) return false;
  // Every url(...) must be https: or a raster data: image, quoted or bare. Unterminated url( is dropped.
  let bad = false;
  let seen = 0;
  const rest = value.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (_m, _q, u: string) => {
    seen++;
    if (!safeUrl(u, { allowDataImage: true }) || u.startsWith('#')) bad = true;
    return 'url()';
  });
  if (bad || (value.match(/url\s*\(/gi)?.length ?? 0) !== seen) return false;
  // image-set("a.png" 1x) takes bare strings as URLs: only allow it with url() entries.
  if (/image-set\s*\(/i.test(rest) && /["']/.test(rest)) return false;
  if (prop === 'position' && /\bfixed\b/i.test(value)) d.value = 'absolute';
  if (prop === 'z-index') {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return value.trim() === 'auto';
    d.value = String(Math.max(-MAX_Z, Math.min(MAX_Z, n)));
  }
  d.prop = prop;
  return true;
}

function scopeSelector(sel: string): string {
  const s = sel.trim();
  if (!s) return s;
  const rootish = /^(:root|html|body)(?![\w-])/i;
  if (rootish.test(s)) {
    // "html body .x" / "body > p" / ":root"
    const rest = s.replace(/^((:root|html|body)(?![\w-])\s*)+/i, '').trim();
    return rest ? `.${ROOT_CLASS} ${rest.replace(/^>\s*/, '> ')}` : `.${ROOT_CLASS}`;
  }
  if (s.startsWith(`.${ROOT_CLASS}`)) return s;
  return `.${ROOT_CLASS} ${s}`;
}

function walk(container: Root | AtRule, inKeyframes: boolean) {
  container.each((node: ChildNode) => {
    if (node.type === 'comment') { node.remove(); return; }
    if (node.type === 'atrule') {
      const name = node.name.toLowerCase();
      if (!ALLOWED_AT.has(name)) { node.remove(); return; }
      if (/[<>\\]|url\s*\(|expression/i.test(node.params)) { node.remove(); return; }
      if (name === 'font-face') {
        node.each((c) => { if (c.type !== 'decl' || !cleanDecl(c)) c.remove(); });
        if (!node.nodes?.some((c) => c.type === 'decl' && c.prop === 'src')) node.remove();
        return;
      }
      walk(node, name.endsWith('keyframes'));
      return;
    }
    if (node.type === 'rule') {
      const rule = node as Rule;
      if (/[<\\]/.test(rule.selector)) { rule.remove(); return; }
      if (!inKeyframes) rule.selectors = rule.selectors.map(scopeSelector).filter(Boolean);
      rule.each((c) => {
        if (c.type !== 'decl' || !cleanDecl(c)) c.remove();
      });
      if (!rule.nodes.length) rule.remove();
      return;
    }
    if (node.type === 'decl') node.remove(); // top-level stray declarations
  });
}

export interface CssResult { css: string; error?: string }

export function sanitizeCss(raw: string): CssResult {
  if (!raw.trim()) return { css: '' };
  if (raw.length > MAX_CSS) return { css: '', error: `CSS is over ${MAX_CSS / 1000} KB.` };
  let root: Root;
  try {
    root = postcss.parse(raw);
  } catch (e) {
    return { css: '', error: `CSS didn't parse: ${(e as Error).message.split('\n')[0].slice(0, 160)}` };
  }
  walk(root, false);
  // Final belt-and-braces: nothing in the stylesheet may close the <style> element.
  const css = root.toString().replace(/</g, '\\3c ').trim();
  return { css };
}

/** Inline style="" attributes: declarations only, same rules as stylesheets. */
export function sanitizeInlineStyle(raw: string): string {
  if (!raw || raw.length > 2000) return '';
  let root: Root;
  try {
    root = postcss.parse(`x{${raw}}`);
  } catch {
    return '';
  }
  const rule = root.first;
  if (!rule || rule.type !== 'rule' || root.nodes.length !== 1) return '';
  const out: string[] = [];
  rule.each((c) => {
    if (c.type === 'decl' && cleanDecl(c)) out.push(`${c.prop}: ${c.value}${c.important ? ' !important' : ''}`);
  });
  return out.join('; ').replace(/</g, '');
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------
const TAGS = [
  'div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'b', 'i', 'u', 's', 'strike', 'strong', 'em',
  'small', 'big', 'sub', 'sup', 'center', 'font', 'blockquote', 'pre', 'code', 'kbd', 'mark', 'abbr', 'cite', 'q',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'img', 'a', 'marquee', 'blink', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'main', 'figure',
  'figcaption', 'details', 'summary', 'audio', 'video', 'source', 'wbr',
];
const COMMON = ['class', 'id', 'title', 'style', 'align', 'dir', 'lang'];
const ATTRS: Record<string, string[]> = {
  '*': COMMON,
  a: ['href', 'name', 'rel', 'target'],
  img: ['src', 'alt', 'width', 'height'],
  font: ['color', 'size', 'face'],
  table: ['border', 'cellpadding', 'cellspacing', 'width', 'bgcolor'],
  td: ['colspan', 'rowspan', 'width', 'height', 'valign', 'bgcolor'],
  th: ['colspan', 'rowspan', 'width', 'height', 'valign', 'bgcolor'],
  tr: ['valign', 'bgcolor'],
  col: ['span', 'width'],
  marquee: ['direction', 'behavior', 'scrollamount', 'scrolldelay', 'loop', 'width', 'height', 'bgcolor'],
  audio: ['src', 'controls', 'loop'],
  video: ['src', 'controls', 'loop', 'width', 'height', 'poster', 'muted'],
  source: ['src', 'type'],
  details: ['open'],
};

function cleanClassOrId(v: string) {
  return v.split(/\s+/).filter((t) => /^[A-Za-z_][\w-]{0,63}$/.test(t)).slice(0, 20).join(' ');
}

export interface HtmlResult { html: string; error?: string }

export function sanitizeMehspaceHtml(raw: string): HtmlResult {
  if (!raw.trim()) return { html: '' };
  if (raw.length > MAX_HTML) return { html: '', error: `HTML is over ${MAX_HTML / 1000} KB.` };
  const html = sanitizeHtml(raw, {
    allowedTags: TAGS,
    allowedAttributes: ATTRS,
    // We validate URLs ourselves in transformTags; keep sanitize-html's scheme check as a second gate.
    allowedSchemes: ['https', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'data'] },
    allowedSchemesAppliedToAttributes: ['href', 'src', 'poster', 'cite'],
    allowProtocolRelative: false,
    parseStyleAttributes: false,
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'title', 'iframe', 'object', 'embed', 'template', 'xmp', 'noembed', 'noframes', 'svg', 'math'],
    enforceHtmlBoundary: false,
    transformTags: {
      '*': (tagName, attribs) => {
        const a: Record<string, string> = {};
        for (const [k, v] of Object.entries(attribs)) {
          const key = k.toLowerCase();
          if (key.startsWith('on') || key === 'rel' || key === 'target') continue;
          if (key === 'style') { const s = sanitizeInlineStyle(v); if (s) a.style = s; continue; }
          if (key === 'class' || key === 'id' || key === 'name') { const c = cleanClassOrId(v); if (c) a[key] = c; continue; }
          if (key === 'href') { const u = safeUrl(v, { allowMailto: true }); if (u) a.href = u; continue; }
          if (key === 'src' || key === 'poster') {
            const u = safeUrl(v, { allowDataImage: tagName === 'img' || key === 'poster' });
            if (u && !u.startsWith('#')) a[key] = u;
            continue;
          }
          if (key === 'bgcolor' || key === 'color') { if (/^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(v.trim())) a[key] = v.trim(); continue; }
          if (/^(width|height|border|cellpadding|cellspacing|colspan|rowspan|span|size|scrollamount|scrolldelay|loop)$/.test(key)) {
            if (/^-?\d{1,4}%?$/.test(v.trim())) a[key] = v.trim();
            continue;
          }
          a[key] = v;
        }
        if (tagName === 'a' && a.href && !a.href.startsWith('#')) {
          a.rel = 'noopener noreferrer nofollow ugc';
          a.target = '_blank';
        }
        return { tagName, attribs: a };
      },
    },
  });
  return { html };
}

export interface RenderResult {
  status: 'ok' | 'rejected';
  html: string;
  css: string;
  error?: string;
}

/** The whole trusted step. Rejected = too big / unparseable; the page then shows only structured fields. */
export function renderMehspace(customHtml: string, customCss: string): RenderResult {
  const h = sanitizeMehspaceHtml(customHtml);
  const c = sanitizeCss(customCss);
  const error = h.error ?? c.error;
  if (error) return { status: 'rejected', html: '', css: '', error };
  return { status: 'ok', html: h.html, css: c.css };
}
