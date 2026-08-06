# SEO-audit frissestart.nl — 6 augustus 2026

**Scope:** alle 190 URL's uit `https://frissestart.nl/sitemap.xml`, live gecrawld (status, titles, meta, canonicals, headings, structured data, interne links, afbeeldingen) plus header-/infrastructuurcontroles.

**Methode:** eigen crawl met axios + cheerio (dezelfde stack als `server/crawler.js`), aangevuld met directe header-inspectie via curl.

---

## Samenvatting

De technische basis is opvallend goed. Alle 190 URL's geven `200`, er zijn geen redirect-ketens, geen ontbrekende meta descriptions, `hreflang`/`lang=nl` staat overal goed, brotli-compressie is actief, statische assets zijn `immutable` gecached en er staat structured data op elke pagina. Dit is geen site met een berg technische schuld.

De winst zit in vier dingen: **HTML wordt helemaal niet gecached aan de edge**, **57 van de 73 cursuspagina's missen de velden die Google nodig heeft voor Course rich results**, er zijn **een paar concrete duplicate-/kapotte-pagina-problemen**, en **titles zijn structureel te lang door dubbele branding**.

| | |
|---|---|
| URL's gecrawld | 190 |
| HTTP 200 | 190 (100%) |
| Ontbrekende title / meta description | 0 / 0 |
| Canonical mismatch | 0 |
| Pagina's zonder structured data | 0 |
| Afbeeldingen zonder `alt` | 1 van 751 |
| Mediaan woorden per pagina | 2.520 |
| Mediaan server-responstijd | 720 ms |

---

## P1 — Grootste impact

### 1. HTML wordt aan de edge niet gecached (`cf-cache-status: DYNAMIC`)

De HTML-respons stuurt:

```
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
cf-cache-status: DYNAMIC
```

Elke paginaweergave gaat dus volledig naar de origin — Cloudflare staat ervoor maar mag niets bewaren. Dat is terug te zien in de responstijden: mediaan **720 ms**, en de belangrijkste pagina's zijn het traagst, precies andersom dan je wilt.

| Pagina | Responstijd |
|---|---|
| `/` | 3.177 ms |
| `/opleidingen/interne-logistiek` | 2.741 ms |
| `/opleidingen/code-95-opleidingen` | 2.342 ms |
| `/opleidingen/1-uurs-hercertificering` | 1.966 ms |
| `/opleidingen` | 1.529 ms |

TTFB telt direct mee in LCP. Dit is veruit de goedkoopste snelheidswinst die er ligt.

**Wat te doen:** zet publieke, niet-persoonlijke pagina's (`/`, `/opleidingen/*`, `/kennisbank/*`, `/blog/*`, de lokale landingspagina's) op `s-maxage` met `stale-while-revalidate`, bijvoorbeeld:

```
Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400
```

Houd `private, no-store` alleen voor `/portaal`, `/auth`, `/aanmelden/*` en `/instructeur/*`. In Next.js regel je dit per route met `revalidate` / `Cache-Control`-headers; de `no-store` staat er nu waarschijnlijk site-breed omdat één component dynamisch is. Het is de moeite waard uit te zoeken welke dat is.

> Let op: `vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` staat op de respons. Zorg dat de edge-cache op die headers varieert (of dat ze voor documentnavigaties niet meesturen), anders serveer je RSC-payloads aan gewone bezoekers.

### 2. Course rich results: 57 van 73 cursuspagina's komen niet in aanmerking

Google vereist voor Course rich results zowel `offers` als `hasCourseInstance` (met `courseMode` en `startDate`/`courseSchedule`). De stand nu:

| Status | Aantal |
|---|---|
| Compleet (`offers` + `hasCourseInstance`) | 16 |
| Wel `offers`, geen `hasCourseInstance` | 47 |
| Geen `offers` én geen `hasCourseInstance` | 10 |

De 10 pagina's zonder `offers` zijn uitgerekend de commercieel sterkste — de lokale landingspagina's:

```
/heftruck-cursus-eindhoven      /vca-eindhoven
/heftruck-cursus-nuenen         /reachtruck-cursus-helmond
/heftruck-cursus-helmond        /heftruck-cursus
/reachtruck-cursus-eindhoven    /code-95-eindhoven
/heftruck-cursus-geldrop        /bhv-cursus-eindhoven
```

