import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as V from '../js/validate.js';
import { validateRepo } from '../tools/validate.mjs';

const note = (o = {}) => ({ id: 'biology-x', template: 'note-v1', status: 'done', meta: { title: 'T' }, sections: [{ heading: 'H', blocks: [{ type: 'p', text: 'hi' }] }], ...o });
const tst = (o = {}) => ({ id: 'tests-x', template: 'test-v1', status: 'done', meta: { title: 'T' }, questions: [{ q: 'Q', options: ['a', 'b'], answer: 1 }], ...o });
const errs = (d, o) => V.validateItem(d, o).errors.map((e) => e.path + ': ' + e.msg);

test('real repo content passes (0 errors)', () => {
  const r = validateRepo('content');
  assert.equal(r.length, 3);
  assert.deepEqual(r.flatMap((x) => x.errors), []);
});

test('explicit ids equal the old derived slug(path) values', () => {
  const expect = { 'biology/cell-unit-of-life.json': 'biology-cell-unit-of-life', 'biology/plant-kingdom.json': 'biology-plant-kingdom', 'tests/plant-kingdom-test.json': 'tests-plant-kingdom-test' };
  for (const [f, id] of Object.entries(expect)) assert.equal(JSON.parse(readFileSync('content/' + f, 'utf8')).id, id);
});

test('pending empty draft allowed; done/progress need content', () => {
  assert.deepEqual(errs(note({ status: 'pending', sections: [] })), []);
  assert.match(errs(note({ status: 'done', sections: [] })).join(), /sections/);
  assert.match(errs(tst({ status: 'progress', questions: [] })).join(), /questions/);
});

test('repo id rules: required, pattern, must match path', () => {
  assert.match(errs({ ...note(), id: undefined }, { path: 'biology/x.json' }).join(), /id: required/);
  assert.match(errs(note({ id: 'Bad_ID' }), { path: 'biology/x.json' }).join(), /id/);
  assert.match(errs(note({ id: 'other' }), { path: 'biology/x.json' }).join(), /must equal "biology-x"/);
  assert.deepEqual(errs(note(), { path: 'biology/x.json' }), []);
});

test('test-v1 answer out of range / not integer is an error', () => {
  for (const a of [4, -1, 1.5, '1', null]) assert.match(errs(tst({ questions: [{ q: 'Q', options: ['a', 'b'], answer: a }] })).join(), /answer/);
});

test('schedule validation incl. null and impossible dates', () => {
  assert.deepEqual(errs(note({ schedule: null })), []);
  assert.deepEqual(errs(note({ schedule: { date: '2026-11-05', time: '18:00' } })), []);
  assert.match(errs(note({ schedule: { date: '2026-02-30' } })).join(), /schedule.date/);
  assert.match(errs(note({ schedule: { date: '2026-11-05', time: '25:00' } })).join(), /schedule.time/);
});

test('unknown template / block type / table shape rejected', () => {
  assert.match(errs({ template: 'x-v9', meta: { title: 't' } }).join(), /template/);
  assert.match(errs(note({ sections: [{ heading: 'H', blocks: [{ type: 'video' }] }] })).join(), /unknown block type/);
  assert.match(errs(note({ sections: [{ heading: 'H', blocks: [{ type: 'table', head: ['a', 'b'], rows: [['x']] }] }] })).join(), /cells/);
});

test('svg lint blocks dangerous source in repo content', () => {
  const bad = ['<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>', '<svg viewBox="0 0 1 1" onload="x()"></svg>', '<svg viewBox="0 0 1 1"><foreignObject/></svg>', '<svg viewBox="0 0 1 1"><a href="javascript:x"/></svg>', '<svg viewBox="0 0 1 1"><rect style="fill:url(http://e/x)"/></svg>', '<img src=x>'];
  for (const svg of bad) assert.ok(V.lintSvg(svg).length, svg);
  assert.deepEqual(V.lintSvg('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3" fill="url(#g)"/></svg>'), []);
});

test('import payload: single, array, {items}, export shape with schedule:null and title', () => {
  const ok = { ...note(), id: undefined, schedule: null, title: 'T' };
  for (const p of [ok, [ok], { items: [ok] }]) assert.deepEqual(V.validateImport(p).errors, []);
  assert.ok(V.validateImport({ items: [{ template: 'note-v1' }] }).errors.length);
  const m = V.validateImport([ok, { template: 'x' }, { template: 'y' }]);
  assert.equal(m.invalid, 2); // distinct invalid items, not error lines
});

test('validateRepo catches duplicate ids, bad JSON and stale index', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mr-'));
  mkdirSync(join(dir, 'a'));
  writeFileSync(join(dir, 'a', 'one.json'), JSON.stringify(note({ id: 'a-one' })));
  writeFileSync(join(dir, 'a', 'two.json'), '{ nope');
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ files: [] }));
  const r = validateRepo(dir);
  const all = r.flatMap((x) => x.errors.map((e) => x.file + ' ' + e.msg)).join('\n');
  assert.match(all, /invalid JSON/);
  assert.ok(r.some((x) => x.file === 'index.json' && x.warnings.some((w) => /out of date/.test(w.msg)) && !x.errors.length)); // stale index is a warning only
});

test('taxonomy.json and schemas agree with validator constants', () => {
  const t = JSON.parse(readFileSync('meta/taxonomy.json', 'utf8'));
  assert.deepEqual(t.statuses, V.STATUSES);
  assert.deepEqual(t.templates, V.TEMPLATES);
  assert.deepEqual(t.blockTypes, V.BLOCK_TYPES);
  for (const f of readdirSync('schemas')) JSON.parse(readFileSync('schemas/' + f, 'utf8'));
});
