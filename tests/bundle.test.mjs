import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalJson, hashContent, sha256Hex, buildBundle, verifyBundle, contentOf, SCHEMA } from '../js/bundle.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/golden-bundle.json', import.meta.url), 'utf8'));

test('canonical JSON: sorted keys, no whitespace, arrays keep order, unicode kept', () => {
  assert.equal(canonicalJson({ b: 1, a: [3, 1, { z: 1, y: 2 }], c: 'é"\\' }), '{"a":[3,1,{"y":2,"z":1}],"b":1,"c":"é\\"\\\\"}');
  assert.equal(canonicalJson({ '\uD83D\uDE00': 1, '\uFF5E': 2 }), '{"\uD83D\uDE00":1,"\uFF5E":2}'); // UTF-16 code unit order: D83D < FF5E
});

test('canonical JSON rejects undefined, NaN, Infinity, functions', () => {
  for (const v of [{ a: undefined }, { a: NaN }, [Infinity], { a: () => 1 }, { a: 1n }]) assert.throws(() => canonicalJson(v));
});

test('sha256Hex known vector', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('golden bundle: format and hash are stable (Studio has the same fixture)', async () => {
  assert.equal(golden.schema, SCHEMA);
  assert.deepEqual(Object.keys(golden).sort(), ['content', 'exportedAt', 'schema', 'sha256', 'source']);
  assert.equal(await hashContent(golden.content), golden.sha256);
  assert.ok(await verifyBundle(golden));
  assert.match(golden.sha256, /^[0-9a-f]{64}$/);
});

test('tampering with content breaks verification', async () => {
  const t = structuredClone(golden);
  t.content.sections[0].blocks[0].text += '!';
  assert.equal(await verifyBundle(t), false);
});

test('content excludes status, schedule, title, _remote, _path', async () => {
  const b = await buildBundle({ id: 'x', _path: 'a/x.json', _remote: true, status: 'done', schedule: { date: '2026-01-01' }, title: 'T', template: 'test-v1', meta: { title: 'T' }, questions: [{ q: 'q', options: ['a', 'b', 'c', 'd'], answer: 0, explanation: 'e' }] });
  assert.deepEqual(Object.keys(b.content).sort(), ['id', 'meta', 'questions', 'template']);
  assert.equal(b.source.path, 'content/a/x.json');
});

test('hash ignores status / schedule changes (only content counts)', async () => {
  const base = { id: 'x', _path: 'a/x.json', template: 'note-v1', meta: { title: 'T' }, sections: [{ heading: 'h', blocks: [] }] };
  const a = await buildBundle({ ...base, status: 'pending' });
  const b = await buildBundle({ ...base, status: 'done', schedule: { date: '2026-02-02' } });
  assert.equal(a.sha256, b.sha256);
});

test('refuses local imports (no _path), unsupported templates and empty content', async () => {
  await assert.rejects(buildBundle({ id: 'x', template: 'note-v1', meta: {}, sections: [{ heading: 'h', blocks: [] }] }), /repository/);
  assert.throws(() => contentOf({ id: 'x', template: 'paper-v1', meta: {} }), /not supported/);
  assert.throws(() => contentOf({ id: 'x', template: 'note-v1', meta: {}, sections: [] }), /no content/);
});

test('CLI refuses an id that is not in handoff/approved.json (default list is empty)', () => {
  const approved = JSON.parse(readFileSync('handoff/approved.json', 'utf8'));
  assert.deepEqual(approved, { approved: [] }, 'ships empty: owner decides what is approved');
  const r = spawnSync('node', ['tools/export-bundle.mjs', 'biology-plant-kingdom', join(mkdtempSync(join(tmpdir(), 'b-')), 'o.json')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /NOT APPROVED/);
});

// Store gating, with browser stubs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
let approvedFile = { approved: [] };
globalThis.fetch = async (u) => ({ json: async () => (String(u).includes('approved.json') ? approvedFile : JSON.parse(readFileSync(String(u), 'utf8'))) });
const S = await import('../js/store.js');

test('store: nothing is approved by default; only listed repo items qualify; local imports never do', async () => {
  await S.load();
  assert.equal(S.isApproved(S.get('biology-plant-kingdom')), false);
  approvedFile = { approved: ['biology-plant-kingdom', 'brand-new'] };
  await S.loadApproved();
  assert.equal(S.isApproved(S.get('biology-plant-kingdom')), true);
  assert.equal(S.isApproved(S.get('biology-cell-unit-of-life')), false);
  S.importText(JSON.stringify({ template: 'note-v1', meta: { title: 'Brand New' }, sections: [] }));
  assert.equal(S.isApproved(S.get('brand-new')), false, 'local import with an approved id is still not exportable');
});

test('store: repo items carry _path; exportAll strips it', async () => {
  assert.equal(S.get('biology-plant-kingdom')._path, 'biology/plant-kingdom.json');
  const src = readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  assert.match(src, /\{ _remote, _path, \.\.\.d \}/);
});

test('store: invalid approved.json means nothing approved', async () => {
  approvedFile = { approved: 'all' };
  await S.loadApproved();
  assert.equal(S.isApproved(S.get('biology-plant-kingdom')), false);
});

test('real content: items with content build a valid bundle; a pending item without content is refused', async () => {
  for (const id of ['biology-plant-kingdom', 'tests-plant-kingdom-test']) {
    const b = await buildBundle(S.get(id), new Date('2026-11-01T00:00:00Z'));
    assert.ok(await verifyBundle(b), id);
  }
  const empty = S.get('biology-cell-unit-of-life');
  if (!(empty.sections?.length || empty.questions?.length)) await assert.rejects(buildBundle(empty), /no content/);
});

test('REGRESSION approval bypass: forged _path / _remote on a local import never makes it exportable', async () => {
  approvedFile = { approved: ['ghost-item', 'biology-plant-kingdom'] };
  await S.loadApproved();
  // approved id with NO matching repository item, local import supplies forged reserved fields
  S.importText(JSON.stringify({ id: 'ghost-item', _path: 'biology/ghost-item.json', _remote: true, template: 'note-v1', meta: { title: 'Ghost' }, sections: [{ heading: 'h', blocks: [{ type: 'p', text: 'x' }] }] }));
  const ghost = S.get('ghost-item');
  assert.ok(ghost, 'imported locally');
  assert.equal(ghost._path, undefined, '_path stripped at import');
  assert.equal(ghost._remote, undefined, '_remote stripped at import');
  assert.equal(S.isApproved(ghost), false);
  assert.equal(S.isApproved({ ...ghost, _path: 'biology/ghost-item.json' }), false, 'forged _path on an object is not enough');
  assert.equal(S.repoItem('ghost-item'), null);
  await assert.rejects(buildBundle(ghost), /repository/);
});

test('REGRESSION approval bypass: legacy local data already holding forged reserved fields is neutralised', async () => {
  const st = JSON.parse(mem.get('medrise-hq:v1'));
  st.local.push({ id: 'legacy-forged', _path: 'x/legacy-forged.json', _remote: true, template: 'note-v1', status: 'pending', schedule: null, meta: { title: 'Legacy' }, sections: [{ heading: 'h', blocks: [{ type: 'p', text: 'x' }] }] });
  mem.set('medrise-hq:v1', JSON.stringify(st));
  approvedFile = { approved: ['legacy-forged'] };
  await S.loadApproved();
  assert.equal(S.get('legacy-forged')._path, undefined);
  assert.equal(S.isApproved(S.get('legacy-forged')), false);
});

test('REGRESSION approval bypass: forging _path on a local item cannot ride on a real repo id (duplicate import is skipped)', async () => {
  approvedFile = { approved: ['biology-plant-kingdom'] };
  await S.loadApproved();
  const before = JSON.stringify(S.repoItem('biology-plant-kingdom'));
  const r = S.importText(JSON.stringify({ id: 'biology-plant-kingdom', _path: 'biology/plant-kingdom.json', _remote: true, template: 'note-v1', meta: { title: 'Evil' }, sections: [{ heading: 'EVIL', blocks: [{ type: 'p', text: 'x' }] }] }));
  assert.equal(r.skipped, 1);
  assert.equal(JSON.stringify(S.repoItem('biology-plant-kingdom')), before);
  assert.equal(S.isApproved(S.get('biology-plant-kingdom')), true, 'the real repo item is still approved');
});

test('a localStorage override cannot change what is exported (export uses the repository item)', async () => {
  const st = JSON.parse(mem.get('medrise-hq:v1'));
  st.ov['biology-plant-kingdom'] = { ...(st.ov['biology-plant-kingdom'] || {}), sections: [{ heading: 'TAMPERED', blocks: [{ type: 'p', text: 'x' }] }], _path: 'evil/path.json' };
  mem.set('medrise-hq:v1', JSON.stringify(st));
  const b = await buildBundle(S.repoItem('biology-plant-kingdom'));
  assert.ok(!JSON.stringify(b.content).includes('TAMPERED'));
  assert.equal(b.source.path, 'content/biology/plant-kingdom.json');
});