Hun Course-schema heeft maar 6 velden (`name`, `description`, `url`, `provider`, `@context`, `@type`). Ter vergelijking: `/opleidingen/u20-fysieke-belasting` doet het wél goed, met prijs, valuta, beschikbaarheid en een `CourseInstance` met startdatum en locatie.

**Wat te doen:** trek het schema-patroon van de `/opleidingen/*`-pagina's door naar de lokale landingspagina's, en vul `hasCourseInstance` aan op de 47 pagina's die al `offers` hebben. Die data staat al in de agenda ("Beschikbare Cursusdata" staat als H2 op de pagina) — hij wordt alleen niet in JSON-LD gezet. Dit is grotendeels één template-aanpassing.

### 3. Dubbel `#organization`-blok op de homepage, met tegenstrijdige inhoud

De homepage bevat twee JSON-LD-blokken met hetzelfde `@id` (`https://frissestart.nl/#organization`). Ze zijn bijna identiek, maar:

- blok 0 (20 velden) heeft **geen** `aggregateRating`
- blok 2 (21 velden) heeft **wel** `aggregateRating` (4,7 / 138 reviews)

Bij een dubbele `@id` met afwijkende properties is niet gedefinieerd welke Google gebruikt; je riskeert dat de rating genegeerd wordt. Op de onderliggende pagina's staat het blok correct één keer, dus dit is puur een homepage-bug.

**Wat te doen:** één `#organization`-blok renderen, mét `aggregateRating`. Waarschijnlijk injecteren zowel een layout- als een paginacomponent hetzelfde blok.

---

## P2 — Concrete fouten om op te ruimen

### 4. `/code95-gids` is een lege, kapotte pagina die wél in de sitemap staat

| | `/code95-gids` (in sitemap) | `/lp/code95-gids` (niet in sitemap) |
|---|---|---|
| Title | `FrisseStart` | `Code 95 Gids \| FrisseStart \| FrisseStart` |
| H1 | *geen* | "Nooit meer gedoe met Code 95" |
| Woorden | 128 | volwaardige landingspagina |
| Canonical | *ontbreekt* | *ontbreekt* |
| Interne links | **0** | **188** (sitewide) |

Het is precies verkeerd om: de lege versie staat in de sitemap en krijgt geen enkele interne link, terwijl de échte landingspagina vanaf elke pagina gelinkt wordt maar niet in de sitemap staat.

**Wat te doen:** `/code95-gids` 301-redirecten naar `/lp/code95-gids`, die laatste in de sitemap opnemen en er een canonical op zetten. Corrigeer meteen de dubbele branding in de title.

### 5. Keyword-kannibalisatie op de 3-daagse Code 95-actie

Twee pagina's over hetzelfde aanbod:

| | `/3-daagse-code-95-korting` | `/3-daagse-code-95-opleiding-korting` |
|---|---|---|
| Woorden | 1.812 | 574 |
| H2's | 5 | 1 |
| FAQ-schema | ja | nee |
| Canonical | correct | **ontbreekt** |
| Interne links | gelinkt | **0** |

De zwakke variant is een wees zonder canonical en concurreert met de sterke.

**Wat te doen:** `/3-daagse-code-95-opleiding-korting` 301 naar `/3-daagse-code-95-korting`.

### 6. `/opleidingen/u05-vca-basis-of-vol-vca` heeft de title en meta van een reachtruck-cursus

Dit is een echte contentfout, geen nuance:

- **H1:** "U05 VCA Basis of VOL VCA"
- **Title:** "Reachtruck cursus en certificaat | FrisseStart"
- **Meta description:** "Volg een reachtruck cursus bij FrisseStart. Kies uit 1 uur, dagopleiding of Code 95 en behaal een officieel reachtruckcertificaat…"

De snippet in Google belooft dus iets heel anders dan de pagina levert. De title botst bovendien met de echte reachtruck-pagina (`/opleidingen/veilig-werken-met-de-reachtruck`).

### 7. Identieke title én meta op twee fysieke-belasting-varianten

`/opleidingen/u20-fysieke-belasting` en `/opleidingen/u20e-fysieke-belasting` delen title én meta description exact. De E-variant is de e-learning — zet dat in beide (bijv. "… — e-learning" vs "… — klassikaal") zodat ze elkaar niet kannibaliseren.

