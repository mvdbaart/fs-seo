# SEO-audit frissestart.nl — v2, 7 augustus 2026

Vervolg op `frissestart-nl-seo-audit-2026-08-06.md`. Die audit stelde vast *wát* er mis is; deze versie voegt toe *waar het vandaan komt* — met regelverwijzingen in `fs-next` en bevestiging uit de Supabase-database.

**Bronnen deze ronde**

| Bron | Wat |
|---|---|
| Eigen crawler (`POST /api/crawl`, `maxPages=250`) | 250 pagina's, ook buiten de sitemap |
| `mvdbaart/fs-next` @ `68cdd6f` (6 aug) | broncode van de site |
| Supabase `frisse-start-hub` (MCP) | `page_seo`, `course_categories`, `course_category_variants`, `courses` |

> **Let op:** de codeanalyse is gedaan op `origin/main` van GitHub, niet op de werkkopie in `C:\Users\mvdba\Documents\vms\FrisseStart\fs-next`. Deze sessie draait in een geïsoleerde Linux-container en kan die schijf niet lezen. Als er lokaal niet-gecommitte wijzigingen zijn, staan die hier niet in.

Alle bevindingen van 6 augustus staan nog. De crawl van vandaag (250 pagina's, allemaal `200`) bevestigt ze: 137 titles boven 60 tekens, 15 pagina's zonder H1, 1 afbeelding zonder alt, gemiddelde laadtijd 950 ms.

---

## Wat de crawl van 250 pagina's extra opleverde

De vorige ronde volgde alleen de 190 sitemap-URL's. Door links te volgen kwamen er 59 URL's bij die niet in de sitemap staan:

| Groep | Aantal | Oordeel |
|---|---|---|
| `/aanmelden/{uuid}` | 38 | Geblokkeerd in `robots.txt` — akkoord, maar zie punt 8 |
| `/contact?subject=…` / `?course=…` | 12 | **Correct afgehandeld** — alle 12 canonicaliseren naar `/contact` |
| Overig (`/portaal`, `/lp/code95-gids`) | 9 | Zie punt 3 |

De `/contact`-parameters zijn dus géén probleem: `canonical` staat op alle twaalf op `https://frissestart.nl/contact`. Dat is goed geregeld.

---

## Root causes — nu met bestand en regel

### 1. `/code95-gids` is een client-side redirect, geen 301

**Bestand:** `src/app/code95-gids/page.tsx`

```tsx
'use client';
export default function Code95GidsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/lp/code95-gids${search}`);
  }, [router]);
  return (/* spinner: "Doorsturen..." */);
}
```

Dit verklaart alle symptomen in één keer: Googlebot krijgt een `200` met een spinner (128 woorden, geen H1, geen canonical), de pagina staat wél in de sitemap, en de link equity gaat nergens heen. Een `useEffect`-redirect is voor een crawler geen redirect — het is een lege pagina.

**Fix:** vervang de route door een echte redirect in `next.config.ts`:

```ts
async redirects() {
  return [
    { source: '/code95-gids', destination: '/lp/code95-gids', permanent: true },
    { source: '/3-daagse-code-95-opleiding-korting', destination: '/3-daagse-code-95-korting', permanent: true },
  ];
}
```

en haal beide uit `staticRoutes` in `src/app/sitemap.ts` (regels 40 en 18).

### 2. Titles verdubbelen door het metadata-template

**Bestand:** `src/app/layout.tsx:66-68`

```ts
title: {
  default: title,              // "FrisseStart"
  template: `%s | ${title}`,   // "%s | FrisseStart"
}
```

Het template is op zich correct. Het probleem zit in de pagina's die hun eigen merknaam al meesturen — die worden `… - FrisseStart Blog | FrisseStart`. Dat raakt 67 pagina's.

Supabase bevestigt de tweede helft: van de 88 rijen in `page_seo` zijn er **55 met een title langer dan 46 tekens**, en 46 + `" | FrisseStart"` (14) = 60. Die 55 zitten dus per definitie aan of over de limiet zodra het template erbij komt.

**Fix, twee sporen:**
1. In code: haal `FrisseStart Blog` / `FrisseStart Vacatures` / `FrisseStart Kennisbank` uit de per-pagina `metadata.title` van de blog-, vacature- en kennisbank-routes. Het template plakt de merknaam er al achter.
2. In data: kort de 55 te lange `page_seo.title`-waarden in tot ≤46 tekens.

### 3. `/lp/code95-gids` mist een canonical

**Bestand:** `src/app/lp/[slug]/`

Deze route heeft geen `canonical`, terwijl hij vanaf alle 188 pagina's gelinkt wordt — de sterkst gelinkte pagina van de site na de homepage. Voeg een self-referencing canonical toe (via `getPageSeoMetadata`, net als de andere routes) en zet hem in de sitemap.

De title is bovendien `Code 95 Gids | FrisseStart | FrisseStart` — hetzelfde dubbele-merk-probleem als punt 2.

### 4. `courseJsonLd()` laat `offers` en `hasCourseInstance` bewust weg

**Bestand:** `src/lib/schema.tsx:242-251`

```ts
/** Compacte Course-node voor landingspagina's; de volledige variant staat op /opleidingen/[slug]. */
export function courseJsonLd(opts: { name: string; description: string; path: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name, description, url,
    provider: { '@type': 'EducationalOrganization', '@id': ORGANIZATION_ID, name: 'FrisseStart' },
  };
}
```

Deze helper wordt aangeroepen door precies de 10 lokale landingspagina's uit de vorige audit — `heftruck-cursus-eindhoven`, `vca-eindhoven`, `code-95-eindhoven`, `bhv-cursus-eindhoven`, `heftruck-cursus{,-nuenen,-helmond,-geldrop}`, `reachtruck-cursus-{eindhoven,helmond}`.

Google vereist voor Course rich results zowel `offers` als `hasCourseInstance`. Deze "compacte" variant komt er dus per definitie niet voor in aanmerking, terwijl het commercieel de belangrijkste pagina's zijn.

**Fix:** breid de helper uit met optionele `offers` en `hasCourseInstance` en geef de landingspagina's de prijs en eerstvolgende data mee, net zoals `/opleidingen/[slug]` dat doet.

### 5. Ontbrekende `hasCourseInstance` is een lege agenda, geen codebug

**Bestand:** `src/app/opleidingen/[slug]/page.tsx:235-244`

De code klopt — hij voegt `hasCourseInstance` toe zodra er sessies zijn:

```ts
...(sessions && sessions.length > 0
  ? { hasCourseInstance: sessions.slice(0, 10).map((s) => ({ … })) }
  : {}),
