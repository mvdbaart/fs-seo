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

### Authentication

Every `/api` route except `/api/auth/*` requires a session. `server/auth/` holds the whole layer: `totp.js` (otplib wrapper), `service.js` (users/sessions/enrollment/recovery/throttle), `cookies.js` (hand-rolled parse + `Set-Cookie`), `middleware.js` (`requireAuth`/`requireAdmin`), `routes.js` (an `express.Router`), and `invite.js` (CLI).

**Middleware order in `server/index.js` is load-bearing.** Express matches in declaration order, so `app.use('/api/auth', authRouter)` and then `app.use('/api', requireAuth)` must stay directly under `express.json()`, above the ~60 inline routes. Mounting the public router on its own prefix is what avoids a skip-list — do not add one. `app.use(cors())` was removed deliberately: it sent `Access-Control-Allow-Origin: *`, which let any site read `GET /api/settings` and its API keys. Set `FS_SEO_CORS_ORIGINS` (explicit comma-separated list) only if a genuine cross-origin client appears.

Login is passwordless: e-mail + a 6-digit TOTP code, no password column. Accounts are created by an admin (Instellingen → Gebruikers) or from the CLI:

```bash
node server/auth/invite.js jan@frissestart.nl "Jan" admin
```

That prints a `/?enroll=<token>` link, valid 48 hours. **The first admin can only be created this way** — there is no bootstrap route, because "allowed while the users table is empty" is a land-grab race on a public domain. Re-running it on an existing address is also the "TOTP resetten" path: it wipes the secret, sessions and recovery codes.

otplib v13 gotchas (it is a rewrite of v12, most tutorials online are wrong): there is no `authenticator` export; `verify`/`verifySync` return `{valid, timeStep, ...}`, never a boolean, so `if (verify(...))` is always truthy; the tolerance option is `epochTolerance` **in seconds**, not `window` in steps; replay protection is built in via `afterTimeStep` (persisted as `users.last_totp_step`); and `verify` *throws* — rather than returning `{valid:false}` — when the stored step is ahead of now (clock rollback, restored `.db`), which is why `verifyTotp` wraps it in `try/catch`.

Auth tables (`users`, `sessions`, `recovery_codes`, `login_attempts`) store timestamps as **epoch-ms `INTEGER`**, unlike the `DATETIME DEFAULT CURRENT_TIMESTAMP` used elsewhere — SQLite's format has no timezone suffix and `Date.parse` reads it as local time, which silently breaks the throttle and expiry maths.

On the frontend, `src/App.jsx` gates the whole shell on `GET /api/auth/me` and only then runs the dashboard bootstrap (behind a `useRef`, because that path auto-creates a project and StrictMode double-fires). `src/main.jsx` installs a `window.fetch` **and** an axios interceptor — both are needed, since `AiPromptCanvas.jsx` uses axios/XHR, which a fetch wrapper cannot see. They key on the `X-Auth-Required` response header, not on the 401 status, so a wrong code on the login form doesn't get mistaken for an expired session. Individual components need no changes: the session cookie is httpOnly and same-origin, so it rides along automatically.

In production Express serves `dist/` with a SPA catch-all (only when `NODE_ENV=production`), so the UI and API share one origin — which is what the cookie needs. Serve `dist/` only; the repo root holds `seo_database.db`, `.env.local` and a Google service-account key.

Optional env vars: `FS_SEO_TOTP_ISSUER` (name shown in the authenticator app), `FS_SEO_BASE_URL` (used by the CLI to print the enroll link), `FS_SEO_CORS_ORIGINS`.

### Data model

Everything is scoped by `project_id` (a project = one domain). `projects` → `keywords` → `keyword_rankings`, `crawl_sessions` → `crawled_pages`, plus `geo_rankings`, `pagespeed_audits`, `metric_snapshots`, `competitors`, and a key/value `settings` table. Deletes are done manually and explicitly (`DELETE /api/projects/:id` deletes each child table in a transaction) — add any new child table to that transaction.

Note: `better-sqlite3` enables `PRAGMA foreign_keys` **by default**, so the declared foreign keys *are* enforced. Inserting a row for a non-existent `project_id` throws `SQLITE_CONSTRAINT_FOREIGNKEY`. (The manual cascade deletes above are therefore belt-and-braces, not the only mechanism.)

`metric_snapshots` stores one row per `(project_id, source, metric, day)` — `source` is `gsc|ga4|rankings|pagespeed|crawl`, `value` is REAL (CTR, CLS and positions are fractional), `meta` is JSON TEXT. A `UNIQUE INDEX` plus `INSERT ... ON CONFLICT DO UPDATE` is the dedupe strategy, so re-running a capture is free and late-arriving GSC data (which lags 2–3 days) self-corrects. This table exists because GSC itself only keeps 16 months and the GSC/GA4 clients cache in-memory only: without it no long-term trend survives a restart. Written from `services/metricSnapshots.js` — never insert into the table directly.

