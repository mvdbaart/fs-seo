# Fix-instructies frissestart.nl

Hoort bij `frissestart-nl-seo-audit-2026-08-06.md` en `-2026-08-07.md`. Alle regelverwijzingen gelden voor `fs-next` @ `68cdd6f`.

Volgorde: **deel 1** (meten) is los van de rest en kan meteen. **Deel 2** (data) vereist geen deploy. **Deel 3** (code) is één PR.

---

## Deel 1 — Meetgaten dichten

### 1a. Google Search Console koppelen

Dit vervangt Serper. GSC geeft echte posities, klikken, vertoningen en CTR van je eigen property; een Serper-check geeft alleen een momentopname van de SERP. Voor jouw doel is GSC de betere bron.

**Belangrijk:** GSC accepteert géén API-key. Het moet een service account zijn.

1. [Google Cloud Console](https://console.cloud.google.com/) → project kiezen of aanmaken.
2. **APIs & Services → Library** → zoek *Google Search Console API* → **Enable**.
3. **APIs & Services → Credentials** → **Create credentials → Service account**. Naam bijv. `fs-seo-gsc`. Rollen kun je overslaan.
4. Open het service account → tabblad **Keys** → **Add key → Create new key → JSON** → downloaden.
5. Kopieer het e-mailadres van het service account (`…@….iam.gserviceaccount.com`).
6. [Search Console](https://search.google.com/search-console) → property **frissestart.nl** → **Instellingen → Gebruikers en machtigingen → Gebruiker toevoegen** → plak dat e-mailadres → rechten **Volledig** of **Beperkt** (beperkt volstaat voor lezen).

Dan in `fs-seo`, één van deze twee:

- **`.env.local`** — zet de JSON inline op één regel:
  ```
  FS_GSC_SERVICE_ACCOUNT={"type":"service_account","project_id":"…","private_key":"-----BEGIN PRIVATE KEY-----\n…","client_email":"…"}
  ```
- **Of via de UI** — Instellingen-scherm, plak de JSON in het GSC-veld. Die schrijft naar de `settings`-tabel.

`FS_GSC_SERVICE_ACCOUNT` accepteert een pad óf inline JSON (`services/gscClient.js:25`). `GOOGLE_APPLICATION_CREDENTIALS` werkt ook, maar alleen als **pad naar een bestand** — inline JSON werkt daar niet.

Controle: herstart de server en roep `GET /api/settings` aan. Er moet `"gsc_connected": true` staan. Daarna vult het Search Console-scherm zich.

> De service-account-JSON verschijnt nooit in `GET /api/settings` — alleen de boolean.

### 1b. PageSpeed-key

Dit is de simpele: een gewone API-key volstaat.

1. Zelfde Cloud-project → **Library** → *PageSpeed Insights API* → **Enable**.
2. **Credentials → Create credentials → API key**.
3. In `fs-seo/.env.local`:
   ```
   FS_SEO_PAGESPEED_API=…
   ```

Beperk de key bij voorkeur tot de PageSpeed Insights API (**Restrict key → API restrictions**).

Daarna werkt de PageSpeed-tegel op het dashboard écht — die stond tot vandaag op een verzonnen `78/100` (gefixt in `fs-seo` commit `52f5a31`).

### 1c. Wat je níet nodig hebt

Serper. Laat `FS_SERPER_API` leeg; de rank-tracker toont dan "Nog niet gecheckt" in plaats van verzonnen posities. De keyword-data komt uit GSC via `POST /api/projects/:id/gsc/import-keywords`.

---

## Deel 2 — Supabase-fixes (geen deploy nodig)

### 2a. De verkeerde VCA-titel

`page_seo` voor `/opleidingen/u05-vca-basis-of-vol-vca` is een letterlijke kopie van de reachtruck-rij. Controleer de copy hieronder tegen je eigen propositie voordat je hem draait.

```sql
update page_seo set
  title = 'VCA Basis of VOL VCA behalen',
  description = 'Volg de VCA Basis of VOL VCA cursus bij FrisseStart. Inclusief examen, ervaren instructeurs en snelle inschrijving.',
  updated_at = now()
where page_slug = '/opleidingen/u05-vca-basis-of-vol-vca';
```

### 2b. De dubbele fysieke-belasting-titel

De U20E is de e-learningvariant, maar heeft dezelfde copy als de klassikale U20.

```sql
update page_seo set
  title = 'Fysieke Belasting e-learning | Code 95',
  description = 'Volg Fysieke Belasting als e-learning. Leer veilig tillen en ergonomisch werken, inclusief 7 Code 95-uren.',
  updated_at = now()
where page_slug = '/opleidingen/u20e-fysieke-belasting';
```

Controleer daarna dat er geen duplicaten meer zijn:

```sql
select title, count(*), string_agg(page_slug, ' | ')
from page_seo where title is not null and title <> ''
group by title having count(*) > 1;
```

### 2c. Te lange titles

55 van de 88 rijen zijn langer dan 46 tekens. Met het `%s | FrisseStart`-template (14 tekens) komen die allemaal boven de 60 uit. Lijst opvragen:

```sql
select page_slug, length(title) as len, title
from page_seo
where length(title) > 46
order by len desc;
```

Kort ze in tot ≤46 tekens. Zet het onderscheidende woord vooraan — Google kapt achteraan af.

### 2d. Cursusdata plannen

28 van de 30 actieve varianten hebben geen enkele toekomstige datum. Dat kost rich results én inschrijvingen: de kop "Beschikbare Cursusdata" staat op de pagina, met niets eronder.

```sql
select v.seo_url, v.title, v.elearning_enabled,
       count(c.*) filter (where c.course_date >= current_date and c.is_active) as toekomstige_data
from course_category_variants v
left join courses c on c.course_category_variant_id = v.id
where v.is_active and v.seo_url is not null
group by v.seo_url, v.title, v.elearning_enabled
order by toekomstige_data, v.seo_url;
```

De 19 klassikale varianten hebben echte data nodig (planning). De 9 e-learningvarianten hebben geen vaste datum — die los je op in **3f**.

---

## Deel 3 — Code-fixes in `fs-next`

### 3a. Echte 301's in plaats van een JS-redirect

`src/app/code95-gids/page.tsx` is nu een `useEffect`-redirect. Voor een crawler is dat geen redirect maar een lege pagina met status 200.

**Verwijder** `src/app/code95-gids/page.tsx` en `src/app/3-daagse-code-95-opleiding-korting/page.tsx`, en voeg toe aan `next.config.ts` (naast de bestaande `headers()`):

```ts
async redirects() {
  return [
    { source: '/code95-gids', destination: '/lp/code95-gids', permanent: true },
    { source: '/3-daagse-code-95-opleiding-korting', destination: '/3-daagse-code-95-korting', permanent: true },
  ];
},
```

### 3b. Sitemap opschonen en `lastmod` toevoegen

In `src/app/sitemap.ts`:

1. **Verwijder** deze twee regels uit `staticRoutes` (regel 18 en 40) — ze worden nu redirects:
   ```ts
   { url: `${BASE_URL}/3-daagse-code-95-opleiding-korting`, … },
   { url: `${BASE_URL}/code95-gids`, … },
   ```
2. **Voeg toe** `{ url: `${BASE_URL}/lp/code95-gids`, changeFrequency: 'monthly', priority: 0.7 }`.
3. **Zet `lastModified`** op alle statische routes. Google negeert `changefreq` en `priority`, maar gebruikt `lastmod` wél — nu levert de array alleen de genegeerde velden. Simpelste variant die meteen werkt:

   ```ts
   const STATIC_LAST_MODIFIED = new Date('2026-08-07');

   const staticRoutes: MetadataRoute.Sitemap = [
     { url: `${BASE_URL}/`, changeFrequency: 'weekly', priority: 1.0, lastModified: STATIC_LAST_MODIFIED },
     …
   ];
   ```

   Werk die constante bij als je de statische pagina's inhoudelijk aanpast. Een datum die nooit verandert is misleidend; liever een echte deploy- of contentdatum als je die hebt.

### 3c. Dubbele merknaam uit titles

`src/app/layout.tsx:68` zet al `template: '%s | FrisseStart'`. Vijf plekken plakken de merknaam er nóg een keer bij. Haal het achtervoegsel weg — het template doet het werk:

| Bestand | Regel | Nu | Wordt |
|---|---|---|---|
| `src/app/blog/[slug]/page.tsx` | 36 | `` `${post.title} - FrisseStart Blog` `` | `post.title` |
| `src/app/vacatures/[slug]/page.tsx` | 45-46 | `` `${job.title} - FrisseStart Vacatures` `` | `job.title` / `` `[Vervuld] ${job.title}` `` |
| `src/app/kennisbank/[slug]/page.tsx` | 64 | `` …\|\| `${domain.name} — alles wat je moet weten \| FrisseStart Kennisbank` `` | `` …\|\| `${domain.name} — alles wat je moet weten` `` |
| `src/app/kennisbank/[slug]/[spoke]/page.tsx` | 48 | `` …\|\| `${article.title} \| FrisseStart Kennisbank` `` | `` …\|\| article.title `` |
| `src/app/lp/[slug]/page.tsx` | 39 | `` `${data.name} \| FrisseStart` `` | `data.name` |

Let op: kennisbank gebruikt `domain.meta_title ||` en `article.meta_title ||` als eerste keuze. Staat de merknaam in die DB-velden, dan blijft de dubbeling bestaan — controleer die kolommen ook.

### 3d. Canonical op `/lp/[slug]`

`src/app/lp/[slug]/page.tsx` heeft geen canonical, terwijl `/lp/code95-gids` vanaf alle 188 pagina's gelinkt wordt. Voeg toe aan het `Metadata`-object (regel ~47):

```ts
alternates: { canonical: `https://frissestart.nl/lp/${slug}` },
```

Of gebruik `getPageSeoMetadata()`, net als de andere routes — die zet canonical, OpenGraph en Twitter in één keer.

### 3e. `offers` en `hasCourseInstance` op de lokale landingspagina's

`src/lib/schema.tsx:242` levert bewust een "compacte" Course-node zonder `offers` en `hasCourseInstance`. Die twee velden zijn precies wat Google vereist voor Course rich results, dus de 10 lokale landingspagina's — commercieel je belangrijkste — komen er nooit voor in aanmerking.

Breid de helper uit met optionele velden:

```ts
export function courseJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  price?: number;
  instances?: Array<{ startDate: string; location?: string; mode?: 'Onsite' | 'Online' }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    provider: { '@type': 'EducationalOrganization', '@id': ORGANIZATION_ID, name: 'FrisseStart' },
    ...(opts.price
      ? {
          offers: [{
            '@type': 'Offer',
            price: opts.price,
            priceCurrency: 'EUR',
            category: 'Paid',
            availability: 'https://schema.org/InStock',
            url: absoluteUrl(opts.path),
          }],
        }
      : {}),
    ...(opts.instances?.length
      ? {
          hasCourseInstance: opts.instances.map((i) => ({
            '@type': 'CourseInstance',
            courseMode: i.mode || 'Onsite',
            startDate: i.startDate,
            ...(i.location ? { location: { '@type': 'Place', name: i.location } } : {}),
          })),
        }
      : {}),
  };
}
```

Geef daarna prijs en eerstvolgende data mee op de 10 aanroepende pagina's: `heftruck-cursus-eindhoven`, `-nuenen`, `-helmond`, `-geldrop`, `heftruck-cursus`, `reachtruck-cursus-eindhoven`, `-helmond`, `vca-eindhoven`, `bhv-cursus-eindhoven`, `code-95-eindhoven`.

> Voeg `offers` alleen toe als je de prijs écht kent. Een verzonnen prijs in structured data is een Google-overtreding, geen SEO-truc.

### 3f. E-learning: `CourseInstance` zonder startdatum

`src/app/opleidingen/[slug]/page.tsx:235` voegt `hasCourseInstance` alleen toe als er sessies zijn. Correct voor klassikaal, maar e-learning heeft per definitie geen vaste datum — die 9 varianten blijven zo altijd zonder.

Voeg een tak toe voor `elearning_enabled`-varianten:

```ts
...(sessions?.length
  ? { hasCourseInstance: sessions.slice(0, 10).map((s) => ({ … })) }
  : activeVariant?.elearning_enabled
    ? {
        hasCourseInstance: [{
          '@type': 'CourseInstance',
          courseMode: 'Online',
          courseWorkload: `PT${activeVariant.elearning_hours || 4}H`,
        }],
      }
    : {}),
