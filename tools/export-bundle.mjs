// Usage: node tools/export-bundle.mjs <id> [out-file]
// Exports an APPROVED repository item as a medrise.bundle/1 file. Read-only for the repo (writes only the out file).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildBundle, bundleFileName } from '../js/bundle.js';

const [id, out] = process.argv.slice(2);
if (!id) { console.error('usage: node tools/export-bundle.mjs <id> [out-file]'); process.exit(2); }

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') && f !== 'index.json' ? [p] : []; });

let approved;
try { approved = JSON.parse(readFileSync('handoff/approved.json', 'utf8')).approved; } catch { approved = null; }
if (!Array.isArray(approved)) { console.error('handoff/approved.json is missing or invalid'); process.exit(1); }
if (!approved.includes(id)) { console.error(`NOT APPROVED: "${id}" is not listed in handoff/approved.json. The owner must add it first.`); process.exit(1); }

const root = 'content';
const hit = walk(root).map((p) => p.slice(root.length + 1).split('\\').join('/')).map((rel) => ({ rel, d: JSON.parse(readFileSync(join(root, rel), 'utf8')) }))
  .find(({ rel, d }) => (d.id || slug(rel.replace(/\.json$/, ''))) === id);
if (!hit) { console.error(`No repository content with id "${id}"`); process.exit(1); }

const item = { ...hit.d, id, _path: hit.rel };
try {
  const bundle = await buildBundle(item);
  const file = out || bundleFileName(id);
  writeFileSync(file, JSON.stringify(bundle, null, 2) + '\n');
  console.log(`wrote ${file}  sha256=${bundle.sha256}`);
} catch (e) { console.error('export failed: ' + e.message); process.exit(1); }
