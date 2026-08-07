Paste everything below into a Claude Code session started in the `fs-next` repo.

---

You are working in `fs-next`, the Next.js App Router codebase behind https://frissestart.nl. An SEO audit crawled all 190 sitemap URLs plus 60 more found by following links, and traced each finding to source. Line numbers below refer to commit `68cdd6f`; verify them before editing, since the file may have moved on.

Repository conventions to follow: all user-facing text is Dutch, code identifiers and comments are English. Match the surrounding style rather than introducing new patterns.

Work through the tasks in order. Tasks 1-7 belong in a single PR. Task 8 is an investigation — report what you find rather than guessing at a fix.

## 1. Replace the client-side redirects with real 301s

`src/app/code95-gids/page.tsx` is a `'use client'` component that calls `router.replace('/lp/code95-gids')` inside a `useEffect`. Crawlers do not run it, so Googlebot sees a 200 response containing a loading spinner — 128 words, no `<h1>`, no canonical. The page sits in the sitemap and receives zero internal links, while the real landing page `/lp/code95-gids` is linked from all 188 pages but is absent from the sitemap.

`src/app/3-daagse-code-95-opleiding-korting/page.tsx` is a weaker duplicate of `/3-daagse-code-95-korting` (574 words versus 1812, one `<h2>` versus five, no FAQ schema, no canonical, zero inbound links). The two compete for the same query.

Delete both route directories and add permanent redirects to `next.config.ts`, alongside the existing `headers()`:

```ts
async redirects() {
  return [
    { source: '/code95-gids', destination: '/lp/code95-gids', permanent: true },
    { source: '/3-daagse-code-95-opleiding-korting', destination: '/3-daagse-code-95-korting', permanent: true },
  ];
},
```

## 2. Fix the sitemap

In `src/app/sitemap.ts`:

- Remove `/3-daagse-code-95-opleiding-korting` (line 18) and `/code95-gids` (line 40) from `staticRoutes` — both become redirects in task 1.
- Add `/lp/code95-gids`, which is currently missing despite being the most-linked page after the homepage.
- Add `lastModified` to every entry in `staticRoutes`. All 46 static URLs currently lack it, including `/`, `/opleidingen` and `/opleidingen/code-95-opleidingen`. Google ignores `changeFrequency` and `priority` but does use `lastModified`, so the array presently supplies only the fields that are discarded. The dynamic sections (blog, vacatures, opleidingen, kennisbank) already pull `lastModified` from Supabase correctly — leave those alone.

Use a real date. A constant that never changes is worse than no value, since it tells Google the page changed when it did not.

## 3. Remove duplicated branding from titles

`src/app/layout.tsx:68` already applies `template: '%s | FrisseStart'`. Five call sites append the brand a second time, producing titles like `Certificeringsbeheer voor transport en logistiek: houd je eenvoudig overzicht over al je certificaten - FrisseStart Blog | FrisseStart` at 134 characters. 129 of 190 titles exceed 60 characters; 54 of those are caused solely by this duplication.

Strip the suffix at each site and let the template supply it:

| File | Line | Change |
|---|---|---|
| `src/app/blog/[slug]/page.tsx` | 36 | `` `${post.title} - FrisseStart Blog` `` becomes `post.title` |
| `src/app/vacatures/[slug]/page.tsx` | 45-46 | drop `- FrisseStart Vacatures` from both the filled and unfilled variants |
| `src/app/kennisbank/[slug]/page.tsx` | 64 | drop `\| FrisseStart Kennisbank` from the fallback |
| `src/app/kennisbank/[slug]/[spoke]/page.tsx` | 48 | drop `\| FrisseStart Kennisbank` from the fallback |
| `src/app/lp/[slug]/page.tsx` | 39 | `` `${data.name} \| FrisseStart` `` becomes `data.name` |

Both kennisbank files prefer a database value (`domain.meta_title`, `article.meta_title`) over the fallback. Check whether those columns also contain the brand name; if they do, the duplication survives the code change and needs fixing in the data.

## 4. Add a canonical to `/lp/[slug]`

`src/app/lp/[slug]/page.tsx` returns metadata without a canonical, even though `/lp/code95-gids` is linked from all 188 pages. Add `alternates: { canonical: … }` to the returned `Metadata` object around line 47, or route it through the existing `getPageSeoMetadata()` helper, which sets canonical, OpenGraph and Twitter tags together — the approach used elsewhere in the codebase.

## 5. Make the local landing pages eligible for Course rich results

`src/lib/schema.tsx:242` exposes `courseJsonLd()`, documented as a "compacte Course-node voor landingspagina's". It emits only `name`, `description`, `url` and `provider`. Google requires both `offers` and `hasCourseInstance` for Course rich results, so every page using this helper is structurally ineligible.