```

`courseWorkload` is een ISO 8601-duur. Dit is geen trucje: het beschrijft e-learning correct, zonder een datum te verzinnen.

### 3g. Eén `#organization`-blok

`src/lib/schema.tsx:55-60` gaat ervan uit dat parsers twee blokken met hetzelfde `@id` samenvoegen. Dat is hoe JSON-LD hoort te werken, maar Google garandeert het niet — en het veld dat je zou verliezen is juist `aggregateRating`.

Het blok wordt nu drie keer gerenderd:

| Bestand | Regel | Met rating? |
|---|---|---|
| `src/app/layout.tsx` | 179 | nee |
| `src/app/page.tsx` | 132 | ja |
| `src/app/reviews/page.tsx` | 21 | ja |

Homepage en `/reviews` krijgen dus allebei een dubbel blok. Laat de root layout de rating meegeven en verwijder de twee losse renders — `organizationJsonLd()` accepteert `opts.aggregateRating` al (regel 122).

### 3h. `noindex` op `/aanmelden/[courseId]`

38 van deze pagina's zijn intern gelinkt. `robots.txt` blokkeert `/aanmelden/`, maar een `Disallow` is geen indexeerverbod: bij een externe link kan Google de URL alsnog zonder snippet indexeren. Voeg toe aan de metadata in `src/app/aanmelden/[courseId]/page.tsx` (regel ~21):