"Current ranking" is expressed as a LEFT JOIN with a correlated subquery picking the newest `keyword_rankings` row per keyword; that query is duplicated in `/api/keywords` and the dashboard route — keep them in sync.

JSON is stored as TEXT (`serp_features`, `diagnostics`, `broken_links`) and parsed at the API boundary before responding.

### External APIs and key resolution

- **SERP data**: Serper.dev (`POST https://google.serper.dev/search`) with `gl: 'nl'`, `hl: 'nl'` and a `location` string. Rank = 1-based index of the first organic result whose link contains the project's bare domain; `0` means "not found in the requested range". Every ranking check also stores a top-20 SERP snapshot in `keyword_rankings.organic_results` (JSON); the competitor-gap and cannibalization analysis are computed offline from those snapshots, never via extra API calls.
- **PageSpeed**: Google PageSpeed Insights v5 REST API. A failed call now throws (Dutch error message) — there is no mock fallback.
- **Google Search Console**: real integration via `services/gscClient.js` using a **service account** (the GSC API does not accept plain API keys — `FS_SEO_GSC_API` in `.env.local` is a 39-char API key and therefore unusable for GSC). Credentials resolve: `FS_GSC_SERVICE_ACCOUNT` (path or inline JSON) → `GOOGLE_APPLICATION_CREDENTIALS` → settings row `gsc_service_account_json` (pasted via the Settings UI). JWT signing is hand-rolled with node `crypto` (no googleapis dependency). `services/gscAnalyzer.js` returns live clicks/impressions/CTR when configured (`gscConnected: true`); otherwise it falls back to the project's own stored rankings with `null` for the unknown metrics — nothing is fabricated. `GET /api/settings` returns only a `gsc_connected` boolean, never the service-account JSON.

- **Google Analytics 4**: real integration via `services/ga4Client.js`, built on the same hand-rolled service-account JWT as `gscClient.js` (own token cache — different scope, `analytics.readonly`). It uses **two** Google APIs and both must be enabled *in the same Cloud project as the service account*: the **Data API** (`analyticsdata.googleapis.com`) returns the numbers, the **Admin API** (`analyticsadmin.googleapis.com`) only lists properties. Enabling the Admin API alone yields zero metrics — that is the single most likely cause of an empty GA4 view. Property ID resolves `FS_GA4_PROPERTY_ID` → `projects.ga4_property_id` → settings `ga4_property_id` → **auto-detected** via `accountSummaries` when the service account sees exactly one property (`GET /api/ga4/properties`). `normalizePropertyId` rejects `G-…`/`UA-…` with a Dutch explanation, because pasting the measurement ID is the most common mistake.
  Two gotchas: (1) never send two `dateRanges` in one `runReport` — the API then injects a hidden `dateRange` dimension column that silently shifts every `dimensionValues` index; the current/previous comparison is therefore two separate calls via `Promise.all`. (2) `conversions` was renamed `keyEvents` in 2024; `runReportWithKeyEvents` tries the new name, falls back once to the old one, remembers which worked, and reports `null` (never `0`) if neither exists.
- **Google Ads**: `services/googleAdsLiveService.js` via the `google-ads-api` package. The Ads API accepts **neither** an API key **nor** a plain service account (that needs Workspace domain-wide delegation), so it has its own credential set: `google_ads_developer_token`, `google_ads_client_id`, `google_ads_client_secret`, `google_ads_refresh_token`, `google_ads_customer_id`, plus optional `google_ads_login_customer_id` for MCC accounts. Each resolves env-first then settings row. Incomplete credentials return `{connected: false, summary: null, message}` naming exactly what is missing — never numbers. Costs come back in micros (÷ 1e6).

API keys resolve through the same cascade: `FS_*` env var → legacy env aliases → the `settings` table row. Keys live in `.env.local` (loaded by `server/index.js` before `.env`): `FS_SEO_PAGESPEED_API`, `FS_SERPER_API`. `GET /api/settings` includes the `FS_*` names in its fallback.

`GET /api/settings` strips everything in `SECRET_SETTING_KEYS` (the GSC service-account JSON and all four Ads secrets) and returns only `gsc_connected` / `google_ads_connected` booleans. The Settings UI sends a secret **only when the field is non-empty**, so leaving it blank means "unchanged" rather than "erase".

### Insights & advice layer

`GET /api/projects/:id/insights?days=28[&refresh=1]` is the cross-source answer to "what got better, what got worse, and what should I do". Three files, deliberately separated:

