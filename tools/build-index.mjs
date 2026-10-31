import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = 'content';
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') && f !== 'index.json' ? [p] : [];
});
const files = walk(root).map((p) => p.slice(root.length + 1).split('\\').join('/')).sort();
writeFileSync(join(root, 'index.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`content/index.json: ${files.length} files`);
