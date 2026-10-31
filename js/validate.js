// Shared, dependency-free content validator (runs in Node CLI and in the browser import).
// Pure functions only: no DOM, no fs. Returns { errors: [], warnings: [] } of { path, msg }.

export const STATUSES = ['pending', 'progress', 'done'];
export const TEMPLATES = ['note-v1', 'test-v1'];
export const BLOCK_TYPES = ['bullets', 'table', 'sub', 'p', 'note', 'svg'];
export const TOP_KEYS = ['id', 'template', 'status', 'schedule', 'meta', 'sections', 'questions', 'title'];
export const NOTE_META = ['title', 'subtitle', 'class', 'chapter', 'crumb', 'syllabus_label', 'syllabus', 'subject'];
export const TEST_META = ['title', 'subtitle', 'class', 'subject', 'time', 'chapter'];
export const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_ITEM_BYTES = 500000;
export const MAX_IMPORT_BYTES = 2000000;
export const MAX_SVG_SOURCE = 100000;

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Conservative string lint for repo content. This is a CONTENT GATE only, not the security
// boundary: the runtime security boundary is the DOM sanitizer in sanitize-svg.js.
const SVG_BAD = [
  [/<\s*script/i, 'script tag'], [/<\s*foreignObject/i, 'foreignObject'], [/\bon[a-z]+\s*=/i, 'event handler attribute'],
  [/javascript\s*:/i, 'javascript: URL'], [/data\s*:/i, 'data: URL'], [/<\s*style/i, 'style tag'],
  [/\bstyle\s*=/i, 'style attribute'], [/\b(xlink:)?href\s*=/i, 'href attribute'], [/<\s*(image|use|iframe|embed|object|animate|set|a)\b/i, 'disallowed element'],
  [/<!DOCTYPE|<!ENTITY/i, 'DOCTYPE/ENTITY'], [/url\s*\(\s*(?!#)/i, 'external url()']
];
export function lintSvg(src) {
  const out = [];
  if (!isStr(src)) return ['svg must be a string'];
  if (src.length > MAX_SVG_SOURCE) out.push(`svg larger than ${MAX_SVG_SOURCE} chars`);
  if (!/^\s*<svg[\s>]/i.test(src)) out.push('svg must start with <svg');
  if (!/viewBox\s*=/.test(src)) out.push('svg needs a viewBox');
  for (const [re, name] of SVG_BAD) if (re.test(src)) out.push(name);
  return out;
}

function validateBlock(b, path, add, warn) {
  if (!isObj(b)) return add(path, 'block must be an object');
  if (!BLOCK_TYPES.includes(b.type)) return add(path + '.type', `unknown block type "${b.type}" (allowed: ${BLOCK_TYPES.join(', ')})`);
  const strs = (arr, p) => { if (!Array.isArray(arr)) return add(p, 'must be an array'); arr.forEach((x, i) => { if (!isStr(x)) add(`${p}[${i}]`, 'must be a string'); else if (/<\/?[a-z][^>]*>/i.test(x)) warn(`${p}[${i}]`, 'looks like HTML; only **bold** and *italic* are supported'); }); };
  switch (b.type) {
    case 'bullets': strs(b.items, path + '.items'); if (Array.isArray(b.items) && !b.items.length) add(path + '.items', 'must not be empty'); break;
    case 'table':
      strs(b.head, path + '.head');
      if (!Array.isArray(b.rows)) add(path + '.rows', 'must be an array');
      else b.rows.forEach((r, i) => { strs(r, `${path}.rows[${i}]`); if (Array.isArray(r) && Array.isArray(b.head) && r.length !== b.head.length) add(`${path}.rows[${i}]`, `has ${r.length} cells, head has ${b.head.length}`); });
      break;
    case 'svg':
      lintSvg(b.svg).forEach((m) => add(path + '.svg', m));
      if (b.caption !== undefined && !isStr(b.caption)) add(path + '.caption', 'must be a string');
      break;
    default:
      if (!isStr(b.text) || !b.text.trim()) add(path + '.text', 'required non-empty string');
      else if (/<\/?[a-z][^>]*>/i.test(b.text)) warn(path + '.text', 'looks like HTML; only **bold** and *italic* are supported');
  }
}

/**
 * validateItem(item, opts)
 *  opts.path     repo-relative path under content/ (e.g. "biology/plant-kingdom.json"); when given, id is REQUIRED and must equal slug(path)
 *  opts.strictId force id requirement without a path
 */
export function validateItem(d, opts = {}) {
  const errors = [], warnings = [];
  const add = (path, msg) => errors.push({ path, msg });
  const warn = (path, msg) => warnings.push({ path, msg });
  if (!isObj(d)) { add('$', 'item must be a JSON object'); return { errors, warnings }; }

  Object.keys(d).forEach((k) => { if (!TOP_KEYS.includes(k)) warn(k, 'unknown top-level field'); });

  if (opts.path || opts.strictId) {
    if (!isStr(d.id) || !d.id) add('id', 'required for repo content');
    else if (!ID_RE.test(d.id)) add('id', 'must be lowercase letters, digits and single hyphens');
    else if (opts.path && d.id !== slug(opts.path.replace(/\.json$/, ''))) add('id', `must equal "${slug(opts.path.replace(/\.json$/, ''))}" (derived from the file path; changing it would orphan saved status/schedule)`);
  } else if (d.id !== undefined && (!isStr(d.id) || !ID_RE.test(d.id))) add('id', 'must be lowercase letters, digits and single hyphens');

  if (!TEMPLATES.includes(d.template)) { add('template', `must be one of: ${TEMPLATES.join(', ')}`); return { errors, warnings }; }
  if (d.status !== undefined && !STATUSES.includes(d.status)) add('status', `must be one of: ${STATUSES.join(', ')}`);

  if (d.schedule !== undefined && d.schedule !== null) {
    const s = d.schedule;
    if (!isObj(s)) add('schedule', 'must be { date, time? } or null');
    else {
      const m = isStr(s.date) && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.date);
      const ok = m && (() => { const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3]; })();
      if (!ok) add('schedule.date', 'must be a real date, YYYY-MM-DD');
      if (s.time !== undefined && !(isStr(s.time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))) add('schedule.time', 'must be HH:MM (24h)');
    }
  }

  const m = d.meta;
  if (!isObj(m)) add('meta', 'required object');
  else {
    if (!isStr(m.title) || !m.title.trim()) add('meta.title', 'required non-empty string');
    const allowed = d.template === 'note-v1' ? NOTE_META : TEST_META;
    Object.keys(m).forEach((k) => { if (!allowed.includes(k)) warn('meta.' + k, 'unknown meta field'); else if (!isStr(m[k])) add('meta.' + k, 'must be a string'); });
  }

  const needsBody = d.status === 'done' || d.status === 'progress';
  if (d.template === 'note-v1') {
    if (!Array.isArray(d.sections)) add('sections', 'required array');
    else {
      if (needsBody && !d.sections.length) add('sections', `must not be empty when status is "${d.status}" (empty drafts are allowed only as pending)`);
      d.sections.forEach((s, i) => {
        const p = `sections[${i}]`;
        if (!isObj(s)) return add(p, 'must be an object');
        if (!isStr(s.heading) || !s.heading.trim()) add(p + '.heading', 'required non-empty string');
        if (!Array.isArray(s.blocks)) add(p + '.blocks', 'required array');
        else s.blocks.forEach((b, j) => validateBlock(b, `${p}.blocks[${j}]`, add, warn));
      });
    }
    if (d.questions !== undefined) warn('questions', 'ignored by note-v1');
  } else {
    if (!Array.isArray(d.questions)) add('questions', 'required array');
    else {
      if (needsBody && !d.questions.length) add('questions', `must not be empty when status is "${d.status}"`);
      d.questions.forEach((q, i) => {
        const p = `questions[${i}]`;
        if (!isObj(q)) return add(p, 'must be an object');
        if (!isStr(q.q) || !q.q.trim()) add(p + '.q', 'required non-empty string');
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8 || q.options.some((o) => !isStr(o) || !o.trim())) add(p + '.options', 'must be 2-8 non-empty strings');
        else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) add(p + '.answer', `must be an integer 0..${q.options.length - 1} (0-based option index)`);
        if (q.explanation !== undefined && !isStr(q.explanation)) add(p + '.explanation', 'must be a string');
      });
    }
    if (d.sections !== undefined) warn('sections', 'ignored by test-v1');
  }

  let size = 0;
  try { size = JSON.stringify(d).length; } catch { add('$', 'not serializable'); }
  if (size > MAX_ITEM_BYTES) add('$', `item larger than ${MAX_ITEM_BYTES} chars`);
  return { errors, warnings };
}

/** Validates the parsed import payload: object, array, or { items: [] } (the Export format). */
export function validateImport(j) {
  const list = Array.isArray(j) ? j : isObj(j) && Array.isArray(j.items) ? j.items : [j];
  const errors = [];
  let invalid = 0; // number of distinct invalid items
  list.forEach((d, i) => { const r = validateItem(d); if (r.errors.length) invalid++; r.errors.forEach((e) => errors.push({ path: `item ${i + 1} (${isObj(d) && (d.id || d.meta?.title) || '?'}) ${e.path}`, msg: e.msg })); });
  return { list, errors, invalid };
}