- `services/insightsEngine.js` — data only, no prose. `buildWindows(days, lagDays=3)` yields a current and previous window (GSC lags 2–3 days, GA4 ~1, so one shared window keeps sources comparable). Five collectors (GSC, GA4, rankings, PageSpeed, crawl) run under `Promise.allSettled`, so one broken source degrades to an honest `{connected:false, message}` instead of failing the request. Results cache 10 minutes per `projectId:days`; without that cache every tab switch fires ~10 Google calls. **Do not mount this on `GET /api/projects/:id/dashboard`** — that route must stay fast.
- `services/insightsNarrator.js` — plain Dutch, synchronous, no network, so the screen always shows something true even with no AI key. One sentence template per signal id; `buildAdvice` reuses the `{type,title,description,action}` shape and the house grammar from `aiAdvisor.js`. `buildInsightsPrompt` feeds the optional LLM **only the already-computed numbers**, so it cannot invent figures; it renders through the existing `<AiPromptCanvas>` → `POST /api/ai/generate`, which means the AI pass is opt-in by construction and needs no new route.
- `services/metricSnapshots.js` — persistence (see the data-model note above).

**`makeSignal()` is the only place sentiment is decided**, and it is the highest-risk logic in this layer:

```js
const sentiment = direction === 'flat' ? 'neutral'
  : ((direction === 'up') !== lowerIsBetter ? 'positive' : 'negative');
```

`lowerIsBetter: true` applies to `gsc.position`, `ga4.bounceRate`, `pagespeed.lcp/cls`, `crawl.errors`, `rankings.avgPosition`. An average position moving 8.0 → 5.0 is `direction:'down'` **and** `sentiment:'positive'`. Any collector that computes its own sentiment is a bug. A `THRESHOLDS` table (`minAbs`/`minPct`/`minBase`) suppresses noise — `minBase` is what stops 2 → 4 clicks reading as "+100%". When `previous === 0`, `deltaPct` is `null`, so every template using it needs a null branch or it prints `Infinity%`.

`aiAdvisor.js` stays separate and untouched: it describes *state* ("12 pagina's zonder title"), the narrator describes *change*. Same output shape, so the same `.rec-card type-*` markup renders both.

Snapshots are written opportunistically on every insights build and explicitly after a crawl, a PageSpeed audit and a ranking check (`captureSnapshots` / `captureRankingSnapshots` in `server/index.js`), plus hourly from `runHourlyTasks` so history keeps growing when nobody opens the dashboard. Snapshot failures are logged and swallowed — they must never break a response.

⚠️ On Vercel `server/db.js` copies the database to `/tmp`, so snapshots written in a serverless invocation are ephemeral. Long-horizon history only accrues on a persistent host.

This renders **on the dashboard**, not in a separate tab: `DashboardView.jsx` fetches the endpoint itself and shows a story card, "Wat gaat goed" / "Wat gaat minder", a movers table, the advice list, a "wat we nog niet kunnen meten" block and the `AiPromptCanvas`. While loading or on error it renders nothing, so the rest of the dashboard is never blocked by it.

### Live data guarantees

All endpoints derive from real sources (Serper, PageSpeed, GSC, own crawl data, settings). Honest empty states replace the former hardcoded stubs:

- `services/aiAdvisor.js` generates recommendations from the latest crawl, rankings, PageSpeed audit and geo data for the given `projectId`.
- `POST /api/keywords` performs a live Serper check on insert; without an API key the position stays `null` ("Nog niet gecheckt" in the UI). `search_volume` is `null` — Serper does not provide volumes.
- `services/geoAnalyzer.js` no longer seeds sample keywords and `getGeoAnalysis` is a pure read; scans run only via `POST /api/projects/:id/geo/check`. Local-pack matching uses the project's domain/name, not a literal string.
- `services/seoToolsService.js`: local-pack audit reads `geo_rankings` + NAP settings (`business_name/address/phone`); citations are a manual checklist (never claimed "verified"); the internal-link matrix computes real inbound counts from `crawled_pages.internal_links` (JSON link graph persisted per crawl) and returns a `message` field when a (re)crawl is needed; competitor gap reads the stored SERP snapshots and the `competitors` table.
- `services/ga4ClarityService.js` reads live GA4 figures through `ga4Client`. It previously returned a hardcoded fixture (3.150 sessions, 27 rage clicks, 2,4% conversie) and `Ga4ClarityView.jsx` layered a *second* set of fake fallbacks on top (`{totals.x || '3.150'}`) — both are gone. Microsoft Clarity has no automatic integration (its Data Export API needs a token this app does not manage), so rage/dead clicks are not reported at all; the Clarity project ID only builds a deep link to the Clarity dashboard.
- `services/googleAdsLiveService.js` used to perform a real service-account handshake, discard the token, and return fixed totals (€19.455,66) with an unconditional `statusMessage: '...succesvol gekoppeld!'`. It now runs a real GAQL query or reports honestly that it is not connected.
- `services/gbpService.js` derives `profileHealthScore` from a real five-point checklist (or `null` when not connected) instead of the former `connected ? 92 : 65`, and its review advice is built from the project's own keywords rather than hardcoded FrisseStart terms. NAP fallbacks are `null` + `napMessage`, not invented company details.
- `DashboardView.jsx` no longer falls back to `78/100` and `2.4s` for PageSpeed; missing data renders `—` with "Nog geen audit uitgevoerd".
- When data is missing, endpoints return a Dutch `message` explaining which action (crawl / ranking check / geo scan / GSC koppeling / GA4 property-rechten) produces it. Keep this pattern — do not reintroduce fabricated numbers, and do not add `|| '<some number>'` fallbacks in the views either.

