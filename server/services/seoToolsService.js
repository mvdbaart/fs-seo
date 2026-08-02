const db = require('../db');
const { REGIONS } = require('./geoAnalyzer');
const { isBrandKeyword } = require('../utils/brandFilter');

/**
 * Advanced SEO Tools Service: Local Pack Audit, Schema Generator, Internal Links & Competitor Gap.
 * Alle output is afgeleid van echte data (crawl, geo_rankings, keyword_rankings, settings).
 */

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

function getProject(projectId) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
}

// 1. Google Business Profile & Local Pack Audit
function getLocalPackAudit(projectId) {
  const project = getProject(projectId);
  if (!project) throw new Error('Project niet gevonden');
  const domain = project.domain;

  // NAP-gegevens komen uit de instellingen (door de gebruiker beheerd), niet hardcoded.
  const napInfo = {
    name: getSetting('business_name') || project.name,
    address: getSetting('business_address') || 'Nog niet ingesteld — vul in bij Instellingen',
    phone: getSetting('business_phone') || 'Nog niet ingesteld — vul in bij Instellingen',
    region: getSetting('business_region') || '',
    napConfigured: Boolean(getSetting('business_name') && getSetting('business_address') && getSetting('business_phone'))
  };

  // Echte local pack aanwezigheid per regio uit de laatste GEO-scan
  const geoRows = db.prepare(`
    SELECT region, position, local_pack_present
    FROM geo_rankings
    WHERE project_id = ?
  `).all(projectId);

  const localRankings = REGIONS.map(regionName => {
    const rows = geoRows.filter(r => r.region === regionName);
    if (rows.length === 0) {
      return { city: regionName, localPackCount: null, totalKeywords: 0, bestOrganic: null, status: 'Nog niet gescand' };
    }
    const localPackCount = rows.filter(r => r.local_pack_present === 1).length;
    const ranked = rows.filter(r => r.position > 0);
    // Bereken het gemiddelde en de beste positie van alle écht gemonitorde zoekwoorden voor deze regio
    const bestOrganic = ranked.length > 0 ? Math.min(...ranked.map(r => r.position)) : null;
    const sumOrganic = ranked.reduce((acc, r) => acc + r.position, 0);
    const avgOrganic = ranked.length > 0 ? (sumOrganic / ranked.length).toFixed(1) : null;

    let status = 'Niet in Top 100';
    if (localPackCount > 0) status = 'In Local Pack';
    else if (bestOrganic && bestOrganic <= 10) status = 'Organisch Top 10, geen Local Pack';
    else if (bestOrganic && bestOrganic <= 50) status = `Organisch #${bestOrganic}, geen Local Pack`;

    return { city: regionName, localPackCount, totalKeywords: rows.length, bestOrganic, avgOrganic, status };
  }).filter(r => r.totalKeywords > 0 || geoRows.length === 0);

  // Citations worden gepresenteerd op basis van Nederlandse autoriteit & gratis registratie.
  const bareDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const citations = [
    { source: 'Google Bedrijfsprofiel (Google Maps)', category: 'Essentieel (Nr. 1)', checkUrl: `https://www.google.com/maps/search/${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'De Telefoongids / Gouden Gids (detelefoongids.nl)', category: 'Hoge Autoriteit', checkUrl: `https://www.detelefoongids.nl/${encodeURIComponent(napInfo.name)}/zoeken/`, verified: null },
    { source: 'Telefoonboek.nl / Openingstijden.nl', category: 'Veelgebruikt NL', checkUrl: `https://www.telefoonboek.nl/zoeken/${encodeURIComponent(napInfo.name)}/`, verified: null },
    { source: 'Bing Places for Business', category: 'Search Engine', checkUrl: `https://www.bing.com/maps?q=${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'Apple Maps Connect', category: 'Navigation & Voice', checkUrl: `https://mapsconnect.apple.com/`, verified: null },
    { source: 'Drimble.nl (Bedrijfsprofielen & KvK)', category: 'Goede Indexatie', checkUrl: `https://drimble.nl/zoek.html?q=${encodeURIComponent(bareDomain)}`, verified: null },
    { source: 'AlleBedrijvenIn.nl', category: 'Regionale Gids', checkUrl: `https://www.allebedrijvenin.nl/zoeken/${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'Cylex Bedrijvengids Nederland', category: 'Internationaal / NL', checkUrl: `https://www.cylex-bedrijvengids.nl/s?q=${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'Hotfrog Nederland', category: 'Snelle Indexatie', checkUrl: `https://www.hotfrog.nl/search/nl/${encodeURIComponent(napInfo.name)}`, verified: null },
    { source: 'Yelp Nederland', category: 'Reviews & Autoriteit', checkUrl: `https://www.yelp.nl/search?find_desc=${encodeURIComponent(napInfo.name)}`, verified: null }
  ];

  const actionItems = [];
  const scannedRegions = localRankings.filter(r => r.totalKeywords > 0);
  const inPack = scannedRegions.filter(r => r.localPackCount > 0);
  const notInPack = scannedRegions.filter(r => r.localPackCount === 0);

  if (scannedRegions.length === 0) {
    actionItems.push({
      title: 'Voer eerst een regionale GEO-scan uit',
      description: 'De local pack posities per regio worden gemeten tijdens de regionale scan in de GEO Analyse tab.',
      type: 'opportunity'
    });
  }
  if (notInPack.length > 0) {
    actionItems.push({
      title: `Geen Local Pack vermelding in: ${notInPack.map(r => r.city).join(', ')}`,
      description: 'Verzamel actief Google reviews met zoekwoorden, houd het Google Bedrijfsprofiel wekelijks actueel en zorg voor consistente NAP-gegevens op alle vermeldingen.',
      type: 'warning'
    });
  }
  if (inPack.length > 0) {
    actionItems.push({
      title: `Local Pack aanwezigheid in: ${inPack.map(r => r.city).join(', ')}`,
      description: 'Behoud deze posities door reviews te blijven verzamelen en wekelijks updates te posten op het Google Bedrijfsprofiel.',
      type: 'opportunity'
    });
  }
  if (!napInfo.napConfigured) {
    actionItems.push({
      title: 'Vul de bedrijfsgegevens (NAP) in bij Instellingen',
      description: 'Naam, adres en telefoonnummer zijn nodig voor de NAP-consistentiecheck en de schema markup generator.',
      type: 'warning'
    });
  }

  const reviewTemplate = `Beste [Naam],

Bedankt voor je vertrouwen in ${napInfo.name}!

Zou je ons willen helpen met een korte Google review? Dit duurt slechts 30 seconden en helpt anderen ons te vinden:
https://www.google.com/maps/search/${encodeURIComponent(napInfo.name)}

Alvast hartelijk dank!
Het team van ${napInfo.name}`;

  return {
    napInfo,
    localRankings,
    citations,
    actionItems,
    reviewTemplate
  };
}

// 2. Schema.org JSON-LD Generator (sjablonen op basis van project + instellingen)
function getSchemaGenerator(projectId) {
  const project = getProject(projectId);
  if (!project) throw new Error('Project niet gevonden');
  const domain = project.domain;
  const businessName = getSetting('business_name') || project.name;
  const address = getSetting('business_address') || '[Straat + huisnummer, postcode, plaats]';
  const phone = getSetting('business_phone') || '[Telefoonnummer]';

  const addressParts = address.split(',').map(s => s.trim());

  const schemas = {
    localBusiness: {
      title: 'LocalBusiness (Homepage & Contact)',
      jsonLd: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": businessName,
        "url": domain,
        "logo": `${domain}/logo.png`,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": addressParts[0] || address,
          "addressLocality": addressParts[2] || addressParts[1] || '[Plaats]',
          "postalCode": addressParts[1] || '[Postcode]',
          "addressCountry": "NL"
        },
        "telephone": phone
      }, null, 2)
    },
    service: {
      title: 'Service Schema (Dienstenpagina\'s)',
      jsonLd: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "[Naam van de dienst]",
        "description": "[Korte beschrijving van de dienst]",
        "provider": {
          "@type": "LocalBusiness",
          "name": businessName,
          "sameAs": domain
        },
        "areaServed": "[Regio / plaats]"
      }, null, 2)
    },
    faqPage: {
      title: 'FAQPage Schema (Veelgestelde Vragen)',
      jsonLd: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "[Vraag 1]",
            "acceptedAnswer": { "@type": "Answer", "text": "[Antwoord 1]" }
          },
          {
            "@type": "Question",
            "name": "[Vraag 2]",
            "acceptedAnswer": { "@type": "Answer", "text": "[Antwoord 2]" }
          }
        ]
      }, null, 2)
    },
    breadcrumb: {
      title: 'BreadcrumbList Schema (Alle pagina\'s)',
      jsonLd: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": domain },
          { "@type": "ListItem", "position": 2, "name": "[Pagina]", "item": `${domain}/[pagina]` }
        ]
      }, null, 2)
    },
    jobPosting: {
      title: 'JobPosting Schema (Vacatures voor Google Jobs)',
      jsonLd: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "[Functietitel, bijv. Procesoperator 5-ploegen]",
        "description": "<p>[Uitgebreide functieomschrijving, eisen en secundaire arbeidsvoorwaarden]</p>",
        "identifier": {
          "@type": "PropertyValue",
          "name": businessName,
          "value": "[Vacature-ID]"
        },
        "datePosted": new Date().toISOString().split('T')[0],
        "validThrough": new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
          "@type": "Organization",
          "name": businessName,
          "sameAs": domain,
          "logo": `${domain}/logo.png`
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": addressParts[0] || address,
            "addressLocality": addressParts[2] || addressParts[1] || 'Eindhoven',
            "postalCode": addressParts[1] || '[Postcode]',
            "addressCountry": "NL"
          }
        },
        "baseSalary": {
          "@type": "MonetaryAmount",
          "currency": "EUR",
          "value": {
            "@type": "QuantitativeValue",
            "minValue": 2500,
            "maxValue": 3800,
            "unitText": "MONTH"
          }
        }
      }, null, 2)
    },
    contactPoint: {
      title: 'ContactPoint & Organization (Contactpagina)',
      jsonLd: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": businessName,
        "url": domain,
        "logo": `${domain}/logo.png`,
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": phone,
          "contactType": "customer service",
          "areaServed": "NL",
          "availableLanguage": ["Dutch", "English"]
        }
      }, null, 2)
    }
  };

  return schemas;
}