```

De oorzaak zit in de data. Uit Supabase:

| | |
|---|---|
| Actieve varianten met een `seo_url` | 30 |
| Daarvan **zonder geplande toekomstige datum** | **28** |
| — waarvan e-learning | 9 |
| — waarvan klassikaal | 19 |
| Met minstens één toekomstige datum | 2 |

Dit is breder dan SEO. 28 van de 30 cursusvarianten tonen bezoekers geen enkele startdatum. Dat kost niet alleen rich results, het kost ook inschrijvingen — "Beschikbare Cursusdata" staat als kop op de pagina, maar er staat niets onder.

**Fix, twee sporen:**
1. **Klassikaal (19):** plan data in. Dit is een operationele actie, geen developer-actie.
2. **E-learning (9):** die hébben geen vaste datum. Emitteer voor `elearning_enabled`-varianten een `CourseInstance` met `courseMode: 'Online'` en een `courseSchedule` in plaats van een `startDate`. Dan zijn ze alsnog rich-result-waardig zonder verzonnen datums.

### 6. De verkeerde title op de VCA-pagina is een gekopieerde databaserij

**Tabel:** `page_seo` (Supabase)

| `page_slug` | `title` | `updated_at` |
|---|---|---|
| `/opleidingen/u05-vca-basis-of-vol-vca` | **"Reachtruck cursus en certificaat"** | 2026-07-10 08:33 |
| `/opleidingen/veilig-werken-met-de-reachtruck` | "Reachtruck cursus en certificaat" | 2026-07-10 08:52 |

Title én description zijn woord-voor-woord identiek; beide rijen zijn binnen twintig minuten van elkaar bewerkt op 10 juli. Dit is een copy-paste-fout tijdens een bulkbewerking, geen bug.

Hetzelfde geldt voor de fysieke-belasting-dubbel:

| `page_slug` | `title` | `updated_at` |
|---|---|---|
| `/opleidingen/u20-fysieke-belasting` | "Fysieke Belasting cursus \| Code 95 nascholing" | 2026-07-09 |
| `/opleidingen/u20e-fysieke-belasting` | idem | 2026-07-08 |

Opvallend: de *andere* varianten zijn wél netjes onderscheiden ("Fysieke Belasting **dagopleiding**", "Fysieke Belasting **e-learning**"). Alleen de U20E heeft nooit eigen copy gekregen.

Over de hele tabel zijn dit de enige twee duplicaten — het is dus een klein, afgebakend probleem. Drie `UPDATE`-statements lossen het op:

```sql
update page_seo set
  title = 'VCA Basis of VOL VCA behalen | FrisseStart',
  description = 'Volg de VCA Basis of VOL VCA cursus bij FrisseStart. Inclusief examen, ervaren instructeurs en een snelle planning.'
