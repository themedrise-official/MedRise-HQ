import { validateImport, MAX_IMPORT_BYTES } from './validate.js';
const KEY = 'medrise-hq:v1';
let remote = [];
let approved = new Set();
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { local: [], ov: {} }; } catch { return { local: [], ov: {} }; } };
const write = (s) => localStorage.setItem(KEY, JSON.stringify(s));
// _remote / _path are set ONLY by load() on repository files. They are never accepted from imports or localStorage.
const RESERVED = ['_remote', '_path'];
const clean = (d) => { if (!d || typeof d !== 'object' || Array.isArray(d)) return d; const c = { ...d }; RESERVED.forEach((k) => delete c[k]); return c; };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

export async function load() {
  try {
    const ix = await (await fetch('content/index.json', { cache: 'no-cache' })).json();
    remote = (await Promise.all(ix.files.map(async (f) => {
      try {
        const d = await (await fetch('content/' + f, { cache: 'no-cache' })).json();
        d.id = d.id || slug(f.replace(/\.json$/, ''));
        d._remote = true;
        d._path = f; // repo path under content/, used by the Studio bundle export
        return d;
      } catch { return null; }
    }))).filter(Boolean);
  } catch { remote = []; }
  await loadApproved();
}

// handoff/approved.json = { approved: [ids] }, owner-maintained, fetched fresh. Missing or invalid file => nothing approved.
export async function loadApproved() {
  try {
    const j = await (await fetch('handoff/approved.json', { cache: 'no-cache' })).json();
    approved = new Set(Array.isArray(j?.approved) ? j.approved.filter((x) => typeof x === 'string') : []);
  } catch { approved = new Set(); }
}

// Only repository items (not local imports) that the owner listed can be exported to Studio.
export const repoItem = (id) => remote.find((r) => r.id === id) || null;
export const isApproved = (i) => {
  if (!i || typeof i.id !== 'string' || !approved.has(i.id)) return false;
  const r = repoItem(i.id); // must exist in the repository collection loaded by load(), with the same path
  return !!r && !!r._path && r._path === i._path;
};

export function items() {
  const s = read();
  const all = [...remote.map((d) => ({ ...d, ...clean(s.ov[d.id] || {}) })), ...s.local.map(clean)];
  return all.map((d) => ({ status: 'pending', schedule: null, ...d, title: d.meta?.title || d.title || d.id }));
}

export const get = (id) => items().find((i) => i.id === id);

export function find(q) {
  const l = String(q || '').toLowerCase();
  const a = items();
  return a.find((i) => i.id === q) || a.find((i) => i.id.includes(l)) || a.find((i) => i.title.toLowerCase().includes(l));
}

export function patch(id, p) {
  const s = read();
  const li = s.local.findIndex((i) => i.id === id);
  if (li >= 0) s.local[li] = { ...s.local[li], ...p };
  else s.ov[id] = { ...(s.ov[id] || {}), ...p };
  write(s);
}

export function remove(id) {
  const s = read();
  s.local = s.local.filter((i) => i.id !== id);
  write(s);
}

// Import policy: SKIP DUPLICATES. An item whose id already exists (repo content, local items, or an earlier
// item in the same file) is skipped and never overwritten. Any INVALID item rejects the whole import
// (nothing is written): invalid content is never silently skipped.
// Returns { imported, skipped, rejected: 0, skippedIds }. On rejection throws an Error with .summary.
export function importText(text) {
  if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES) throw new Error(`import larger than ${MAX_IMPORT_BYTES} characters`);
  const j = JSON.parse(text);
  const { list, errors, invalid } = validateImport(j);
  const taken = new Set(items().map((i) => i.id));
  const fresh = [], skippedIds = [];
  list.forEach((d) => {
    const id = d && (d.id || slug(d.meta?.title || d.template));
    if (taken.has(id)) { skippedIds.push(id); return; }
    taken.add(id);
    fresh.push({ status: 'pending', schedule: null, ...clean(d), id });
  });
  if (errors.length) {
    const e = new Error(`Import rejected, nothing imported (imported 0, skipped ${skippedIds.length}, rejected ${invalid}). ` + errors.slice(0, 5).map((x) => `${x.path}: ${x.msg}`).join('; ') + (errors.length > 5 ? ` (+${errors.length - 5} more)` : ''));
    e.summary = { imported: 0, skipped: skippedIds.length, rejected: invalid, skippedIds };
    throw e;
  }
  if (fresh.length) {
    const s = read();
    s.local.push(...fresh);
    write(s);
  }
  return { imported: fresh.length, skipped: skippedIds.length, rejected: 0, skippedIds };
}

export function exportAll() {
  const blob = new Blob([JSON.stringify({ items: items().map(({ _remote, _path, ...d }) => d) }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'medrise-hq-export.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
