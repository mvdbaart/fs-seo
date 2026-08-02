# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev          # both processes concurrently (API :3001 + Vite :3000)
npm run dev:server   # nodemon server/index.js only
npm run dev:client   # vite only
npm run build        # vite build -> dist/
npm run preview      # serve dist/ (no API proxy — backend must be reachable separately)
```

There is no test runner, linter, or formatter configured. Do not invent `npm test`/`npm run lint`; verify changes by running `npm run dev` and exercising the UI or hitting `http://localhost:3001/api/...` directly.

The Vite dev server proxies `/api` → `http://localhost:3001`, so the frontend always uses relative `/api/...` paths and never a hardcoded host.

## Architecture

Two-process app: an Express + SQLite backend (`server/`) and a Vite React SPA (`src/`). It is a Dutch-market SEO suite — site crawler ("Screaming Frog style"), Google.nl rank tracker, regional/GEO visibility, PageSpeed audits, and a single-page SEO doctor.

**Module systems differ per side.** `server/` is CommonJS (`require`/`module.exports`); `src/` is ESM. `package.json` has no `"type": "module"`, which is why the Vite config must stay named `vite.config.mjs`. Don't unify these without changing both.

### Backend

- `server/index.js` — every route lives here, grouped by feature with comment banners. Routes are thin: validate, call a service or run a `better-sqlite3` prepared statement, respond. Error handling is uniformly `try/catch` → `res.status(500).json({ error: ... })`, with Dutch message text.
- `server/db.js` — opens `seo_database.db` (WAL mode) and runs `initDb()` **at require time**. All `CREATE TABLE IF NOT EXISTS` statements live in one `db.exec` block. Schema migrations on existing installs follow the pattern at the bottom of the file: an idempotent `ALTER TABLE ... ADD COLUMN` wrapped in an empty `try/catch`. Add new columns in *both* places.
- `server/crawler.js` — `Crawler` class, BFS over same-origin links from a start URL, capped by `maxPages` (default 25 from the API). Uses axios + cheerio; a failed fetch pushes a placeholder row with `status_code` from the error so the crawl never aborts. Accepts an unused-by-the-API `onProgress` callback.
- `server/services/*.js` — one module per feature, each exporting plain functions. Services read/write the DB directly rather than going through a repository layer.

`better-sqlite3` is synchronous. Multi-row writes and cascading deletes use `db.transaction(...)` (see the project-delete route and the crawl insert loop).

### Data model

Everything is scoped by `project_id` (a project = one domain). `projects` → `keywords` → `keyword_rankings`, `crawl_sessions` → `crawled_pages`, plus `geo_rankings`, `pagespeed_audits`, `competitors`, and a key/value `settings` table. Foreign keys are declared but SQLite enforcement is not enabled — deletes are done manually and explicitly (`DELETE /api/projects/:id` deletes each child table in a transaction).

"Current ranking" is expressed as a LEFT JOIN with a correlated subquery picking the newest `keyword_rankings` row per keyword; that query is duplicated in `/api/keywords` and the dashboard route — keep them in sync.

JSON is stored as TEXT (`serp_features`, `diagnostics`, `broken_links`) and parsed at the API boundary before responding.

### External APIs and key resolution

- **SERP data**: Serper.dev (`POST https://google.serper.dev/search`) with `gl: 'nl'`, `hl: 'nl'` and a `location` string. Rank = 1-based index of the first organic result whose link contains the project's bare domain; `0` means "not found in the requested range". Every ranking check also stores a top-20 SERP snapshot in `keyword_rankings.organic_results` (JSON); the competitor-gap and cannibalization analysis are computed offline from those snapshots, never via extra API calls.
- **PageSpeed**: Google PageSpeed Insights v5 REST API. A failed call now throws (Dutch error message) — there is no mock fallback.
- **Google Search Console**: real integration via `services/gscClient.js` using a **service account** (the GSC API does not accept plain API keys — `FS_SEO_GSC_API` in `.env.local` is a 39-char API key and therefore unusable for GSC). Credentials resolve: `FS_GSC_SERVICE_ACCOUNT` (path or inline JSON) → `GOOGLE_APPLICATION_CREDENTIALS` → settings row `gsc_service_account_json` (pasted via the Settings UI). JWT signing is hand-rolled with node `crypto` (no googleapis dependency). `services/gscAnalyzer.js` returns live clicks/impressions/CTR when configured (`gscConnected: true`); otherwise it falls back to the project's own stored rankings with `null` for the unknown metrics — nothing is fabricated. `GET /api/settings` returns only a `gsc_connected` boolean, never the service-account JSON.

