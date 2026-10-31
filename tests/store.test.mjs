import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Minimal browser stubs for store.js
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.fetch = async (u) => ({ json: async () => JSON.parse(readFileSync(String(u), 'utf8')) });
const S = await import('../js/store.js');
await S.load();

const good = { template: 'note-v1', status: 'pending', meta: { title: 'Brand New' }, sections: [] };

test('remote items keep their pre-existing ids (overrides keep working)', () => {
  assert.deepEqual(S.items().filter((i) => i._remote).map((i) => i.id).sort(), ['biology-cell-unit-of-life', 'biology-plant-kingdom', 'tests-plant-kingdom-test']);
  S.patch('biology-plant-kingdom', { status: 'progress' });
  assert.equal(S.get('biology-plant-kingdom').status, 'progress');
  S.patch('biology-plant-kingdom', { status: 'done' });
});

test('valid import adds item and returns summary', () => {
  const r = S.importText(JSON.stringify(good));
  assert.deepEqual([r.imported, r.skipped, r.rejected], [1, 0, 0]);
  assert.ok(S.get('brand-new'));
});

test('duplicate id is skipped, never overwritten, never renamed -2', () => {
  const before = JSON.stringify(S.get('brand-new'));
  const r = S.importText(JSON.stringify({ ...good, status: 'done', meta: { title: 'Brand New' }, sections: [{ heading: 'CHANGED', blocks: [{ type: 'p', text: 'x' }] }] }));
  assert.deepEqual([r.imported, r.skipped, r.rejected], [0, 1, 0]);
  assert.deepEqual(r.skippedIds, ['brand-new']);
  assert.equal(JSON.stringify(S.get('brand-new')), before);
  assert.equal(S.items().filter((i) => i.id.startsWith('brand-new')).length, 1);
});

test('duplicates of repo (remote) ids are skipped and the repo item is untouched', () => {
  const before = JSON.stringify(S.get('biology-plant-kingdom'));
  const r = S.importText(JSON.stringify({ ...good, id: 'biology-plant-kingdom', meta: { title: 'Evil Overwrite' } }));
  assert.deepEqual([r.imported, r.skipped], [0, 1]);
  assert.equal(JSON.stringify(S.get('biology-plant-kingdom')), before);
});

test('mixed file: unique valid items imported, duplicates skipped (incl. duplicate inside the same file)', () => {
  const mk = (title, id) => ({ ...good, meta: { title }, ...(id ? { id } : {}) });
  const r = S.importText(JSON.stringify({ items: [mk('Mix One'), mk('Brand New'), mk('Mix Two', 'mix-two'), mk('Mix One Again', 'mix-one')] }));
  assert.deepEqual([r.imported, r.skipped, r.rejected], [2, 2, 0]);
  assert.ok(S.get('mix-one') && S.get('mix-two'));
  assert.equal(S.get('mix-one').meta.title, 'Mix One'); // first wins, later duplicate did not overwrite
});

test('invalid item rejects the WHOLE import: nothing written, rejected count reported (never silently skipped)', () => {
  const before = S.items().length;
  const bad = { ...good, meta: { title: 'Other' }, template: 'nope' };
  let err;
  try { S.importText(JSON.stringify([{ ...good, meta: { title: 'Fresh' } }, { ...good, meta: { title: 'Brand New' } }, bad])); } catch (e) { err = e; }
  assert.ok(err, 'must throw');
  assert.match(err.message, /template/);
  assert.match(err.message, /rejected 1/);
  assert.deepEqual([err.summary.imported, err.summary.rejected], [0, 1]);
  assert.equal(S.items().length, before);
  assert.equal(S.get('fresh'), undefined);
});

test('invalid answer, oversize, and dangerous svg source are rejected at import', () => {
  const t = { template: 'test-v1', meta: { title: 'Bad T' }, questions: [{ q: 'q', options: ['a', 'b'], answer: 9 }] };
  assert.throws(() => S.importText(JSON.stringify(t)), /answer/);
  assert.throws(() => S.importText('x'.repeat(2000001)), /larger/);
  const svg = { template: 'note-v1', meta: { title: 'Svg Bad' }, sections: [{ heading: 'h', blocks: [{ type: 'svg', svg: '<svg viewBox="0 0 1 1" onload="alert(1)"/>' }] }] };
  assert.throws(() => S.importText(JSON.stringify(svg)), /event handler/);
  assert.equal(S.get('svg-bad'), undefined);
});

test('re-importing an Export file: existing items skipped, only new ones imported', () => {
  const exp = { items: [...S.items().map(({ _remote, ...d }) => d), { ...good, meta: { title: 'Exported One' }, id: 'exported-one', schedule: null, title: 'Exported One' }] };
  const n = S.items().length;
  const r = S.importText(JSON.stringify(exp));
  assert.deepEqual([r.imported, r.skipped, r.rejected], [1, n, 0]);
});