where page_slug = '/opleidingen/u05-vca-basis-of-vol-vca';

update page_seo set
  title = 'Fysieke Belasting e-learning | Code 95',
  description = 'Volg Fysieke Belasting als e-learning. Leer veilig tillen en ergonomisch werken, inclusief 7 Code 95-uren.'
where page_slug = '/opleidingen/u20e-fysieke-belasting';
```

*(Copy graag zelf nalezen — ik ken de exacte propositie van de U20E niet.)*

### 7. Sitemap: `lastmod` ontbreekt op de statische routes

**Bestand:** `src/app/sitemap.ts:6-49`

De `staticRoutes`-array zet wel `changeFrequency` en `priority`, maar geen `lastModified`. Dat zijn precies de 46 URL's zonder `lastmod` uit de vorige audit — inclusief `/`, `/opleidingen` en `/opleidingen/code-95-opleidingen`.

Google negeert `changefreq` en `priority` volledig, maar gebruikt `lastmod` wel. De array levert dus nu alleen de velden die genegeerd worden.

De dynamische delen (blogs, vacatures, opleidingen, kennisbank) halen `lastModified` wél netjes uit Supabase.

### 8. `/aanmelden/{uuid}` heeft geen canonical en geen `noindex`

38 van deze pagina's zijn intern gelinkt. Ze zijn geblokkeerd via `robots.txt`, wat in de praktijk volstaat — maar een `Disallow` is geen indexeerverbod: als iemand extern naar zo'n URL linkt, kan Google hem alsnog zonder snippet indexeren. Een `robots: { index: false }` in de metadata is de robuustere variant.

### 9. Dubbel `#organization`-blok — een bewuste aanname

**Bestand:** `src/lib/schema.tsx:55-60`

```
 * Wordt in de root layout gerenderd; extra renders met hetzelfde `@id` (bijv. met
 * aggregateRating op de homepage) worden door parsers samengevoegd tot één entiteit.
```

Dit is dus geen slordigheid maar een expliciete ontwerpkeuze. Dat verdient een eerlijke nuance ten opzichte van mijn vorige rapport: samenvoegen op `@id` is inderdaad hoe JSON-LD hoort te werken.

Maar de aanname is riskanter dan de comment suggereert. Google's documentatie garandeert geen merge-gedrag bij twee losse `<script>`-blokken met hetzelfde `@id` en verschillende properties, en de rating is precies het veld dat je niet kwijt wilt. Het kost weinig om het zeker te maken: render één blok in de root layout en geef de homepage de `aggregateRating` mee via de bestaande `opts.aggregateRating`-parameter (die er al is, regel 122).

