# Changelog

## Unreleased: Phase 2 (HQ to Studio handoff)
- New `js/bundle.js`: `medrise.bundle/1` (canonical JSON + SHA-256 of `content`).
- New `handoff/approved.json` (ships EMPTY: nothing is approved until the owner lists ids). Viewer shows a **Studio bundle** button only for approved repository items; local imports can never be exported.
- New `tools/export-bundle.mjs` (CLI, approved items only), `tests/bundle.test.mjs`, `tests/fixtures/golden-bundle.json`, `docs/AGENT_GUIDE.md`.
- `store.js`: repo items record `_path`; `_path` is stripped from Export; `loadApproved()` / `isApproved()`.
- `sanitize-svg.js`: ids and `url(#id)` references get a per-instance prefix (`mrN-`), so two diagrams on one page cannot collide. Browser test expectation updated.
- Review fix (approval bypass): `_path` / `_remote` are stripped from every local import and from localStorage data; `isApproved()` now requires a matching item in the loaded repository collection (same id and path); the viewer exports the repository item itself (`store.repoItem`), never a local copy or override. Regression tests added.
- `sw.js`: precaches `js/bundle.js`, `/handoff/` is fetched fresh, cache `medrise-hq-v3`.

## Unreleased: P1 phase 1 (hardening)
- Explicit `id` on the 3 existing content files (values identical to the previous derived ids; no content change).
- New `js/sanitize-svg.js`: DOM-based allow-list sanitizer, fail-closed. `templates.js` svg blocks now render only sanitized SVG, otherwise a placeholder with the caption.
- New `js/validate.js` + `tools/validate.mjs`: content validator (CLI) shared with in-app import.
- `store.importText`: validates before saving, 2,000,000 character limit. Policy: **skip duplicates** (an id that already exists is skipped, never overwritten or renamed `-2`); any invalid item rejects the whole import (nothing written, never silently skipped). Returns/shows a summary: imported, skipped, rejected. Re-importing an Export file now imports only the new items.
- `schemas/`, `meta/taxonomy.json` (reference), `tests/` (Node + Chromium), `.github/workflows/validate.yml` (pull requests only; no deploy).
- `sw.js`: new modules precached, cache name bumped to `medrise-hq-v2`.