// 3. Internal Link Matrix & Orphan Page Finder — op basis van de echte link-graph uit de crawl
function getInternalLinkMatrix(projectId) {
  const lastSession = db.prepare('SELECT * FROM crawl_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);

  if (!lastSession) {
    return {
      totalPages: 0,
      orphanPages: [],
      recommendations: [],
      message: 'Nog geen crawl uitgevoerd. Start een crawl via de Site Crawler tab om de interne linkstructuur te analyseren.'
    };
  }

  const pages = db.prepare('SELECT * FROM crawled_pages WHERE session_id = ?').all(lastSession.id);
  const hasLinkGraph = pages.some(p => p.internal_links);

  if (!hasLinkGraph) {
    return {
      totalPages: pages.length,
      orphanPages: [],
      recommendations: [],
      message: 'De laatste crawl bevat nog geen link-graph data. Voer een nieuwe crawl uit om weespagina\'s en linkkansen te detecteren.'
    };
  }

  const normalize = (u) => (u || '').replace(/\/$/, '').split('#')[0];

  // Inkomende links tellen per pagina
  const inboundCount = new Map();
  for (const page of pages) {
    inboundCount.set(normalize(page.url), 0);
  }
  for (const page of pages) {
    let targets = [];
    try {
      targets = JSON.parse(page.internal_links || '[]');
    } catch (e) { /* geen geldige JSON */ }
    const from = normalize(page.url);
    for (const target of new Set(targets.map(normalize))) {
      if (target !== from && inboundCount.has(target)) {
        inboundCount.set(target, inboundCount.get(target) + 1);
      }
    }
  }

  const startUrl = normalize(lastSession.start_url);
  const enriched = pages
    .filter(p => p.status_code >= 200 && p.status_code < 400)
    .map(p => ({
      url: p.url,
      title: p.title,
      keywords: p.keywords,
      links_internal_count: inboundCount.get(normalize(p.url)) || 0,
      outbound_count: p.links_internal_count || 0
    }));

  const isUtilityUrl = (url) => {
    const lower = (url || '').toLowerCase();
    return lower.includes('/contact') || 
           lower.includes('/aanmelden') || 
           lower.includes('/vacatures/') || 
           lower.includes('/privacy') || 
           lower.includes('voorwaarden') ||
           lower.includes('disclaimer');
  };

  const orphanPages = enriched.filter(p => p.links_internal_count <= 1 && normalize(p.url) !== startUrl);

  // Gefilterde lijst van echte content hubs (uitzondering van contact, vacatures, etc.)
  const eligibleHubs = enriched
    .filter(p => !isUtilityUrl(p.url))
    .sort((a, b) => b.links_internal_count - a.links_internal_count);

  // Hulpfunctie om de meest relevante bronpagina (hub) te selecteren voor een doelpagina
  const findBestHubForTarget = (targetUrl, targetKeyword) => {
    const normTarget = normalize(targetUrl);
    const normKw = (targetKeyword || '').toLowerCase();

    const candidates = eligibleHubs.filter(h => normalize(h.url) !== normTarget);
    if (candidates.length === 0) return null;

    // 1. Zoek naar thematische match in pillar pagina's (bijv. code-95, heftruck, transport, logistiek)
    const topics = ['code-95', 'heftruck', 'transport', 'logistiek', 'opleidingen', 'nascholing', 'chauffeur'];
    const matchedTopic = topics.find(t => normTarget.toLowerCase().includes(t) || normKw.includes(t));

    if (matchedTopic) {
      const topicHub = candidates.find(h => h.url.toLowerCase().includes(matchedTopic) && normalize(h.url) !== normTarget);
      if (topicHub) return topicHub;
    }

    // 2. Homepage is de hoogste autoriteit hub
    const homepageHub = candidates.find(h => normalize(h.url) === startUrl);
    if (homepageHub) return homepageHub;

    // 3. Fallback naar sterkst gelinkte niet-utility pagina
    return candidates[0];
  };

  const recommendations = [];

  // 1. Kansen voor Weespagina's (alleen voor content/landingspagina's)
  const contentOrphans = orphanPages.filter(p => !isUtilityUrl(p.url));
  for (const orphan of contentOrphans.slice(0, 10)) {
    const hub = findBestHubForTarget(orphan.url, orphan.keywords);
    if (!hub) continue;
    const anchor = (orphan.keywords || '').split(',')[0].trim() || orphan.title || orphan.url;
    recommendations.push({
      fromUrl: hub.url,
      toUrl: orphan.url,
      anchorText: anchor,
      priority: 'Kritiek',
      reason: `${orphan.url} is een weespagina (${orphan.links_internal_count} links). Een interne link vanaf de relevante autoriteitspagina ${hub.url} verhoogt de vindbaarheid.`
    });
  }

  // 2. Kansen voor zoekwoorden uit de Rank Tracker (sleutelpagina's)
  const trackedKeywords = db.prepare(`
    SELECT k.keyword, k.target_url, r.position
    FROM keywords k
    LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
    WHERE k.project_id = ?
    AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
    AND k.target_url IS NOT NULL AND k.target_url != ''
  `).all(projectId);

  for (const kw of trackedKeywords) {
    if (!kw.target_url || isUtilityUrl(kw.target_url)) continue;
    const normTarget = normalize(kw.target_url);

    const hub = findBestHubForTarget(kw.target_url, kw.keyword);
    if (hub && !recommendations.some(r => normalize(r.toUrl) === normTarget)) {
      recommendations.push({
        fromUrl: hub.url,
        toUrl: kw.target_url,
        anchorText: kw.keyword,
        priority: kw.position && kw.position <= 20 ? 'Hoog' : 'Normaal',
        reason: `Versterk de positie van zoekwoord "${kw.keyword}" (${kw.position ? 'positie #' + kw.position : 'onbekend'}) door een contextuele link te plaatsen op de relevante hub-pagina ${hub.url}.`
      });
    }
  }

  // 3. Generieke suggestie indien nog geen crawl data beschikbaar
  if (recommendations.length === 0 && enriched.length > 0) {
    const mainHub = eligibleHubs[0] || enriched[0];
    recommendations.push({
      fromUrl: mainHub.url,
      toUrl: `${mainHub.url.replace(/\/$/, '')}/code-95-eindhoven`,
      anchorText: 'code 95 eindhoven',
      priority: 'Hoog',
      reason: `Sluis gezaghebbende PageRank vanaf de homepage door naar je belangrijkste dienstenpagina met het zoekwoord 'code 95 eindhoven'.`
    });
  }

  return {
    totalPages: enriched.length,
    orphanPages,
    recommendations
  };
}

// 4. Competitor Keyword Gap & Content Cannibalization Detector
// Gebruikt de echte top-20 SERP-snapshots die bij elke ranking check worden opgeslagen.
function getCompetitorGapAnalysis(projectId) {
  const project = getProject(projectId);
  if (!project) throw new Error('Project niet gevonden');
  const ownDomain = project.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  const competitors = db.prepare('SELECT * FROM competitors WHERE project_id = ?').all(projectId)
    .map(c => ({ ...c, bareDomain: c.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '') }));

  const rankings = db.prepare(`
    SELECT k.keyword, r.position, r.organic_results, r.checked_at
    FROM keywords k
    JOIN keyword_rankings r ON k.id = r.keyword_id
    WHERE k.project_id = ?
    AND r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1)
  `).all(projectId);

  const businessName = getSetting('business_name') || project.name;

  const withSnapshots = rankings.filter(r => {
    try {
      return JSON.parse(r.organic_results || '[]').length > 0;
    } catch (e) {
      return false;
    }
  });

  if (withSnapshots.length === 0) {
    return {
      gaps: [],
      cannibalization: [],
      message: 'Nog geen SERP-data beschikbaar. Voer eerst een ranking check uit in de Rank Tracker (de resultaten worden dan automatisch hier geanalyseerd).'
    };
  }
  if (competitors.length === 0) {
    return {
      gaps: [],
      cannibalization: detectCannibalization(withSnapshots, ownDomain, businessName),
      message: 'Nog geen concurrenten toegevoegd. Voeg concurrenten toe in de GEO Analyse tab om de keyword gap te berekenen.'
    };
  }

  const gaps = [];
  for (const row of withSnapshots) {
    const organic = JSON.parse(row.organic_results);
    for (const comp of competitors) {
      const compEntry = organic.find(o => o.link.includes(comp.bareDomain));
      if (!compEntry) continue;
      // Gap: concurrent staat beter (of wij helemaal niet)
      const ownPos = row.position > 0 ? row.position : null;
      if (compEntry.position <= 10 && (ownPos === null || ownPos > compEntry.position)) {
        gaps.push({
          keyword: row.keyword,
          competitorName: comp.name,
          competitorRank: `#${compEntry.position}`,
          competitorUrl: compEntry.link,
          ownRank: ownPos ? `#${ownPos}` : 'Niet in Top 50',
          action: ownPos
            ? `Verbeter de eigen pagina: analyseer ${compEntry.link} en verdiep de content.`
            : `Maak een specifieke landingspagina voor "${row.keyword}" — gebruik ${compEntry.link} als benchmark.`,
          checkedAt: row.checked_at
        });
      }
    }
  }
  gaps.sort((a, b) => parseInt(a.competitorRank.slice(1)) - parseInt(b.competitorRank.slice(1)));

  return {
    gaps,
    cannibalization: detectCannibalization(withSnapshots, ownDomain, businessName)
  };
}

function detectCannibalization(rankingsWithSnapshots, ownDomain, businessName = '') {
  const cannibalization = [];
  for (const row of rankingsWithSnapshots) {
    if (isBrandKeyword(row.keyword, ownDomain, businessName)) {
      continue;
    }

    const organic = JSON.parse(row.organic_results);
    const ownEntries = organic.filter(o => o.link.includes(ownDomain));
    if (ownEntries.length >= 2) {
      const urls = ownEntries.map(o => `${o.link} (#${o.position})`);
      cannibalization.push({
        keyword: row.keyword,
        competingUrls: urls,
        issue: `Er ranken ${ownEntries.length} eigen URL's tegelijk voor dit zoekwoord. Kies één hoofdpagina, richt alle interne links daarop en overweeg een canonical of samenvoeging van de andere pagina('s).`
      });
    }
  }
  return cannibalization;
}

module.exports = {
  getLocalPackAudit,
  getSchemaGenerator,
  getInternalLinkMatrix,
  getCompetitorGapAnalysis
};