### 10. `no-store` op alle HTML — nog geen oorzaak gevonden

De belangrijkste bevinding van gisteren (`cache-control: private, no-cache, no-store`, `cf-cache-status: DYNAMIC`, mediaan 720 ms) heb ik in de broncode **niet kunnen herleiden**:

- `next.config.ts` zet geen `Cache-Control` — alleen security headers
- `netlify.toml` idem
- er is geen `middleware.ts`
- geen enkele publieke route zet `export const dynamic = 'force-dynamic'`

Sterker nog, verschillende routes zetten juist een nette `revalidate` (`/transport-logistiek` 900, `/blog` 3600, `/heftruck-cursus-nuenen` 3600, `/opleidingen` 60).

Twee routes zetten wél `revalidate = 0` — `src/app/opleidingen/[slug]/page.tsx:34` ("Fetch fresh data on every request") en `src/app/opleidingen/1-uurs-hercertificering/page.tsx:29` — maar dat verklaart de homepage niet.

**Waarschijnlijkste verklaring:** de root layout leest cookies of headers (bijvoorbeeld voor de ingelogde-gebruiker-state of Supabase-auth), waardoor Next.js élke route dynamisch rendert. Dat is precies het patroon dat `no-store` op de hele site oplevert.

**Volgende stap:** draai `npm run build` en kijk in de route-tabel welke routes als `ƒ (Dynamic)` in plaats van `○ (Static)` of `● (SSG)` gemarkeerd staan. Staat daar ook `/` bij, dan zit de oorzaak in `layout.tsx` of een component die het aanroept. Dat is een gerichte zoektocht van een half uur, en het is de grootste snelheidswinst die er ligt.

---

## Prioriteit

**Data-fixes (geen deploy nodig)**

| Actie | Waar |
|---|---|
| U05-VCA title/description corrigeren | `page_seo` |
| U20E title/description differentiëren | `page_seo` |
| 55 te lange titles inkorten tot ≤46 tekens | `page_seo` |
| Cursusdata plannen voor 19 klassikale varianten | `courses` |

**Code-fixes**

| Actie | Bestand |
|---|---|
| `/code95-gids` + `/3-daagse-…-opleiding-korting` → echte 301 | `next.config.ts`, `src/app/sitemap.ts` |
| `lastModified` op `staticRoutes` | `src/app/sitemap.ts:6-49` |
| Canonical + sitemap voor `/lp/code95-gids` | `src/app/lp/[slug]/` |
| Dubbele merknaam uit blog/vacature/kennisbank-titles | per-route `metadata` |
| `offers` + `hasCourseInstance` in compacte Course-node | `src/lib/schema.tsx:242` |
| `CourseInstance` met `courseMode: 'Online'` voor e-learning | `src/app/opleidingen/[slug]/page.tsx:235` |
| Eén `#organization`-blok met `aggregateRating` | `src/lib/schema.tsx`, `layout.tsx` |
| `noindex` op `/aanmelden/[courseId]` | `src/app/aanmelden/[courseId]/page.tsx` |

**Onderzoek**

| Actie | Waarom |
|---|---|
| Uitzoeken waarom alle HTML `no-store` krijgt | Grootste snelheidswinst; oorzaak nog niet gevonden |

---

## Nog steeds niet gemeten

Ongewijzigd ten opzichte van 6 augustus: **Core Web Vitals** en **posities/zoekvolumes** ontbreken nog steeds. De PageSpeed-quota is op, Chromium kan vanuit deze omgeving niet bij de site (de uitgaande proxy reset de verbinding), en er zijn geen `FS_SEO_PAGESPEED_API`- of `FS_SERPER_API`-sleutels geconfigureerd. De 950 ms gemiddelde laadtijd uit de crawl is server-side; het zegt iets over TTFB, niet over LCP/CLS/INP.
