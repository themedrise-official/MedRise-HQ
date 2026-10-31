# MedRise HQ: rules for AI writers

You write content as JSON files inside `content/` (any subfolder, e.g. `content/biology/`).
Never edit `js/`, `css/` or templates. Never write `content/index.json` (it is generated).
Work on a branch, never on `main`. One chapter or test = one file.

## Common fields
```json
{
  "template": "note-v1",
  "status": "pending",
  "schedule": { "date": "2026-11-05", "time": "18:00" },
  "meta": { "title": "...", "subtitle": "...", "class": "Class 11", "chapter": "Ch 3" }
}
```
- `status`: `pending` | `progress` | `done`. `schedule` is optional.
- Inline text supports `**bold**` and `*italic*` only. No HTML.
- Language: Hinglish, simple, NEET focused. Keep facts NCERT accurate.

## note-v1 (frozen: do not invent new block types)
`meta`: `title`, `subtitle`, `class`, `chapter`, `crumb` (short chapter name), `syllabus_label`, `syllabus` (both optional).
`sections`: list of `{ "heading": "1. ...", "blocks": [ ... ] }`. Block types:
- `{ "type": "bullets", "items": ["...", "..."] }`
- `{ "type": "table", "head": ["A","B"], "rows": [["...","..."]] }`
- `{ "type": "sub", "text": "Small blue heading" }`
- `{ "type": "p", "text": "Paragraph" }`
- `{ "type": "note", "text": "Callout / tip" }`
- `{ "type": "svg", "svg": "<svg viewBox=...>...</svg>", "caption": "..." }` (diagram, inline SVG only)

## test-v1
`meta`: `title`, `subtitle`, `class`, `subject`, `time`.
`questions`: list of `{ "q": "...", "options": ["A","B","C","D"], "answer": 0, "explanation": "..." }`. `answer` is the 0-based option index.

## Add a new template (only when the owner asks)
Add a function in `js/templates.js`, register it in `TEMPLATES` under a new versioned name (e.g. `paper-v1`), and document it here. Never change an existing versioned template.

## Stable `id` (required for files in `content/`)
Every JSON file in `content/` must have an explicit `"id"`. It must equal the file path under `content/`, without `.json`, lowercased, with every run of non-alphanumeric characters replaced by one hyphen. Example: `content/biology/plant-kingdom.json` has id `biology-plant-kingdom`. Never change an existing id: status and schedule saved in the browser are keyed by it. Pasted/imported items may omit `id`; it is then derived from the title, and an id that already exists is skipped (never overwritten or renamed). Invalid items reject the whole import.

## svg blocks
- Allowed tags: `svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient radialGradient stop title desc`. The root `<svg>` needs a `viewBox` and must be well-formed XML (every tag closed).
- Not allowed (removed at render, and rejected by the validator): `script`, `style` (tag or attribute), `foreignObject`, `a`, `use`, `image`, `animate`, `set`, `href`/`xlink:href`, `on*` handlers, `data:`/`javascript:` URLs, external `url(...)` (only `url(#id)` for gradients).
- Max 100000 characters per svg. If an svg cannot be sanitized, the page shows "[Diagram unavailable]" plus the caption. Always write a meaningful `caption`.

## Validate before you open a PR
```
node tools/validate.mjs
```
It exits non-zero on any error. Empty drafts are allowed only with `"status": "pending"`; `progress`/`done` need real content. In `test-v1`, `answer` must be a valid 0-based option index.

## Studio handoff (Phase 2)
HQ is the source of truth; Studio imports from it. HQ never receives anything back.
- `handoff/approved.json` = `{ "approved": ["<id>", ...] }`. **Only the owner edits it.** AI writers must never add ids to it. It ships empty.
- Only repository items (files in `content/`) listed there can be exported as a `medrise.bundle/1` file (viewer button "Studio bundle", or `node tools/export-bundle.mjs <id>`). Local imports can never be exported.
- Changing the content of an item changes its bundle hash. Status and schedule are not part of the bundle.
- SVG blocks: ids inside an svg are renamed with a per-diagram prefix when rendered, so use simple ids (`g1`) and refer to them only as `url(#g1)` in `fill` / `stroke`.