```ts
robots: { index: false, follow: true },
```

### 3i. Interne links naar de staart

Ongeveer 60 pagina's hebben precies één inkomende link, waaronder vrijwel alle `/vacatures/*` en veel `/opleidingen/*`-varianten. Een blok "Gerelateerde cursussen" onderaan elke cursuspagina (3-5 links binnen dezelfde categorie) verdeelt de interne linkwaarde veel gelijkmatiger. Dat is te genereren uit `course_category_groups` — geen handwerk.

---

## Deel 4 — Het openstaande punt: `no-store`

Dit is de grootste snelheidswinst en tegelijk het enige punt waarvan ik de oorzaak niet heb gevonden.

Elke HTML-respons stuurt `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` met `cf-cache-status: DYNAMIC`. Cloudflare mag dus niets bewaren en elke paginaweergave gaat naar de origin — mediaan 720 ms, homepage 3,2 s.

Het staat níet in `next.config.ts`, níet in `netlify.toml`, er is geen `middleware.ts`, en geen publieke route zet `force-dynamic`. Verschillende routes zetten juist een nette `revalidate`.

**Zo vind je het:**

```bash
npm run build
```

Kijk in de route-tabel welke routes `ƒ (Dynamic)` zijn in plaats van `○ (Static)` of `● (SSG)`. Staat `/` daarbij, dan zit de oorzaak in `src/app/layout.tsx` of een component die het aanroept — waarschijnlijk `cookies()` of `headers()`, vaak via een Supabase-auth-client. Eén aanroep daarvan maakt de hele boom dynamisch.

