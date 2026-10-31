// Real-browser (Chromium) sanitizer verification. Needs Playwright:  npm i --no-save playwright && npx playwright install chromium
// Run:  node tests/browser/run.mjs        Optional env: MUTATE=<name> loads a deliberately weakened sanitizer (mutation testing).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, extname, resolve } from 'node:path';
import { PAYLOADS, GOOD } from './payloads.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require(join(process.env.PLAYWRIGHT_NODE_PATH || '/home/claude/.npm-global/lib/node_modules', 'playwright'))); } catch { console.error('Playwright not installed: browser security tests NOT run (this is a failure, not a skip).'); process.exit(2); } }

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mjs': 'text/javascript' };
const mutate = process.env.MUTATE || '';
const server = http.createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/tests/browser/harness.html';
    let body = await readFile(join(ROOT, p), 'utf8').catch(() => null);
    if (body === null) { r.statusCode = 404; return r.end('nf'); }
    if (mutate && p === '/js/sanitize-svg.js') body = (await import('./mutations.mjs')).MUTATIONS[mutate](body);
    r.setHeader('content-type', MIME[extname(p)] || 'text/plain'); r.end(body);
  } catch (e) { r.statusCode = 500; r.end(String(e)); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const external = [], dialogs = [], pageErrors = [];
await page.route('**/*', (route) => { const u = route.request().url(); if (!u.startsWith(origin)) { external.push(u); return route.abort(); } route.continue(); });
page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(origin + '/tests/browser/harness.html');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  <-- ' + extra}`); };

// Every payload goes through the REAL render path (templates.render -> innerHTML) and the DOM is then inspected.
for (const [name, svg] of PAYLOADS) {
  external.length = 0; dialogs.length = 0;
  const res = await page.evaluate(async (svg) => window.__inject(svg), svg);
  await page.waitForTimeout(60);
  const pwned = await page.evaluate(() => window.__pwned);
  const bad = res.violations;
  check(`hostile: ${name}`, !pwned && !dialogs.length && !external.length && !bad.length, JSON.stringify({ pwned, dialogs, external, bad }));
}

// Direct sanitizer contract: hostile roots that must be rejected outright (null => placeholder).
for (const name of ['DOCTYPE + entity', 'xml-stylesheet PI', 'html root, not svg', 'malformed (HTML-style unclosed)', 'truncated xml (partial svg)', 'mismatched tags', 'deep nesting', 'too many nodes', 'oversize', 'empty / not a string handled separately']) {
  const svg = PAYLOADS.find((p) => p[0] === name)[1];
  const res = await page.evaluate(async (svg) => window.__inject(svg), svg);
  check(`rejected -> placeholder: ${name}`, res.placeholder === true && res.hasSvg === false, JSON.stringify(res));
}
// Hostile-but-parseable: dangerous parts stripped, harmless drawing may stay.
for (const name of ['script element', 'onclick/onmouseover on child', 'a href javascript:', 'style element', 'image remote']) {
  const svg = PAYLOADS.find((p) => p[0] === name)[1];
  const res = await page.evaluate(async (svg) => window.__inject(svg), svg);
  check(`stripped, no dangerous nodes: ${name}`, res.violations.length === 0 && (res.placeholder || res.hasSvg), JSON.stringify(res));
}

// Non-string inputs
for (const v of [null, undefined, 42, {}, []]) {
  const r = await page.evaluate((v) => window.__sanitizeRaw(v), v);
  check(`non-string input ${JSON.stringify(v)} -> null`, r === null);
}

// Safe SVG still renders and keeps its drawing
const good = await page.evaluate(async (svg) => window.__inject(svg), GOOD);
check('good svg renders (not placeholder)', good.hasSvg && !good.placeholder && good.violations.length === 0, JSON.stringify(good));
check('good svg keeps shapes, gradient, text', good.counts.rect === 1 && good.counts.circle === 1 && good.counts.path === 1 && good.counts.text === 1 && good.counts.linearGradient === 1 && good.counts.stop === 2 && good.text === 'Cell wall', JSON.stringify(good.counts));
check('good svg keeps safe attributes', /^url\(#mr\d+-g1\)$/.test(good.attrs.fill) && good.attrs.viewBox === '0 0 100 60', JSON.stringify(good.attrs));

// Full page path: real app-style render of a note containing hostile svg block, no execution
const full = await page.evaluate(async () => window.__renderNote());
check('full template render of hostile note: nothing executes, caption kept', !full.pwned && full.captionKept && full.violations.length === 0, JSON.stringify(full));

check('no uncaught page errors from harness', pageErrors.length === 0, pageErrors.join(' | '));
await browser.close(); server.close();
console.log(`\nbrowser sanitizer tests: ${pass} passed, ${fail} failed${mutate ? ` (MUTATION: ${mutate})` : ''}`);
process.exit(fail ? 1 : 0);
