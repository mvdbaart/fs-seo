const db = require('../db');
const gscClient = require('./gscClient');

/**
 * Google Search Console Audit & Action Plan Engine.
 * Met een gekoppeld service account komen klikken, vertoningen, CTR en posities
 * live uit de GSC API. Zonder koppeling vallen we terug op de eigen (echte)
 * ranking-data uit de database; CTR/impressies zijn dan onbekend en worden als
 * null teruggegeven — er wordt niets verzonnen.
 */

// Gemiddelde organische CTR per positie (industrie-benchmark) om het
// klik-potentieel van een lage CTR te kwantificeren.
const EXPECTED_CTR = [0.28, 0.15, 0.11, 0.08, 0.07, 0.05, 0.04, 0.035, 0.03, 0.025];

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function getLatestRankings(projectId) {
  return db.prepare(`
    SELECT k.keyword, k.target_url, k.region, r.position, r.url_found
    FROM keywords k
    LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
    WHERE k.project_id = ?
    AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
  `).all(projectId);
}

function getCrawlHealth(projectId) {
  const lastSession = db.prepare('SELECT * FROM crawl_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);
  if (!lastSession) return null;
  const pages = db.prepare('SELECT status_code FROM crawled_pages WHERE session_id = ?').all(lastSession.id);
  return {
    crawledPages: pages.length,
    validPages: pages.filter(p => p.status_code >= 200 && p.status_code < 400).length,
    errors: pages.filter(p => p.status_code >= 400).length,
    crawledAt: lastSession.created_at
  };
}function buildActionPlan(ctrOpportunities, strikingDistance, unranked) {
  const plan = [];

  if (ctrOpportunities.length > 0) {
    const voorbeelden = ctrOpportunities.slice(0, 3).map(o => `"${o.keyword}" (${o.position})`).join(', ');
    plan.push({
      phase: 'Fase 1: CTR verhogen op bestaande Pagina 1 posities',
      priority: 'Hoog',
      title: 'Meta Titles & Descriptions herschrijven',
      description: `Deze zoekwoorden staan al op pagina 1 maar halen minder klikken dan gemiddeld voor hun positie: ${voorbeelden}. Herschrijf de title en meta description met concrete USP's om de CTR te verhogen.`,
      timeframe: 'Week 1'
    });
  }

  if (strikingDistance.length > 0) {
    const voorbeelden = strikingDistance.slice(0, 3).map(o => `"${o.keyword}"`).join(', ');
    plan.push({
      phase: 'Fase 2: Hub & Spoke Uitbreiding voor Pagina 2 zoekwoorden',
      priority: 'Hoog',
      title: 'Spoke artikelen verdiepen & linken naar centrale Pillar Hub',
      description: `Zoekwoorden op positie 11-20 zoals ${voorbeelden} kun je naar pagina 1 tillen via de Hub & Spoke architectuur van fs-next. Bouw of verdiep specifieke Spoke pagina's (/kennisbank/[hub]/[spoke]) en plaats verplichte interne tekstlinks naar de overkoepelende Pillar pagina (/kennisbank/[hub]).`,
      timeframe: 'Week 2-3'
    });
  }

  if (unranked.length > 0) {
    const voorbeelden = unranked.slice(0, 3).map(o => `"${o.keyword}"`).join(', ');
    plan.push({
      phase: 'Fase 3: Nieuwe Hub & Spoke clusters bouwen',
      priority: 'Kritiek',
      title: 'Nieuwe Pillar & Spoke structuur inzetten',
      description: `Voor ${voorbeelden} is momenteel geen positie gevonden. Maak per hoofdthema een centrale Hub / Pillar pagina (/kennisbank/[hub]) met 3 tot 5 ondersteunende Spoke artikelen (/kennisbank/[hub]/[spoke]) die met zoekwoordrijke ankerteksten direct teruglinken naar de Pillar.`,
      timeframe: 'Direct'
    });
  }

  if (plan.length === 0) {
    plan.push({
      phase: 'Monitoring',
      priority: 'Laag',
      title: 'Geen urgente actiepunten gevonden',
      description: 'Voeg meer zoekwoorden toe aan de Rank Tracker of voer een nieuwe ranking check uit om actiepunten te genereren.',
      timeframe: 'Doorlopend'
    });
  }

  return plan;
}

function buildAiPrompts(projectName, domain, ctrOpportunities, strikingDistance) {
  const ctrList = ctrOpportunities.slice(0, 5).map(o => `- "${o.keyword}" op positie ${o.position} (URL: ${o.targetUrl || domain})`).join('\n') || '- (nog geen pagina 1 posities gemeten)';
  const sdList = strikingDistance.slice(0, 5).map(o => `- "${o.keyword}" op positie ${o.position}`).join('\n') || '- (nog geen striking distance zoekwoorden gemeten)';

  return {
    ctrBoostPrompt: `Je bent een vooraanstaande SEO Copywriter voor ${projectName} (${domain}).

Deze pagina's ranken al op pagina 1 van Google.nl maar halen te weinig klikken:
${ctrList}

Opdracht:
1. Geef per zoekwoord 2 geoptimaliseerde SEO Title Tags (45 - 58 tekens). Laat de merknaam weg als de titel anders >58 tekens wordt, en gebruik geen emdashes (—) maar alleen '|' of '-'.
2. Geef per zoekwoord 2 geoptimaliseerde Meta Descriptions (135 - 155 tekens).
3. Verwerk concrete USP's en een duidelijke call-to-action.`,

    page2JumpPrompt: `Je bent een SEO Content Strategist voor ${projectName} (${domain}).

Onze website maakt gebruik van de **Hub & Spoke architectuur van fs-next** (/kennisbank/[hub]/[spoke]).
Centrale Pillar / Hub pagina's overkoepelen hoofdthema's, en ondersteunende Spoke artikelen versterken de Hub via gerichte interne links.

Deze zoekwoorden staan op pagina 2 van Google.nl (positie 11-20):
${sdList}

Schrijf per zoekwoord een Hub & Spoke uitbreidingsplan:
1. **Thema & Structuur**: Bepaal onder welke overkoepelende Pillar / Hub pagina (/kennisbank/[hub]) dit zoekwoord valt.
2. **Spoke Artikel Specs** (/kennisbank/[hub]/[spoke-slug]):
   - 1x geoptimaliseerde H1 koptekst.
   - 4x H2 subkoppen die de zoekintentie beantwoorden.
   - 350+ woorden verdiepende content.
3. **Interne Link Instructies (CRUCIAAL voor fs-next Hub & Spoke)**:
   - Neem in de eerste alinea van het Spoke artikel 1 verplichte interne tekstlink op naar de centrale Hub / Pillar pagina (/kennisbank/[hub]) met zoekwoordrijke ankertekst.
   - Link onderaan naar verwante Spoke artikelen (sibling spokes) en naar de relevante commerciële cursus/dienst pagina van FrisseStart.
4. **JSON-LD Schema**: Genereer passende FAQPage & Article schema markup.`
  };
}

function isBrandKeyword(keyword, domain = '', businessName = '') {
  if (!keyword || typeof keyword !== 'string') return false;
  const kw = keyword.toLowerCase().trim();
  const kwNoSpace = kw.replace(/[^a-z0-9]/g, '');
  if (!kwNoSpace) return false;

  const cleanDomain = (domain || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .split('.')[0]
    .toLowerCase();
  const domainStem = cleanDomain.replace(/[^a-z0-9]/g, '');

  if (domainStem && domainStem.length >= 3 && kwNoSpace.includes(domainStem)) {
    return true;
  }

  if (businessName && typeof businessName === 'string') {
    const cleanBiz = businessName
      .toLowerCase()
      .replace(/\b(bv|vof|n\.v\.|inc|llc|flex|&|opleiden)\b/gi, '')
      .trim();
    const bizStem = cleanBiz.replace(/[^a-z0-9]/g, '');
    if (bizStem && bizStem.length >= 3 && kwNoSpace.includes(bizStem)) {
      return true;
    }
  }

  return false;
}

async function analyzeGscDataLive(project, domain) {
  const siteUrl = await gscClient.resolveSiteUrl(domain);
  if (!siteUrl) {
    throw new Error(`Geen GSC property gevonden voor ${domain}. Voeg het service account e-mailadres toe als gebruiker in Search Console.`);
  }

  const end = new Date();
  end.setDate(end.getDate() - 2); // GSC-data loopt ~2 dagen achter
  const start = new Date(end);
  start.setDate(start.getDate() - 27);
  const startDate = formatDate(start);
  const endDate = formatDate(end);

  const [totalRows, queryRows, sitemaps] = await Promise.all([
    gscClient.querySearchAnalytics(siteUrl, { startDate, endDate, dimensions: [], rowLimit: 1 }),
    gscClient.querySearchAnalytics(siteUrl, { startDate, endDate, dimensions: ['query', 'page'], rowLimit: 500 }),
    gscClient.listSitemaps(siteUrl).catch(() => [])
  ]);

  const totalRow = totalRows[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const totals = {
    totalClicks: Math.round(totalRow.clicks),
    totalImpressions: Math.round(totalRow.impressions),
    averageCtr: (totalRow.ctr * 100).toFixed(2) + '%',
    averagePosition: Number(totalRow.position.toFixed(1))
  };

  const ctrOpportunities = [];
  const strikingDistance = [];

  for (const row of queryRows) {
    const [query, page] = row.keys;
    
    // Merknaam zoekwoorden uitsluiten van SEO kansen & actieplan
    if (isBrandKeyword(query, domain, project.name)) {
      continue;
    }

    const position = row.position;
    const entryBase = {
      keyword: query,
      position: `#${Math.round(position)}`,
      impressions: Math.round(row.impressions),
      ctr: (row.ctr * 100).toFixed(2) + '%',
      targetUrl: page
    };

    if (position <= 10.5 && row.impressions >= 20) {
      const expected = EXPECTED_CTR[Math.min(Math.round(position), 10) - 1] || 0.02;
      const extraClicks = Math.round(row.impressions * (expected - row.ctr));
      if (extraClicks > 5) {
        ctrOpportunities.push({ ...entryBase, potentialClicks: `+${extraClicks}/mnd` });
      }
    } else if (position > 10.5 && position <= 20.5 && row.impressions >= 10) {
      strikingDistance.push(entryBase);
    }
  }

  ctrOpportunities.sort((a, b) => b.impressions - a.impressions);
  strikingDistance.sort((a, b) => b.impressions - a.impressions);

  const crawlHealth = getCrawlHealth(project.id);
  const primarySitemap = sitemaps[0];
  const indexationHealth = {
    validPages: crawlHealth ? crawlHealth.validPages : null,
    excludedPages: null,
    errors: crawlHealth ? crawlHealth.errors : null,
    sitemapStatus: primarySitemap
      ? `Ingediend: ${primarySitemap.path}${primarySitemap.lastSubmitted ? ' (laatst: ' + primarySitemap.lastSubmitted.slice(0, 10) + ')' : ''}`
      : 'Geen sitemap ingediend in Search Console'
  };

  return {
    domain,
    gscConnected: true,
    siteUrl,
    period: { startDate, endDate },
    totals,
    ctrOpportunities: ctrOpportunities.slice(0, 25),
    strikingDistance: strikingDistance.slice(0, 25),
    indexationHealth,
    actionPlan: buildActionPlan(ctrOpportunities, strikingDistance, []),
    aiPrompts: buildAiPrompts(project.name, domain, ctrOpportunities, strikingDistance)
  };
}

function analyzeGscDataFallback(project, domain, gscError) {
  const rankings = getLatestRankings(project.id);

  const ctrOpportunities = [];
  const strikingDistance = [];
  const unranked = [];

  for (const row of rankings) {
    if (isBrandKeyword(row.keyword, domain, project.name)) {
      continue;
    }

    const entry = {
      keyword: row.keyword,
      position: row.position > 0 ? `#${row.position}` : 'Niet gevonden (>50)',
      impressions: null,
      ctr: null,
      targetUrl: row.url_found || row.target_url || domain,
      potentialClicks: null
    };

    if (row.position > 0 && row.position <= 10) {
      ctrOpportunities.push(entry);
    } else if (row.position > 10 && row.position <= 20) {
      strikingDistance.push(entry);
    } else {
      unranked.push(entry);
    }
  }

  const rankedPositions = rankings.filter(r => r.position > 0).map(r => r.position);
  const totals = {
    totalClicks: null,
    totalImpressions: null,
    averageCtr: null,
    averagePosition: rankedPositions.length > 0
      ? Number((rankedPositions.reduce((a, b) => a + b, 0) / rankedPositions.length).toFixed(1))
      : null
  };

  const crawlHealth = getCrawlHealth(project.id);
  const indexationHealth = {
    validPages: crawlHealth ? crawlHealth.validPages : null,
    excludedPages: null,
    errors: crawlHealth ? crawlHealth.errors : null,
    sitemapStatus: 'Onbekend — koppel Google Search Console voor sitemap-status'
  };

  return {
    domain,
    gscConnected: false,
    gscError: gscError || null,
    connectInstructions: 'Koppel Google Search Console via een service account: maak in Google Cloud een service account aan, download de JSON-sleutel, plak deze bij Instellingen, en voeg het service account e-mailadres toe als gebruiker (Volledig) in Search Console.',
    totals,
    ctrOpportunities,
    strikingDistance: [...strikingDistance, ...unranked],
    indexationHealth,
    actionPlan: buildActionPlan(ctrOpportunities, strikingDistance, unranked),
    aiPrompts: buildAiPrompts(project.name, domain, ctrOpportunities, strikingDistance)
  };
}

async function analyzeGscData(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('Project niet gevonden');
  const domain = project.domain;

  if (gscClient.isConfigured()) {
    try {
      return await analyzeGscDataLive(project, domain);
    } catch (err) {
      console.error('GSC API fout, terugvallen op eigen ranking-data:', err.message);
      return analyzeGscDataFallback(project, domain, err.message);
    }
  }

  return analyzeGscDataFallback(project, domain, null);
}

let gscKeywordMetricsCache = {
  data: {},
  timestamp: 0
};

/**
 * Fetch keyword metrics (impressions, clicks, ctr, trend) from Google Search Console
 * for all keywords associated with a project. Caches results for 5 minutes.
 */
async function getGscKeywordMetrics(projectId) {
  const cacheKey = `proj_${projectId}`;
  const now = Date.now();
  if (gscKeywordMetricsCache.data[cacheKey] && (now - gscKeywordMetricsCache.timestamp < 5 * 60 * 1000)) {
    return gscKeywordMetricsCache.data[cacheKey];
  }

  const defaultResult = { gscConnected: false, map: {} };

  if (!gscClient.isConfigured()) {
    return defaultResult;
  }

  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return defaultResult;

    const siteUrl = await gscClient.resolveSiteUrl(project.domain);
    if (!siteUrl) return defaultResult;

    const end = new Date();
    end.setDate(end.getDate() - 2); // GSC data runs ~2 days behind
    const start = new Date(end);
    start.setDate(start.getDate() - 27); // Last 28 days

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 27); // Previous 28 days

    const [currentRows, prevRows] = await Promise.all([
      gscClient.querySearchAnalytics(siteUrl, {
        startDate: formatDate(start),
        endDate: formatDate(end),
        dimensions: ['query'],
        rowLimit: 1000
      }).catch(() => []),
      gscClient.querySearchAnalytics(siteUrl, {
        startDate: formatDate(prevStart),
        endDate: formatDate(prevEnd),
        dimensions: ['query'],
        rowLimit: 1000
      }).catch(() => [])
    ]);

    const prevMap = {};
    for (const row of prevRows) {
      if (row.keys && row.keys[0]) {
        prevMap[row.keys[0].toLowerCase().trim()] = Math.round(row.impressions);
      }
    }

    const map = {};
    for (const row of currentRows) {
      if (row.keys && row.keys[0]) {
        const kw = row.keys[0].toLowerCase().trim();
        const impressions = Math.round(row.impressions);
        const clicks = Math.round(row.clicks);
        const ctr = (row.ctr * 100).toFixed(1) + '%';
        const prevImpressions = prevMap[kw] || 0;

        let trend = 0;
        if (prevImpressions > 0) {
          trend = Math.round(((impressions - prevImpressions) / prevImpressions) * 100);
        } else if (impressions > 0) {
          trend = 100; // New query appearing in search console
        }

        map[kw] = { impressions, clicks, ctr, prevImpressions, trend };
      }
    }

    const result = { gscConnected: true, map };
    gscKeywordMetricsCache.data[cacheKey] = result;
    gscKeywordMetricsCache.timestamp = now;
    return result;
  } catch (err) {
    console.error('Fout bij ophalen GSC zoekwoord-statistieken:', err.message);
    return defaultResult;
  }
}

module.exports = { analyzeGscData, getGscKeywordMetrics };

