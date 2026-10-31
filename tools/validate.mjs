// Read-only content validator. Usage: node tools/validate.mjs
// Exits 1 on any error. Never writes files.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateItem } from '../js/validate.js';

export function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') && f !== 'index.json' ? [p] : [];
  });
}

export function validateRepo(root = 'content') {
  const results = [];
  const files = walk(root).map((p) => p.slice(root.length + 1).split('\\').join('/')).sort();
  const seen = new Map();
  for (const rel of files) {
    let data;
    try { data = JSON.parse(readFileSync(join(root, rel), 'utf8')); }
    catch (e) { results.push({ file: rel, errors: [{ path: '$', msg: 'invalid JSON: ' + e.message }], warnings: [] }); continue; }
    const r = validateItem(data, { path: rel });
    if (data && data.id) { if (seen.has(data.id)) r.errors.push({ path: 'id', msg: `duplicate id, also in ${seen.get(data.id)}` }); else seen.set(data.id, rel); }
    results.push({ file: rel, ...r });
  }
  const idx = join(root, 'index.json');
  if (existsSync(idx)) {
    try {
      const listed = JSON.parse(readFileSync(idx, 'utf8')).files || [];
      const a = JSON.stringify([...listed].sort()), b = JSON.stringify(files);
      if (a !== b) results.push({ file: 'index.json', errors: [], warnings: [{ path: 'files', msg: 'out of date (generated file; deploy/CI rebuilds it). Run: node tools/build-index.mjs' }] });
    } catch { results.push({ file: 'index.json', errors: [{ path: '$', msg: 'invalid JSON' }], warnings: [] }); }
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const res = validateRepo(process.argv[2] || 'content');
  let bad = 0;
  for (const r of res) {
    r.errors.forEach((e) => { bad++; console.log(`ERROR ${r.file} ${e.path}: ${e.msg}`); });
    r.warnings.forEach((w) => console.log(`warn  ${r.file} ${w.path}: ${w.msg}`));
  }
  console.log(`${res.length} files checked, ${bad} error(s)`);
  process.exit(bad ? 1 : 0);
}