### 8. Twee pagina's zonder H1

- `/contact` — geen H1, geen H2, 191 woorden
- `/code95-gids` — zie punt 4

`/contact` is een belangrijke pagina voor lokale zoekopdrachten ("rijschool Nuenen", "opleidingscentrum Eindhoven"). Een H1 en wat NAP-tekst, route en openingstijden helpen daar direct.

### 9. Twee pagina's zonder canonical

`/3-daagse-code-95-opleiding-korting` en `/code95-gids` (beide hierboven al genoemd). De overige 188 hebben een correcte, self-referencing canonical — mooi.

---

## P3 — Structureel, over de hele site

### 10. Titles: 129 van 190 zijn te lang, meestal door dubbele branding

67 titles bevatten "FrisseStart" twee keer:

| Patroon | Aantal |
|---|---|
| `… - FrisseStart Vacatures \| FrisseStart` | 33 |
| `… \| FrisseStart Kennisbank \| FrisseStart` | 13 |
| `… - FrisseStart Blog \| FrisseStart` | 11 |
| `… \| FrisseStart \| FrisseStart` | 8 |

De langste is 134 tekens:

> "Certificeringsbeheer voor transport en logistiek: houd je eenvoudig overzicht over al je certificaten - FrisseStart Blog | FrisseStart"

Google kapt rond de 60 tekens, dus het onderscheidende deel valt weg. **Wat te doen:** het template-suffix één keer toepassen. De sectienaam kan gerust weg — `… | FrisseStart` volstaat. Dat lost in één klap 54 van de 129 te lange titles op; voor de rest is de titel zelf te lang en moet de tekst korter.

### 11. 37 meta descriptions boven de 160 tekens

Langste: `/transport-logistiek` (229), `/heftruck-cursus-eindhoven` (212), `/reachtruck-cursus-helmond` (205). Ze worden afgekapt; de call-to-action staat vaak achteraan en verdwijnt dus.

### 12. 577 van 751 afbeeldingen zonder `width`/`height`

Zonder afmetingen kan de browser geen ruimte reserveren, wat CLS veroorzaakt. Next.js `<Image>` doet dit normaal automatisch — de gaten zitten dus vermoedelijk bij handgeschreven `<img>`-tags in content-blokken.

`alt`-teksten zijn juist wél in orde: 750 van 751 hebben er een. De enige uitzondering staat op `/blog/subsidies-en-financiele-voordelen-voor-code-95`.

### 13. Geen `fetchpriority="high"` op de LCP-afbeelding

Op de homepage staan 5 afbeeldingen: 3 lazy, 2 zonder `loading`-attribuut. Er is nergens een `fetchpriority="high"`. Het logo wordt wél gepreload (zelfs twee keer, via `proxy.frissestart.nl` én `/images/logo.png` — dat is dubbel werk), maar de daadwerkelijke hero-afbeelding niet.

### 14. 46 sitemap-URL's zonder `lastmod`

144 van de 190 hebben een `lastmod`; de rest niet — waaronder `/`, `/opleidingen`, `/opleidingen/code-95-opleidingen` en de andere hoofdingangen. Juist daar helpt `lastmod` bij hercrawlen. `changefreq` en `priority` worden door Google genegeerd; `lastmod` niet.

### 15. Interne linkstructuur is dun in de staart

Crawldiepte is prima (max 3 kliks), maar de verdeling van interne links niet:

- **2 pagina's** onbereikbaar vanaf de homepage (de twee weespagina's uit punt 4 en 5)
- **~60 pagina's** met precies 1 inkomende link — vrijwel alle `/vacatures/*` en veel `/opleidingen/*`-varianten

Pagina's als `/opleidingen/veilig-werken-met-de-bovenloopkraan`, `/opleidingen/u17-gebruik-laad--en-losmaterieel-autolaadkraan` en `/reachtruck-cursus-helmond` hangen aan één draadje. **Wat te doen:** een "gerelateerde cursussen"-blok onderaan elke cursuspagina (3–5 links naar verwante opleidingen) verdeelt de interne linkwaarde veel gelijkmatiger en is grotendeels automatiseerbaar op basis van categorie.

### 16. Dunne pagina's