API keys resolve through the same cascade: `FS_*` env var → legacy env aliases → the `settings` table row. Keys live in `.env.local` (loaded by `server/index.js` before `.env`): `FS_SEO_PAGESPEED_API`, `FS_SERPER_API`. `GET /api/settings` includes the `FS_*` names in its fallback.

### Live data guarantees

All endpoints derive from real sources (Serper, PageSpeed, GSC, own crawl data, settings). Honest empty states replace the former hardcoded stubs:

- `services/aiAdvisor.js` generates recommendations from the latest crawl, rankings, PageSpeed audit and geo data for the given `projectId`.
- `POST /api/keywords` performs a live Serper check on insert; without an API key the position stays `null` ("Nog niet gecheckt" in the UI). `search_volume` is `null` — Serper does not provide volumes.
- `services/geoAnalyzer.js` no longer seeds sample keywords and `getGeoAnalysis` is a pure read; scans run only via `POST /api/projects/:id/geo/check`. Local-pack matching uses the project's domain/name, not a literal string.
- `services/seoToolsService.js`: local-pack audit reads `geo_rankings` + NAP settings (`business_name/address/phone`); citations are a manual checklist (never claimed "verified"); the internal-link matrix computes real inbound counts from `crawled_pages.internal_links` (JSON link graph persisted per crawl) and returns a `message` field when a (re)crawl is needed; competitor gap reads the stored SERP snapshots and the `competitors` table.
- When data is missing, endpoints return a Dutch `message` explaining which action (crawl / ranking check / geo scan / GSC koppeling) produces it. Keep this pattern — do not reintroduce fabricated numbers.

### FrisseStart-specific hardcoding

Mostly removed; what remains: `geoAnalyzer.js` has a fixed `REGIONS` array (Geldrop/Nuenen/Eindhoven/Helmond/Utrecht/Amsterdam/Rotterdam), `RankTrackerView.jsx` offers those cities in its region dropdown, and `App.jsx` auto-creates a `FrisseStart` / `https://frissestart.nl` project when none exist.

### Frontend

`src/App.jsx` is the whole shell: a `activeTab` string switches between the nine views in `src/components/`, and it owns `activeProject` / `allProjects` / `dashboardData`. There is no router, no state library, and no shared API client — each view does its own `fetch` in a `useEffect` and keeps local `useState`. `projectId` is passed down as a prop and views defensively fall back to `projectId || 1`.

Styling is a single global `src/index.css`: design tokens as CSS custom properties under `:root` (green `--primary: #059669` FrisseStart palette) plus semantic classes (`.card`, `.card-title`, `.btn btn-primary|secondary|danger`, `.badge badge-success|danger|warning|info`, `.input-field`, `.rec-card type-*`). Components combine those classes with inline `style` objects that reference the same `var(--token)` names. No CSS modules, no Tailwind, no component library — match this pattern rather than introducing one.

Icons come from `lucide-react`, charts from `recharts`, and PDF export is client-side `jspdf` (`ReportsView.jsx`, which also does a manual data-URI CSV download).

## Conventions

- **All user-facing text is Dutch** — UI labels, button text, validation messages, and API error strings (`'URL is verplicht'`). Code identifiers and comments are English. Keep this split.
- Domains are normalized on input with `domain.startsWith('http') ? domain : \`https://${domain}\`` and stripped for matching with `.replace(/^https?:\/\//, '').replace(/\/.*$/, '')`. Reuse these rather than adding a URL utility.
- The repo is not a git repository and `.gitignore` is empty. `node_modules/`, `dist/`, `seo_database.db*` (including the `-wal`/`-shm` files) and `.env.local` all sit untracked in the working directory — do not commit or delete them casually.