### FrisseStart-specific hardcoding

Mostly removed; what remains: `geoAnalyzer.js` has a fixed `REGIONS` array (Geldrop/Nuenen/Eindhoven/Helmond/Utrecht/Amsterdam/Rotterdam), `RankTrackerView.jsx` offers those cities in its region dropdown, and `App.jsx` auto-creates a `FrisseStart` / `https://frissestart.nl` project when none exist.

### Frontend

`src/App.jsx` is the whole shell: an `activeTab` string switches between the ~17 views in `src/components/` (grouped in the sidebar under "Analyse & Rankings" and "Optimization Tools"), and it owns `activeProject` / `allProjects` / `dashboardData`. There is no router, no state library, and no shared API client — each view does its own `fetch` in a `useEffect` and keeps local `useState`. `projectId` is passed down as a prop and views defensively fall back to `projectId || 1`.

Styling is a single global `src/index.css`: design tokens as CSS custom properties under `:root` (green `--primary: #059669` FrisseStart palette) plus semantic classes (`.card`, `.card-title`, `.btn btn-primary|secondary|danger`, `.badge badge-success|danger|warning|info`, `.input-field`, `.rec-card type-*`). Components combine those classes with inline `style` objects that reference the same `var(--token)` names. No CSS modules, no Tailwind, no component library — match this pattern rather than introducing one.

### Responsive

Two breakpoints at the bottom of `src/index.css`, and **nothing above 900px is affected** — desktop rendering is byte-for-byte what it was.

- **≤900px** — the fixed 220px sidebar becomes an off-canvas drawer (`.sidebar.open`, `.sidebar-overlay.open`), toggled by `mobileNavOpen` in `App.jsx`. Escape and a tap on the overlay close it; the handler on `<ul className="nav-list">` closes it when a `.nav-item` is clicked but *not* when a group header is expanded. Body scroll is locked while open. This block also carries the **overflow guards**.
- **≤640px** — collapses every inline column layout to one column and stacks `.input-group` forms.

Because layout lives in inline `style` objects, the guards are written as attribute selectors (`[style*="display: flex"]`, `[style*="grid-template-columns"]`). That is deliberate and scoped entirely inside the media queries. The load-bearing part is `min-width: 0` / `max-width: 100%`: grid and flex items default to `min-width: auto`, so they refuse to shrink below their content, and a single wide table or a bare URL stretches its column — and therefore the page. Note that `.input-group`, `.card-title` and `.stat-header` get `display: flex` from the stylesheet rather than an inline style, so the attribute selectors miss them and they are listed by name.

Set a new inline `gridTemplateColumns` anywhere and it collapses on mobile automatically; no per-component work needed. Two caveats worth knowing:

- `.app-container` has `overflow-x: hidden`, which **hides** horizontal overflow rather than fixing it. Delete it temporarily when checking a new view, otherwise `scrollWidth` will always look clean.
- Charts inside a horizontally scrolling `.table-container` (the expandable row in `RankTrackerView.jsx`) size to the *scroll* width, not the viewport — hence the `position: sticky` + `calc(100vw - …)` cap there.

Icons come from `lucide-react`, charts from `recharts`, and PDF export is client-side `jspdf` (`ReportsView.jsx`, which also does a manual data-URI CSV download).

## Conventions

- **All user-facing text is Dutch** — UI labels, button text, validation messages, and API error strings (`'URL is verplicht'`). Code identifiers and comments are English. Keep this split.
- Domains are normalized on input with `domain.startsWith('http') ? domain : \`https://${domain}\`` and stripped for matching with `.replace(/^https?:\/\//, '').replace(/\/.*$/, '')`. Reuse these rather than adding a URL utility.
- The repo is not a git repository and `.gitignore` is empty. `node_modules/`, `dist/`, `seo_database.db*` (including the `-wal`/`-shm` files) and `.env.local` all sit untracked in the working directory — do not commit or delete them casually.
- **Git / Deployment**: Do not automatically push to GitHub or Vercel after making changes. Always wait for explicit instruction from the user before running `git push`. This allows the user to batch changes and review them locally.
