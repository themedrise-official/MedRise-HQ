// medrise.bundle/1: the handoff format from HQ (content source of truth) to Studio.
// Pure ES module: runs in browsers and Node 20+ (uses globalThis.crypto.subtle).
export const SCHEMA = 'medrise.bundle/1';

// Canonical JSON: object keys sorted by UTF-16 code unit order, no whitespace, arrays in order.
// undefined / NaN / Infinity / functions / symbols / bigint are REJECTED (throws), never dropped.
export function canonicalJson(v) {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'string' || t === 'boolean') return JSON.stringify(v);
  if (t === 'number') {
    if (!Number.isFinite(v)) throw new Error('canonicalJson: non-finite number');
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return '[' + v.map((x) => canonicalJson(x)).join(',') + ']';
  if (t === 'object') {
    return '{' + Object.keys(v).sort().map((k) => {
      if (v[k] === undefined) throw new Error(`canonicalJson: undefined value at key "${k}"`);
      return JSON.stringify(k) + ':' + canonicalJson(v[k]);
    }).join(',') + '}';
  }
  throw new Error(`canonicalJson: unsupported type ${t}`);
}

// SHA-256 (lowercase hex) of the UTF-8 bytes of a string.
export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const hashContent = (content) => sha256Hex(canonicalJson(content));

// content = { id, template, meta, sections | questions }. status / schedule / title / _remote / _path are NOT content.
export function contentOf(item) {
  if (!item || typeof item !== 'object') throw new Error('no item');
  const c = { id: item.id, template: item.template, meta: item.meta };
  if (item.template === 'note-v1') c.sections = item.sections;
  else if (item.template === 'test-v1') c.questions = item.questions;
  else throw new Error(`template not supported for Studio bundle: ${item.template}`);
  const body = c.sections ?? c.questions;
  if (!Array.isArray(body) || !body.length) throw new Error('item has no content yet (nothing to export)');
  return c;
}

// item must be repo content (has _path). Approval is checked by the caller (store.isApproved / CLI).
export async function buildBundle(item, now = new Date()) {
  if (!item._path) throw new Error('only repository content can be exported (not local imports)');
  const content = contentOf(item);
  return {
    schema: SCHEMA,
    source: { id: item.id, path: 'content/' + item._path, template: item.template },
    sha256: await hashContent(content),
    exportedAt: now.toISOString(),
    content
  };
}

// Returns true when the bundle is well formed and its hash matches its content.
export async function verifyBundle(b) {
  return !!b && b.schema === SCHEMA && !!b.content && typeof b.sha256 === 'string' && (await hashContent(b.content)) === b.sha256;
}

export const bundleFileName = (id) => `${String(id).replace(/[^a-z0-9-]+/gi, '-')}.medrise-bundle.json`;

export function downloadBundle(bundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = bundleFileName(bundle.source.id);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
