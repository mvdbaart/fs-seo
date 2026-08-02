# MEMORY.md - FrisseStart & SEO Toolkit Context Memory

This file serves as the permanent reference for FrisseStart.nl domain knowledge, codebase architecture (`fs-next`), and Search Console / SEO data.

---

## 1. Domain & Business Profile (FrisseStart)

- **Domain:** `https://frissestart.nl`
- **Sector / Niche:** Transport & Logistiek, Rijscholen (C/CE), Uitzendbureau & Veiligheidstrainingsbedrijf (Zuidoost-Brabant / Geldrop / Nuenen / Eindhoven / Helmond).
- **Core Business Model & Recurring Revenue:**
  1. **Certificeringsbeheer & Periodic Retaining:** Bedrijven en chauffeurs moeten hun certificaten up-to-date houden. Dit levert herhalende inkomsten op.
  2. **1-Uurs Hercertificering:** Snel en efficiënt verlengen voor ervaren chauffeurs.
  3. **Code 95 Cursuscombinaties:** Flexibele trajecten in 3 dagen of 3,5 dag dankzij e-learning combinaties.
  4. **Code 95 Veiligheidstrainingen & Nascholing:** (bijv. `/code-95-eindhoven`, SOOB-subsidieregeling).
  5. **Rijopleidingen & Cursussen:** Vrachtwagenchauffeur (C / CE), Heftruckcertificaat (`/heftruck-cursus`), VCA-cursus (`/vca-cursus`).
  6. **Transport Uitzendbureau & HRM:** Vacatures voor vrachtwagenchauffeurs en logistiek medewerkers (`/vacatures`, `/transport-logistiek`).

> 🛑 **IMPORTANT NOTE:** FrisseStart is **NOT** a financial debt assistance/bewindvoering agency. Do NOT suggest debt management/bewindvoering topics for FrisseStart.nl.

---

## 2. Codebase Architecture (`fs-next`)

- **Repository Location:** `c:\Users\mvdba\Documents\vms\FrisseStart\fs-next`
- **Framework:** Next.js (App Router, TypeScript, TailwindCSS, Supabase).
- **Production URL:** `https://frissestart.nl` (Vercel deployment `fs-next-jade.vercel.app`).
- **Database:** Supabase PostgreSQL (`courses`, `course_categories`, `course_variants`, `action_packages`, `marketing_content_items`, `blog_posts`).
- **SEO & Marketing Workflow:**
  - Integrated blog system with Markdown editor (`marketing_content_items` unified table).
  - Native RSS/Sitemap generation and automatic RLS-driven publishing (`publish_at`).

---

## 3. SEO & Google Search Console Data (`GSC / Serper Audit`)

### Live Rankings (Google.nl - Region Geldrop / Eindhoven):
- `#1` - `code 95 nascholing nuenen` (`https://frissestart.nl/code-95-eindhoven`)
- `#1` - `code 95 hercertificering 1 uur` (`https://frissestart.nl/opleidingen/1-uurs-hercertificering`)
- `#3` - `certificeringsbeheer transport logistiek` (`https://frissestart.nl/opleidingen/certificeringsbeheer`)
- `#3` - `code 95 eindhoven` (`https://frissestart.nl/code-95-eindhoven`)
- `#3` - `nascholing chauffeurs geldrop` (`https://frissestart.nl/`)
- `#6` - `transport uitzendbureau nuenen` (`https://frissestart.nl/vacatures`)
- `#7` - `code 95 certificering 3 dagen` (`https://frissestart.nl/3-daagse-code-95-korting`)
- `#10` - `code 95 in 3.5 dag behalen` (`https://frissestart.nl/3-daagse-code-95-opleiding-korting`)

### High-Priority Unranked Targets (Nieuwe Content / Autoblog Kansen):
1. `certificeringsbeheer` (`/opleidingen/certificeringsbeheer`)
2. `e-learning code 95 combineren` (`/code95-planner`)
3. `heftruckcertificaat halen eindhoven` (`/heftruck-cursus`)
4. `uitzendbureau transport eindhoven` (`/transport-logistiek`)
5. `vrachtwagenchauffeur vacatures brabant` (`/vacatures`)
6. `vca behalen regio geldrop` (`/vca-cursus`)

---

## 4. Planned Autoblog Architecture (`fs-next`)

For `fs-next`, the Autoblog engine focuses on:
1. **Target Topics:** Certificeringsbeheer, 1-uurs hercertificering, 3/3.5-daagse Code 95 met e-learning, SOOB-subsidies, en transport vacatures.
2. **SEO Structure:** Auto-generated Next.js articles with Course / JobPosting / LocalBusiness / FAQPage JSON-LD schema markup.
3. **Google Indexing API Trigger:** Instant pinging of Google on publication.