**Als dat de oorzaak is:** haal het lezen van cookies uit de gedeelde layout en doe het in de componenten die het echt nodig hebben (portaal, admin, auth), of zet die in een aparte route group. Publieke pagina's kunnen dan weer statisch.

**Daarna** zet je edge-caching aan voor publieke HTML:

```
Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400
```

Houd `private, no-store` voor `/portaal`, `/auth`, `/aanmelden/*`, `/instructeur/*` en `/admin/*`.

> Let op de bestaande `vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`. Zorg dat de edge-cache daarop varieert, anders serveer je RSC-payloads aan gewone bezoekers.

---

## Deel 5 — Controleren

Na deploy:

```bash
# 301 in plaats van 200
curl -sI https://frissestart.nl/code95-gids | head -1
curl -sI https://frissestart.nl/3-daagse-code-95-opleiding-korting | head -1

# edge-cache actief?
curl -sI https://frissestart.nl/ | grep -iE "cache-control|cf-cache-status"

# lastmod aanwezig?
curl -s https://frissestart.nl/sitemap.xml | grep -c lastmod   # verwacht: alle URL's
```

Verder:

- **Rich Results Test** op een lokale landingspagina (`/heftruck-cursus-eindhoven`) → Course moet nu geldig zijn.
- **Rich Results Test** op de homepage → één Organization-entiteit, mét rating.
- In `fs-seo`: opnieuw crawlen en het Schema.org Audit-scherm bekijken (stond op 108 waarschuwingen).
- Search Console → **Sitemaps** opnieuw indienen, en de redirects controleren onder **Pagina's → Pagina met omleiding**.

---

## Volgorde

| Stap | Wat | Waar | Deploy? |
|---|---|---|---|
| 1 | GSC + PageSpeed koppelen | `fs-seo/.env.local` | nee |
| 2 | U05 + U20E titels | Supabase | nee |
| 3 | 301's + sitemap | `fs-next` | ja |
| 4 | Dubbele merknaam + canonical `/lp` | `fs-next` | ja |
| 5 | Eén `#organization`-blok | `fs-next` | ja |
| 6 | Course-schema uitbreiden | `fs-next` | ja |
| 7 | Cursusdata plannen | Supabase | nee |
| 8 | 55 titles inkorten | Supabase | nee |
| 9 | `no-store` uitzoeken | `fs-next` | ja |
| 10 | Gerelateerde-cursussen-blok | `fs-next` | ja |

Stap 3 t/m 6 kunnen in één PR.