| Pagina | Woorden |
|---|---|
| `/code95-gids` | 128 |
| `/contact` | 191 |
| `/gratis-adviesgesprek` | 273 |
| `/risicocheck` | 286 |
| `/offerte-maker` | 300 |
| `/kennisbank/intern-transport` | 341 |
| `/kennisbank/subsidies-organisaties` | 349 |

Voor tools (`/offerte-maker`, `/risicocheck`) is weinig tekst logisch. Voor de twee `/kennisbank/*`-pagina's niet: dat zijn hubpagina's die inhoudelijk zouden moeten ranken. De mediaan van de site is 2.520 woorden, dus deze vallen echt op.

---

## Wat al goed is

Het is de moeite waard te benoemen wat níet aangeraakt hoeft te worden:

- **Redirects:** `http://` → `https://`, `www` → apex en trailing slash → geen slash, allemaal netjes met 308. Geen ketens.
- **404's:** onbestaande URL's geven correct een 404, geen soft-404.
- **robots.txt:** correcte disallows op `/portaal/`, `/auth`, `/api/`, `/aanmelden/` en `/instructeur/`, met sitemap-verwijzing.
- **Organization-schema:** compleet ingevuld — adres, geo, openingstijden, KVK-nummer, `sameAs`, `areaServed` met de juiste regiogemeenten, `priceRange`, `hasCredential`. Dit is beter dan wat de meeste mkb-sites hebben.
- **Structured data-dekking:** 190× Organization + WebSite, 166× BreadcrumbList, 101× FAQPage, 37× Article, 33× JobPosting.
- **Compressie en caching van assets:** brotli actief, statische chunks op `max-age=31536000, immutable` met `cf-cache-status: HIT`. CSS is geminificeerd (371 KB ruw → 47 KB over de lijn).
- **Security headers:** HSTS met `includeSubDomains`, `X-Content-Type-Options: nosniff`, en een CSP in report-only modus (klaar om te handhaven).
- **Geen third-party bloat:** alle scripts en stylesheets komen van het eigen domein.

---

## Voorgestelde volgorde

| # | Actie | Impact | Werk |
|---|---|---|---|
| 1 | Edge-caching aanzetten voor publieke HTML | Hoog | Middel |
| 2 | `hasCourseInstance` + `offers` aanvullen (57 pagina's, via template) | Hoog | Middel |
| 3 | Dubbel `#organization`-blok op homepage weghalen | Middel | Klein |
| 4 | Redirect `/code95-gids` → `/lp/code95-gids`, sitemap bijwerken | Middel | Klein |
| 5 | Redirect `/3-daagse-code-95-opleiding-korting` → `/3-daagse-code-95-korting` | Middel | Klein |
| 6 | Title/meta van `/opleidingen/u05-vca-basis-of-vol-vca` corrigeren | Middel | Klein |
| 7 | Dubbele branding uit het title-template halen | Middel | Klein |
| 8 | H1 + NAP op `/contact` | Middel | Klein |
| 9 | "Gerelateerde cursussen"-blok voor interne links | Middel | Middel |
| 10 | `width`/`height` op resterende `<img>`-tags, `fetchpriority` op hero | Middel | Middel |
| 11 | 37 te lange meta descriptions inkorten | Laag | Middel |
| 12 | `lastmod` op de 46 ontbrekende sitemap-URL's | Laag | Klein |

---

## Niet gemeten

Twee dingen vielen buiten wat in deze omgeving te meten was, en zijn dus **niet** in het bovenstaande verwerkt:

- **Core Web Vitals (lab en veld).** De PageSpeed Insights API gaf "quota exceeded" op de anonieme quota, en een lokale Lighthouse-run mislukte omdat de uitgaande proxy van deze omgeving de verbindingen van Chromium naar frissestart.nl reset (curl werkt wel, de browser niet). De responstijden hierboven komen uit de crawl zelf en zijn server-side; ze zeggen iets over TTFB, niet over LCP/CLS/INP zoals gebruikers die ervaren. Draai PSI zelf of zet `FS_SEO_PAGESPEED_API` in `.env.local` om dit alsnog binnen te halen.
- **Posities en zoekvolumes.** Er is geen `FS_SERPER_API`-sleutel geconfigureerd, dus er zijn geen live ranking-checks gedaan. Ook Search Console-data ontbreekt (geen service account ingesteld). Alle bevindingen hierboven komen daarom uit de site zelf, niet uit prestatiedata.
