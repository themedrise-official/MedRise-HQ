# MedRise HQ

Personal content studio for MedRise: notes, tests and (soon) papers from JSON, with a dashboard, calendar and print-ready PDF export. No build step, no dependencies, no login.

## Run locally
```
python3 -m http.server 8080
```
Open http://localhost:8080 (the service worker needs http, not file://).

## Deploy (free, GitHub Pages)
1. Push this folder to its own repo (not the main MedRise site repo).
2. Repo Settings, Pages, Source: **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds the content index and publishes the site.

## Install like an app
- Android/Chrome: open the site, tap **Install app** (or menu, Install).
- iPhone/Safari: Share, then **Add to Home Screen**.
The icon and name come from `manifest.webmanifest` and `icons/`.

## Add content
- **By AI (recommended):** give the AI `RULES.md`. It writes JSON into `content/` on a branch. Merge, and the site updates.
- **Quick, device only:** Import page, paste JSON. Stored in your browser only; use Export to back up.
- Status and dates you set in the app are saved in your browser. To make them permanent, put `status` / `schedule` in the JSON file.

## PDF
Open an item, tap **PDF / Print**, choose "Save as PDF" (A4, turn on "Background graphics" if your browser asks).

## Dashboard commands
`list`, `status <name> done|progress|pending`, `schedule <name> 2026-11-05 18:00` (also `today`, `tomorrow`), `open <name>`, `export`.

## Folders
`js/` app code and templates, `css/` styles, `content/` your JSON, `icons/` app icons, `tools/` index builder.

## Validate and test
```
node tools/validate.mjs                  # content rules (read-only, exit 1 on errors)
node --test tests/*.test.mjs             # Node unit tests (validator, store, templates)
node tests/browser/run.mjs               # real Chromium sanitizer tests (needs: npm i --no-save playwright && npx playwright install chromium)
```
The Node tests do not prove SVG safety; the sanitizer needs a real browser DOM, and the browser tests are the security check. Without a DOM the sanitizer refuses to render untrusted SVG and a placeholder is shown.

## Studio handoff (Phase 2)
`medrise.bundle/1` carries one approved note/test from HQ to MedRise Studio ("Import from HQ" on Studio's My Projects page).
1. Owner adds the item id to `handoff/approved.json` (ships empty; nothing is approved silently).
2. Open the item in HQ and tap **Studio bundle** (or `node tools/export-bundle.mjs <id> [out.json]`).
3. In Studio: My Projects, **Import from HQ**, choose the file. A new project is created; HQ is never written to.
Format and hashing rules: `docs/AGENT_GUIDE.md`.
