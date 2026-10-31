// End-to-end smoke test of the real app in Chromium (legacy localStorage state, hostile svg, import rules, SW cache).
// Run: node tests/browser/app-smoke.mjs   (needs Playwright, same as run.mjs)
import { createRequire } from 'node:module';
const require = createRequire((process.env.PLAYWRIGHT_NODE_PATH || '/home/claude/.npm-global/lib/node_modules') + '/');
const { chromium } = require('playwright');
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = process.argv[2] || new URL('../..', import.meta.url).pathname;
const M = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png' };
const s = http.createServer(async (q, r) => { let p = new URL(q.url,'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; const b = await readFile(join(ROOT,p)).catch(()=>null); if(!b){r.statusCode=404;return r.end()} r.setHeader('content-type',M[extname(p)]||'text/plain'); r.end(b); });
await new Promise(o => s.listen(0,'127.0.0.1',o));
const origin = `http://127.0.0.1:${s.address().port}/`;
const b = await chromium.launch(); const ctx = await b.newContext({ serviceWorkers: 'allow' }); const pg = await ctx.newPage();
const errs = [], dialogs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type()==='error' && !/404/.test(m.text())) errs.push(m.text()); }); pg.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
let ok = 0, bad = 0; const check = (n, c, x='') => { c ? ok++ : bad++; console.log(`${c?'PASS':'FAIL'}  ${n}${c?'':'  <-- '+x}`); };

// Pre-seed OLD-format state (as a returning user would have): override keyed by the old derived id + a hostile local item stored before validation existed
await pg.addInitScript(() => { if (!localStorage.getItem('medrise-hq:v1')) localStorage.setItem('medrise-hq:v1', JSON.stringify({ ov: { 'biology-plant-kingdom': { status: 'progress', schedule: { date: '2026-11-05', time: '18:00' } } }, local: [{ id: 'legacy-hostile', template: 'note-v1', status: 'done', meta: { title: 'Legacy Hostile' }, sections: [{ heading: 'H', blocks: [{ type: 'svg', caption: 'cap', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="window.__pwned=1"><script>window.__pwned=1</script><rect width="9" height="9" onclick="window.__pwned=1" fill="red"/></svg>' }] }] }] })); });
await pg.goto(origin); await pg.waitForSelector('#app h1');
await pg.click('[data-p=dash]');
const list = await pg.evaluate(() => { const i = document.querySelector('#cmdin'); return document.querySelectorAll('.item').length; });
check('dashboard shows 4 items (3 repo + 1 legacy local)', list === 4, list);
const prog = await pg.locator('.card h3.p').first().textContent();
check('old override (status progress) still applies to biology-plant-kingdom by id', /\(2\)/.test(prog), prog); // plant-kingdom override + test is progress => 2
// open legacy hostile item
await pg.click('[data-id="legacy-hostile"]');
await pg.waitForSelector('.stage figure');
await pg.locator('.stage rect').first().click({ force: true }).catch(() => {});
await pg.waitForTimeout(100);
const st = await pg.evaluate(() => ({ pwned: window.__pwned || 0, script: document.querySelectorAll('.stage script').length, onattrs: [...document.querySelectorAll('.stage *')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length, rect: document.querySelectorAll('.stage svg rect').length, cap: document.querySelector('.stage figcaption')?.textContent }));
check('legacy hostile svg: nothing executed, no script/on* in DOM, caption kept', !st.pwned && !st.script && !st.onattrs && st.cap === 'cap' && !dialogs.length, JSON.stringify(st));
check('legacy hostile svg: harmless drawing (rect) preserved', st.rect === 1, JSON.stringify(st));
// UI import of hostile svg is rejected
await pg.click('[data-act=back]'); await pg.click('[data-p=imp]');
await pg.fill('#paste', JSON.stringify({ template: 'note-v1', meta: { title: 'Evil' }, sections: [{ heading: 'h', blocks: [{ type: 'svg', svg: '<svg viewBox="0 0 1 1"><script>window.__pwned=1</script></svg>' }] }] }));
await pg.click('[data-act=import]'); await pg.waitForSelector('.out');
const msg = await pg.locator('.out').textContent();
check('UI import of hostile svg rejected with reason', /script tag/.test(msg), msg);
// UI import of legit svg works and renders
await pg.fill('#paste', JSON.stringify({ template: 'note-v1', status: 'done', meta: { title: 'Good Diagram' }, sections: [{ heading: 'h', blocks: [{ type: 'svg', caption: 'ok', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#0a7"/></svg>' }] }] }));
await pg.click('[data-act=import]'); await pg.waitForFunction(() => /imported 1/.test(document.querySelector(".out")?.textContent || ''));
await pg.click('[data-p=dash]'); await pg.click('[data-id="good-diagram"]'); await pg.waitForSelector('.stage svg circle');
check('legit imported svg renders as real svg', true);
// duplicate import rejected
await pg.click('[data-act=back]'); await pg.click('[data-p=imp]');
await pg.fill('#paste', JSON.stringify({ template: 'note-v1', meta: { title: 'Good Diagram' }, sections: [] }));
await pg.click('[data-act=import]'); await pg.waitForSelector('.out');
const dupMsg = await pg.locator('.out').textContent();
check('duplicate id import skipped with summary (no -2, no overwrite)', /imported 0, skipped 1.*rejected 0/.test(dupMsg), dupMsg);
await pg.fill('#paste', JSON.stringify([{ template: 'note-v1', meta: { title: 'Fresh Ok' }, sections: [] }, { template: 'nope', meta: { title: 'Bad' } }]));
await pg.click('[data-act=import]'); await pg.waitForFunction(() => /rejected 1/.test(document.querySelector('.out')?.textContent || ''));
check('invalid item rejects whole import, summary shows rejected 1', /nothing imported/.test(await pg.locator('.out').textContent()));
// repo notes render (real plant-kingdom with table)
await pg.click('[data-p=dash]'); await pg.click('[data-id="biology-plant-kingdom"]'); await pg.waitForSelector('.stage table');
check('real plant-kingdom note renders with table', (await pg.locator('.stage h2').count()) === 2);
await pg.click('[data-act=back]'); await pg.click('[data-id="tests-plant-kingdom-test"]'); await pg.waitForSelector('.stage .qs');
check('real test renders with answer key', (await pg.locator('.stage .key tbody tr').count()) === 3);
// service worker + cache
await pg.waitForTimeout(800);
const sw = await pg.evaluate(async () => { const k = await caches.keys(); const c = k.length ? await (await caches.open(k[0])).keys() : []; return { k, files: c.map(r => new URL(r.url).pathname) }; });
check('SW cache v2 has new modules precached', sw.k.includes('medrise-hq-v2') && sw.files.some(f => f.endsWith('js/sanitize-svg.js')) && sw.files.some(f => f.endsWith('js/validate.js')), JSON.stringify(sw));
check('no console/page errors', errs.length === 0, errs.join(' | '));
console.log(`\napp smoke: ${ok} passed, ${bad} failed`); await b.close(); s.close(); process.exit(bad ? 1 : 0);
