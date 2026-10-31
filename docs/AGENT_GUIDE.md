# Agent guide: HQ to Studio handoff (medrise.bundle/1)

## Bundle
```
{ schema: "medrise.bundle/1", source: { id, path, template }, sha256, exportedAt, content }
```
- `content` = `{ id, template, meta, sections }` for `note-v1` or `{ id, template, meta, questions }` for `test-v1`. `status`, `schedule`, `title`, `_remote`, `_path` are never part of it.
- `sha256` = SHA-256, lowercase hex, of the UTF-8 bytes of the canonical JSON of `content`.
- Canonical JSON: object keys sorted by UTF-16 code unit order, no whitespace, arrays in order. `undefined`, NaN, Infinity (and functions) are rejected, not dropped.
- `source.path` is the repo path, e.g. `content/biology/plant-kingdom.json`.

## Rules
- Export only ids listed in `handoff/approved.json`, and only repository content. The file ships empty. Agents must not approve content; ask the owner.
- Never write back to HQ from Studio. Never change an existing id.
- `js/bundle.js` is the single implementation. Studio has its own copy of the verification logic (`scripts/hq-import.js`); both are pinned by the same `tests/fixtures/golden-bundle.json`. If you change canonicalisation, change both and regenerate the golden file.

## Commands
```
node tools/export-bundle.mjs <id> [out.json]   # approved repo items only
node --test tests/*.test.mjs
```