Ten pages call it, and they are the most commercially valuable ones on the site: `heftruck-cursus-eindhoven`, `heftruck-cursus-nuenen`, `heftruck-cursus-helmond`, `heftruck-cursus-geldrop`, `heftruck-cursus`, `reachtruck-cursus-eindhoven`, `reachtruck-cursus-helmond`, `vca-eindhoven`, `bhv-cursus-eindhoven`, `code-95-eindhoven`.

Extend the helper with optional `price` and `instances` parameters that produce `offers` and `hasCourseInstance`. Follow the shape already used in `src/app/opleidingen/[slug]/page.tsx:196-245`, which builds a complete Course node.

Only emit `offers` where the real price is known, and only emit `hasCourseInstance` from real scheduled dates. Structured data that does not match the visible page is a Google policy violation. If a price is unavailable for a given page, leave the field out and say so in your summary rather than inventing a value.

## 6. Emit a CourseInstance for e-learning variants

`src/app/opleidingen/[slug]/page.tsx:235` adds `hasCourseInstance` only when `sessions.length > 0`. That is correct for classroom courses, but e-learning has no fixed start date, so those variants never qualify.

Add a branch for variants where `elearning_enabled` is true, emitting a `CourseInstance` with `courseMode: 'Online'` and `courseWorkload` as an ISO 8601 duration derived from `elearning_hours`, instead of a `startDate`. This describes e-learning accurately without fabricating a date.

Context: 28 of 30 active course variants currently have no future scheduled dates, of which 9 are e-learning. The other 19 are a scheduling problem, not a code problem — do not work around them here.

## 7. Render one `#organization` block per page

`src/lib/schema.tsx:55-60` documents an assumption that parsers merge separate JSON-LD blocks sharing an `@id`. That is how JSON-LD is specified, but Google does not guarantee it across separate `<script>` tags carrying different properties, and the property at risk is `aggregateRating`.

The block is rendered three times:

- `src/app/layout.tsx:179` — no rating
- `src/app/page.tsx:132` — with rating
- `src/app/reviews/page.tsx:21` — with rating

So the homepage and `/reviews` each emit two `#organization` nodes with conflicting content. Let the root layout render the single block and pass the rating through the existing `opts.aggregateRating` parameter (handled at `src/lib/schema.tsx:122`), then remove the two separate renders.

## 8. Investigate the site-wide `no-store` header

This is the largest performance issue and its cause is unknown. Investigate and report; do not apply a speculative fix.

Every HTML response currently sends:

```
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
cf-cache-status: DYNAMIC
```

Cloudflare therefore caches nothing and every page view reaches the origin. Median server response time is 720 ms across 190 URLs; the homepage takes 3.2 s, `/opleidingen/interne-logistiek` 2.7 s, `/opleidingen/code-95-opleidingen` 2.3 s. TTFB feeds directly into LCP.

Already ruled out: `next.config.ts` sets only security headers; `netlify.toml` sets only three headers; there is no `middleware.ts`; no public route sets `export const dynamic = 'force-dynamic'`. Several routes set sensible `revalidate` values (`/transport-logistiek` 900, `/blog` 3600, `/heftruck-cursus-nuenen` 3600, `/opleidingen` 60).

Run `npm run build` and inspect the route table for routes marked `ƒ (Dynamic)` rather than `○ (Static)` or `● (SSG)`. If `/` is dynamic, the cause is in `src/app/layout.tsx` or a component it renders — most likely a `cookies()` or `headers()` call, often via a Supabase auth client. A single such call makes the entire tree dynamic.

Report which routes are dynamic and what makes them so. The likely fix is to move cookie access out of the shared layout into the components that need it (portaal, auth, admin), or to isolate those behind a route group, so public pages can be statically rendered and cached at the edge with something like `public, max-age=0, s-maxage=3600, stale-while-revalidate=86400`. Keep `private, no-store` for `/portaal`, `/auth`, `/aanmelden/*`, `/instructeur/*` and `/admin/*`.

Note the existing `vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` header — any edge caching must vary on those, or RSC payloads will be served to ordinary visitors.

## 9. Add noindex to the signup pages

`src/app/aanmelden/[courseId]/page.tsx` around line 21 returns metadata without robots directives. 38 of these pages are internally linked. `robots.txt` disallows `/aanmelden/`, but a disallow is not a noindex — an external link can still get the URL indexed without a snippet. Add `robots: { index: false, follow: true }`.

## Verification

Run `npm run build` and confirm it compiles. Then check:

- `/code95-gids` and `/3-daagse-code-95-opleiding-korting` return 308 or 301, not 200
- `sitemap.xml` contains `lastmod` on every URL and no longer lists the two redirected paths
- No rendered title contains "FrisseStart" twice
- The homepage and `/reviews` each contain exactly one `#organization` node
- Paste a local landing page's JSON-LD into Google's Rich Results Test and confirm Course validates

Report what you changed, anything you deliberately left alone, and the findings from task 8.
