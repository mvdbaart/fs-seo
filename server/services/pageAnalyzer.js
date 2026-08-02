const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Single Page Deep SEO Analyzer & AI Prompt Generator
 */
async function analyzeSinglePage(targetUrl) {
  const startTime = Date.now();
  const url = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AntigravityPageDoctor/1.0'
    },
    timeout: 10000
  });

  const loadTimeMs = Date.now() - startTime;
  const statusCode = response.status;
  const html = response.data;
  const $ = cheerio.load(html);

  // Title Tag
  const title = $('title').text().trim() || '';
  const titleLength = title.length;

  // Meta Description
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
  const metaLength = metaDescription.length;

  // Open Graph
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
  const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() || '';
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || '';

  // Headings
  const h1List = [];
  $('h1').each((_, el) => h1List.push($(el).text().trim()));

  const h2List = [];
  $('h2').each((_, el) => h2List.push($(el).text().trim()));

  const h3List = [];
  $('h3').each((_, el) => h3List.push($(el).text().trim()));

  // Canonical & Robots
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const robots = $('meta[name="robots"]').attr('content') || '';

  // Schema.org Structured Data
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push(JSON.parse($(el).html()));
    } catch (e) {
      // Invalid JSON-LD
    }
  });

  // Images
  const images = [];
  let imagesMissingAlt = 0;
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt');
    const isMissing = alt === undefined || alt.trim() === '';
    if (isMissing) imagesMissingAlt++;
    images.push({ src, alt: alt || '', isMissingAlt: isMissing });
  });

  // Content Word Count
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText ? bodyText.split(' ').length : 0;

  // Links
  let internalLinks = 0;
  let externalLinks = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.startsWith('/') || href.includes(new URL(url).hostname)) {
      internalLinks++;
    } else if (href.startsWith('http')) {
      externalLinks++;
    }
  });

  // Score & Recommendation Engine
  const issues = [];
  let score = 100;

  // Title Audit
  if (!title) {
    score -= 20;
    issues.push({ type: 'critical', title: 'Ontbrekende Title Tag', description: 'De pagina heeft geen <title> element. Dit is essentieel voor Google indexering.' });
  } else if (titleLength < 30) {
    score -= 8;
    issues.push({ type: 'warning', title: 'Title Tag te kort', description: `Title is slechts ${titleLength} tekens. Aanbevolen lengte is tussen 45-60 tekens.` });
  } else if (titleLength > 60) {
    score -= 8;
    issues.push({ type: 'warning', title: 'Title Tag te lang', description: `Title is ${titleLength} tekens en zal worden afgekapt in de Google SERP.` });
  }

  // Meta Description Audit
  if (!metaDescription) {
    score -= 15;
    issues.push({ type: 'critical', title: 'Ontbrekende Meta Description', description: 'Geen meta description ingesteld. Google toont een willekeurige tekst van de pagina.' });
  } else if (metaLength < 100 || metaLength > 160) {
    score -= 6;
    issues.push({ type: 'warning', title: 'Suboptimale Meta Description Lengte', description: `Lengte is ${metaLength} tekens (optimaal is 130-155 tekens).` });
  }

  // H1 Audit
  if (h1List.length === 0) {
    score -= 15;
    issues.push({ type: 'critical', title: 'Ontbrekende H1 Koptekst', description: 'Er is geen <h1> koptekst aanwezig op de pagina.' });
  } else if (h1List.length > 1) {
    score -= 8;
    issues.push({ type: 'warning', title: 'Meerdere H1 Kopteksten', description: `Er zijn ${h1List.length} H1 elementen gevonden. Gebruik bij voorkeur exact 1 H1 per pagina.` });
  }

  // Alt Text Audit
  if (imagesMissingAlt > 0) {
    score -= Math.min(15, imagesMissingAlt * 3);
    issues.push({ type: 'warning', title: 'Afbeeldingen zonder Alt-tekst', description: `${imagesMissingAlt} van de ${images.length} afbeeldingen hebben geen alt attribuut voor Google afbeeldingen & toegankelijkheid.` });
  }

  // Word Count Audit
  if (wordCount < 300) {
    score -= 12;
    issues.push({ type: 'warning', title: 'Magere Content (Thin Content)', description: `Pagina bevat slechts ${wordCount} woorden. Google verkiest diepgaande content (>500 woorden).` });
  }

  // Schema.org Audit
  if (jsonLd.length === 0) {
    score -= 10;
    issues.push({ type: 'opportunity', title: 'Geen Schema.org Structured Data', description: 'Geen JSON-LD gevonden. Voeg Rich Snippet markup toe (bijv. WebPage, FAQPage of LocalBusiness).' });
  }

  // Canonical Audit
  if (!canonical) {
    score -= 5;
    issues.push({ type: 'opportunity', title: 'Geen Canonical Tag', description: 'Voeg een zelfverwijzende rel="canonical" toe om duplicaat content risico te vermijden.' });
  }

  score = Math.max(0, score);

  // Generate Custom AI Prompt Proposal
  const aiPromptProposal = `Je bent een vooraanstaande Senior SEO Specialist en Copywriter voor de Nederlandse markt.

Ik heb de volgende pagina geanalyseerd en vraag je om alle gevonden SEO-tekortkomingen direct op te lossen en te herschrijven:

=== PAGINA GEGEVENS ===
- URL: ${url}
- Huidige Title: ${title || '(Geen)'} (${titleLength} tekens)
- Huidige Meta Description: ${metaDescription || '(Geen)'} (${metaLength} tekens)
- Huidige H1: ${h1List.join(' | ') || '(Geen)'}
- H2 Kopteksten: ${h2List.slice(0, 5).join('; ') || '(Geen)'}
- Woorden Aantal: ${wordCount} woorden

=== GECONSTATEERDE PROLEMEN (${issues.length} punten) ===
${issues.map((iss, i) => `${i + 1}. [${iss.type.toUpperCase()}] ${iss.title}: ${iss.description}`).join('\n')}

=== OPDRACHT VOOR DE AI ===
Herschrijf en lever het volgende aan in perfect Nederlands geoptimaliseerd voor zoekmachines:
1. **Vernieuwde SEO Title Tag** (45 - 58 tekens, inclusief primair zoekwoord & merknaam).
2. **Vernieuwde Meta Description** (135 - 155 tekens, met een krachtige Call To Action).
3. **1x Geoptimaliseerde H1 Koptekst**.
4. **Strategische H2 & H3 Structuur** (inclusief 4 relevante subkoppen met zoekwoorden).
5. **JSON-LD Structured Data Code** (Schema.org WebPage of LocalBusiness) direct te kopiëren in HTML.
6. **3 Aanbevolen Alt-teksten** voor de belangrijkste afbeeldingen.
7. **Korte samenvatting** van welke verbeteringen de rangschikking in Google.nl zullen verhogen.`;

  return {
    url,
    statusCode,
    loadTimeMs,
    score,
    metrics: {
      title,
      titleLength,
      metaDescription,
      metaLength,
      ogTitle,
      ogDescription,
      ogImage,
      h1List,
      h2List,
      h3List,
      canonical,
      robots,
      wordCount,
      imagesTotal: images.length,
      imagesMissingAlt,
      internalLinks,
      externalLinks,
      jsonLdCount: jsonLd.length
    },
    issues,
    aiPromptProposal
  };
}

module.exports = { analyzeSinglePage };
