const db = require('../db');
const gscClient = require('./gscClient');
const ga4Client = require('./ga4Client');
const gbpPerformanceService = require('./gbpPerformanceService');
const placesService = require('./placesService');
const { isBrandKeyword } = require('../utils/brandFilter');
const { isPathExcluded, parseExcludedPaths } = require('../utils/pathFilter');
const { recordSnapshots, getSeries } = require('./metricSnapshots');

/**
 * Insights engine: verzamelt uit elke gekoppelde bron wat er beter en slechter
 * ging ten opzichte van de vorige periode. Levert genormaliseerde 'signalen',
 * geen proza — dat doet insightsNarrator.js.
 *
 * De kern van dit bestand is makeSignal(): dat is de enige plek waar bepaald
 * wordt of een beweging positief of negatief is. Metrieken waarbij lager beter
 * is (positie, bouncepercentage, foutpagina's) draaien daar het sentiment om.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

// ----------------------------------------------------
// Periodes
// ----------------------------------------------------

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * GSC loopt ~2-3 dagen achter, GA4 ~1. Eén gedeeld venster houdt de
 * vergelijking tussen bronnen eerlijk.
 */
function buildWindows(days = 28, lagDays = 3) {
  const end = new Date();
  end.setDate(end.getDate() - lagDays);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));

  return {
    days,
    current: { startDate: formatDate(start), endDate: formatDate(end) },
    previous: { startDate: formatDate(prevStart), endDate: formatDate(prevEnd) },
    label: `${formatDutchDate(start)} t/m ${formatDutchDate(end)} ${end.getFullYear()}`,
    comparisonLabel: `vergeleken met de ${days} dagen daarvoor`
  };
}

const DUTCH_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function formatDutchDate(date) {
  return `${date.getDate()} ${DUTCH_MONTHS[date.getMonth()]}`;
}

// ----------------------------------------------------
// Signalen
// ----------------------------------------------------

/**
 * Drempels per signaal. Zonder deze filter wordt elke toevallige schommeling
 * gemeld als 'nieuws'. minBase voorkomt dat 2 -> 4 klikken als +100% telt.
 */
const THRESHOLDS = {
  'gsc.clicks': { minAbs: 5, minPct: 10, minBase: 50 },
  'gsc.impressions': { minAbs: 100, minPct: 10, minBase: 500 },
  'gsc.ctr': { minAbs: 0.3, minPct: 0, minBase: 0 },
  'gsc.position': { minAbs: 0.3, minPct: 0, minBase: 0 },
  'ga4.sessions': { minAbs: 20, minPct: 10, minBase: 100 },
  'ga4.engagedSessions': { minAbs: 15, minPct: 10, minBase: 80 },
  'ga4.keyEvents': { minAbs: 3, minPct: 15, minBase: 10 },
  'ga4.bounceRate': { minAbs: 3, minPct: 0, minBase: 0 },
  'ga4.avgDuration': { minAbs: 5, minPct: 10, minBase: 0 },
  'rankings.top3': { minAbs: 1, minPct: 0, minBase: 0 },
  'rankings.top10': { minAbs: 1, minPct: 0, minBase: 0 },
  'rankings.avgPosition': { minAbs: 0.5, minPct: 0, minBase: 0 },
  'rankings.totalKeywords': { minAbs: Infinity, minPct: 0, minBase: 0 },
  'pagespeed.performance': { minAbs: 5, minPct: 0, minBase: 0 },
  'pagespeed.lcp': { minAbs: 0.2, minPct: 0, minBase: 0 },
  'pagespeed.cls': { minAbs: 0.02, minPct: 0, minBase: 0 },
  'crawl.errors': { minAbs: 1, minPct: 0, minBase: 0 },
  'crawl.pages': { minAbs: 5, minPct: 10, minBase: 20 },
  'gbp.impressions': { minAbs: 100, minPct: 10, minBase: 500 },
  'gbp.calls': { minAbs: 3, minPct: 15, minBase: 10 },
  'gbp.directions': { minAbs: 5, minPct: 15, minBase: 20 },
  'gbp.websiteClicks': { minAbs: 5, minPct: 10, minBase: 25 },
  'gbp.conversations': { minAbs: 3, minPct: 20, minBase: 5 },
  'places.rating': { minAbs: 0.1, minPct: 0, minBase: 0 },
  'places.reviewCount': { minAbs: 2, minPct: 0, minBase: 0 },
  'places.ratingGap': { minAbs: 0.2, minPct: 0, minBase: 0 }
};

function round(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function isSignificant(id, { delta, deltaPct, current, previous }) {
  const t = THRESHOLDS[id];
  if (!t) return Math.abs(deltaPct ?? 0) >= 10;
  if (!Number.isFinite(t.minAbs)) return false;
  if (Math.abs(delta) < t.minAbs) return false;
  if (t.minBase && Math.max(current, previous) < t.minBase) return false;
  if (t.minPct && deltaPct !== null && Math.abs(deltaPct) < t.minPct) return false;
  return true;
}

function computeMagnitude(id, delta) {
  const t = THRESHOLDS[id];
  if (!t || !Number.isFinite(t.minAbs) || t.minAbs === 0) return 0;
  return Math.min(1, Math.abs(delta) / (t.minAbs * 10));
}

/**
 * De enige plek waar sentiment bepaald wordt. Een gemiddelde positie van
 * 8,0 -> 5,0 is direction 'down' maar sentiment 'positive'.
 */
function makeSignal({ id, source, metric, label, unit, lowerIsBetter = false, current, previous, detail = {} }) {
  const base = { id, source, metric, label, unit, lowerIsBetter, current, previous, detail };

  const missing = current === null || current === undefined || previous === null || previous === undefined
    || Number.isNaN(Number(current)) || Number.isNaN(Number(previous));

  if (missing) {
    return { ...base, delta: null, deltaPct: null, direction: 'flat', sentiment: 'neutral', significant: false, magnitude: 0 };
  }

  const delta = round(current - previous, 3);
  const deltaPct = previous !== 0 ? round((delta / Math.abs(previous)) * 100, 1) : null;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const sentiment = direction === 'flat'
    ? 'neutral'
    : ((direction === 'up') !== lowerIsBetter ? 'positive' : 'negative');

  return {
    ...base,
    delta,
    deltaPct,
    direction,
    sentiment,
    significant: isSignificant(id, { delta, deltaPct, current, previous }),
    magnitude: computeMagnitude(id, delta)
  };
}

// ----------------------------------------------------
// Collector: Google Search Console
// ----------------------------------------------------

function sumRows(rows) {
  const totals = rows.reduce((acc, r) => {
    acc.clicks += r.clicks || 0;
    acc.impressions += r.impressions || 0;
    return acc;
  }, { clicks: 0, impressions: 0 });
  return totals;
}

function indexByKey(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.keys?.[0];
    if (!key) continue;
    map.set(key, row);
  }
  return map;
}

/**
 * Stijgers en dalers. Alleen items met genoeg volume, zodat een sprong van
 * 1 naar 3 klikken niet als 'grootste stijger' bovenaan komt.
 */
function buildMovers(currentRows, previousRows, { skipKey } = {}) {
  const prevMap = indexByKey(previousRows);
  const currMap = indexByKey(currentRows);
  const keys = new Set([...currMap.keys(), ...prevMap.keys()]);

  const items = [];
  for (const key of keys) {
    if (skipKey && skipKey(key)) continue;
    const curr = currMap.get(key);
    const prev = prevMap.get(key);

    const clicks = Math.round(curr?.clicks || 0);
    const prevClicks = Math.round(prev?.clicks || 0);
    const impressions = Math.round(curr?.impressions || 0);
    const prevImpressions = Math.round(prev?.impressions || 0);
    const position = curr?.position ? round(curr.position, 1) : null;
    const prevPosition = prev?.position ? round(prev.position, 1) : null;

    const clicksDelta = clicks - prevClicks;
    const positionDelta = (position !== null && prevPosition !== null)
      ? round(prevPosition - position, 1) // positief = verbeterd
      : null;

    if (Math.max(clicks, prevClicks) < 10) continue;

    const worthReporting = Math.abs(clicksDelta) >= 5
      || (positionDelta !== null && Math.abs(positionDelta) >= 1.5 && Math.max(impressions, prevImpressions) >= 100);
    if (!worthReporting) continue;

    items.push({ key, clicks, prevClicks, clicksDelta, impressions, prevImpressions, position, prevPosition, positionDelta });
  }

  items.sort((a, b) => Math.abs(b.clicksDelta) - Math.abs(a.clicksDelta));

  return {
    winners: items.filter((i) => i.clicksDelta > 0).slice(0, 5),
    losers: items.filter((i) => i.clicksDelta < 0).slice(0, 5)
  };
}

async function collectGscSignals(project, windows) {
  if (!gscClient.isConfigured()) {
    return {
      connected: false,
      reason: 'not_configured',
      message: 'Search Console is nog niet gekoppeld. Plak de service-account JSON bij Instellingen en voeg het service account toe als gebruiker in Search Console.',
      signals: [],
      movers: {}
    };
  }

  const siteUrl = await gscClient.resolveSiteUrl(project.domain);
  if (!siteUrl) {
    return {
      connected: false,
      reason: 'no_property',
      message: `Geen Search Console property gevonden voor ${project.domain}. Voeg het service account toe als gebruiker in Search Console.`,
      signals: [],
      movers: {}
    };
  }

  const q = (range, dimensions, rowLimit) => gscClient.querySearchAnalytics(siteUrl, {
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions,
    rowLimit
  }).catch(() => null);

  const [totalsNow, totalsPrev, queriesNow, queriesPrev, pagesNow, pagesPrev, dailyNow] = await Promise.all([
    q(windows.current, [], 1),
    q(windows.previous, [], 1),
    q(windows.current, ['query'], 1000),
    q(windows.previous, ['query'], 1000),
    q(windows.current, ['page'], 500),
    q(windows.previous, ['page'], 500),
    q(windows.current, ['date'], 500)
  ]);

  if (!totalsNow || !totalsPrev) {
    return {
      connected: false,
      reason: 'api_error',
      message: 'Search Console gaf geen data terug voor deze periode.',
      signals: [],
      movers: {}
    };
  }

  const now = totalsNow[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const prev = totalsPrev[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

  const signals = [
    makeSignal({
      id: 'gsc.clicks', source: 'gsc', metric: 'clicks', label: 'Klikken vanuit Google', unit: 'count',
      current: Math.round(now.clicks), previous: Math.round(prev.clicks)
    }),
    makeSignal({
      id: 'gsc.impressions', source: 'gsc', metric: 'impressions', label: 'Vertoningen in Google', unit: 'count',
      current: Math.round(now.impressions), previous: Math.round(prev.impressions)
    }),
    makeSignal({
      id: 'gsc.ctr', source: 'gsc', metric: 'ctr', label: 'Doorklikpercentage', unit: 'percentPoint',
      current: round(now.ctr * 100, 2), previous: round(prev.ctr * 100, 2)
    }),
    makeSignal({
      id: 'gsc.position', source: 'gsc', metric: 'position', label: 'Gemiddelde positie in Google', unit: 'position',
      lowerIsBetter: true,
      current: round(now.position, 1), previous: round(prev.position, 1)
    })
  ];

  const skipBrand = (key) => isBrandKeyword(key, project.domain, project.name);

  return {
    connected: true,
    siteUrl,
    signals,
    movers: {
      gscQueries: buildMovers(queriesNow || [], queriesPrev || [], { skipKey: skipBrand }),
      gscPages: buildMovers(pagesNow || [], pagesPrev || [])
    },
    daily: (dailyNow || []).map((row) => ({
      day: row.keys?.[0],
      clicks: Math.round(row.clicks || 0),
      impressions: Math.round(row.impressions || 0),
      ctr: round((row.ctr || 0) * 100, 2),
      position: round(row.position || 0, 1)
    })).filter((r) => r.day)
  };
}

// ----------------------------------------------------
// Collector: Google Analytics 4
// ----------------------------------------------------

function buildLandingPageMovers(current, previous) {
  const prevMap = new Map(previous.map((p) => [p.path, p]));
  const items = [];

  for (const page of current) {
    const prev = prevMap.get(page.path);
    const prevSessions = prev ? prev.sessions : 0;
    const delta = page.sessions - prevSessions;
    if (Math.max(page.sessions, prevSessions) < 25) continue;
    if (prevSessions > 0 && Math.abs(delta / prevSessions) < 0.2) continue;
    if (prevSessions === 0 && page.sessions < 25) continue;
    items.push({
      key: page.path,
      sessions: page.sessions,
      prevSessions,
      sessionsDelta: delta,
      bounceRate: round(page.bounceRate, 1),
      keyEvents: page.keyEvents
    });
  }

  items.sort((a, b) => Math.abs(b.sessionsDelta) - Math.abs(a.sessionsDelta));
  return {
    winners: items.filter((i) => i.sessionsDelta > 0).slice(0, 5),
    losers: items.filter((i) => i.sessionsDelta < 0).slice(0, 5)
  };
}

async function collectGa4Signals(project, windows) {
  const summary = await ga4Client.getGa4Summary(project, windows);

  if (!summary.connected) {
    return {
      connected: false,
      reason: summary.reason,
      message: summary.message,
      signals: [],
      movers: {}
    };
  }

  const { totals, previousTotals } = summary;

  const signals = [
    makeSignal({
      id: 'ga4.sessions', source: 'ga4', metric: 'sessions', label: 'Bezoeken via organisch zoeken', unit: 'count',
      current: totals.sessions, previous: previousTotals.sessions
    }),
    makeSignal({
      id: 'ga4.engagedSessions', source: 'ga4', metric: 'engagedSessions', label: 'Betrokken bezoeken', unit: 'count',
      current: totals.engagedSessions, previous: previousTotals.engagedSessions
    }),
    makeSignal({
      id: 'ga4.keyEvents', source: 'ga4', metric: 'keyEvents', label: 'Conversies uit organisch verkeer', unit: 'count',
      current: totals.keyEvents, previous: previousTotals.keyEvents
    }),
    makeSignal({
      id: 'ga4.avgDuration', source: 'ga4', metric: 'avgDuration', label: 'Gemiddelde bezoekduur', unit: 'seconds',
      current: round(totals.averageSessionDuration, 1), previous: round(previousTotals.averageSessionDuration, 1)
    }),
    makeSignal({
      id: 'ga4.bounceRate', source: 'ga4', metric: 'bounceRate', label: 'Bouncepercentage', unit: 'percentPoint',
      lowerIsBetter: true,
      current: round(totals.bounceRate, 1), previous: round(previousTotals.bounceRate, 1)
    })
  ];

  // Geen sleutelgebeurtenissen ingesteld is iets anders dan 'nul conversies'.
  const gaps = [];
  if (totals.keyEvents === null) {
    gaps.push({
      source: 'ga4',
      message: 'Deze GA4 property levert geen conversiecijfers. Stel sleutelgebeurtenissen in om conversies te kunnen volgen.'
    });
  } else if (totals.keyEvents === 0 && previousTotals.keyEvents === 0) {
    gaps.push({
      source: 'ga4',
      message: 'Er zijn geen sleutelgebeurtenissen geregistreerd in beide periodes. Controleer of de conversiedoelen in GA4 goed staan ingesteld.'
    });
  }
  if (summary.channelWarning) {
    gaps.push({ source: 'ga4', message: summary.channelWarning });
  }

  // Paden uitsluiten zoals /auth, /admin, /portaal
  const savedExcl = db.prepare("SELECT value FROM settings WHERE key = 'ga4_excluded_paths'").get();
  const exclRaw = savedExcl ? savedExcl.value : '/auth, /admin, /portaal';
  const excludedTerms = parseExcludedPaths(exclRaw);

  const filteredLandingPages = (summary.landingPages || []).filter((p) => !isPathExcluded(p.path, excludedTerms));

  // Beide optioneel: totalen staan al vast, dit verrijkt alleen.
  const [previousLandingPages, dailySessions] = await Promise.all([
    ga4Client.fetchOrganicLandingPages(summary.propertyId, windows.previous, 150).catch(() => []),
    ga4Client.fetchOrganicDaily(summary.propertyId, windows.current).catch(() => [])
  ]);

  const filteredPrevLandingPages = (previousLandingPages || []).filter((p) => !isPathExcluded(p.path, excludedTerms));

  return {
    connected: true,
    propertyId: summary.propertyId,
    signals,
    movers: { ga4LandingPages: buildLandingPageMovers(filteredLandingPages, filteredPrevLandingPages) },
    landingPages: filteredLandingPages,
    dailySessions,
    dataGaps: gaps
  };
}

// ----------------------------------------------------
// Collector: rankings (eigen data)
// ----------------------------------------------------

function collectRankingSignals(projectId, windows) {
  const days = windows.days * 2 + 5;
  const rows = db.prepare(`
    WITH daily AS (
      SELECT r.keyword_id, date(r.checked_at) AS day, r.position,
             ROW_NUMBER() OVER (PARTITION BY r.keyword_id, date(r.checked_at) ORDER BY r.checked_at DESC) AS rn
      FROM keyword_rankings r
      JOIN keywords k ON k.id = r.keyword_id
      WHERE k.project_id = ? AND date(r.checked_at) >= date('now', ?)
    )
    SELECT day,
           COUNT(*) AS totalKeywords,
           SUM(CASE WHEN position BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS top3,
           SUM(CASE WHEN position BETWEEN 1 AND 10 THEN 1 ELSE 0 END) AS top10,
           ROUND(AVG(CASE WHEN position > 0 THEN position END), 1) AS avgPosition
    FROM daily WHERE rn = 1
    GROUP BY day ORDER BY day ASC
  `).all(projectId, `-${days} days`);

  if (rows.length === 0) {
    return {
      connected: false,
      reason: 'no_data',
      message: 'Nog geen ranking-historie. Voer een ranking check uit in de Rank Tracker; vanaf de tweede check is er iets te vergelijken.',
      signals: [],
      movers: {}
    };
  }

  const currentRows = rows.filter((r) => r.day >= windows.current.startDate);
  const previousRows = rows.filter((r) => r.day >= windows.previous.startDate && r.day <= windows.previous.endDate);

  if (currentRows.length === 0 || previousRows.length === 0) {
    return {
      connected: true,
      comparable: false,
      message: 'Er is nog maar één meetperiode aan rankings. Vanaf de volgende periode kunnen we vergelijken.',
      signals: [],
      movers: {},
      // Historie tóch teruggeven: die moet worden weggeschreven naar
      // metric_snapshots, ook als er nog niets te vergelijken valt.
      detail: { history: rows }
    };
  }

  // Laatste meting binnen elk venster: minder ruisgevoelig dan 'vandaag vs gisteren'.
  const now = currentRows[currentRows.length - 1];
  const prev = previousRows[previousRows.length - 1];

  const signals = [
    makeSignal({
      id: 'rankings.top3', source: 'rankings', metric: 'top3', label: 'Zoekwoorden in de top 3', unit: 'count',
      current: now.top3, previous: prev.top3
    }),
    makeSignal({
      id: 'rankings.top10', source: 'rankings', metric: 'top10', label: 'Zoekwoorden in de top 10', unit: 'count',
      current: now.top10, previous: prev.top10
    }),
    makeSignal({
      id: 'rankings.avgPosition', source: 'rankings', metric: 'avgPosition', label: 'Gemiddelde positie van je zoekwoorden', unit: 'position',
      lowerIsBetter: true,
      current: now.avgPosition, previous: prev.avgPosition
    })
  ];

  // Grootste bewegers uit de laatste check per zoekwoord.
  const latest = db.prepare(`
    SELECT k.keyword, r.position, r.previous_position
    FROM keywords k
    LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
    WHERE k.project_id = ?
      AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
  `).all(projectId);

  const moved = latest
    .filter((r) => r.position > 0 && r.previous_position > 0 && r.position !== r.previous_position)
    .map((r) => ({
      key: r.keyword,
      position: r.position,
      prevPosition: r.previous_position,
      positionDelta: r.previous_position - r.position // positief = gestegen
    }))
    .sort((a, b) => Math.abs(b.positionDelta) - Math.abs(a.positionDelta));

  return {
    connected: true,
    comparable: true,
    signals,
    movers: {
      keywords: {
        winners: moved.filter((m) => m.positionDelta > 0).slice(0, 5),
        losers: moved.filter((m) => m.positionDelta < 0).slice(0, 5)
      }
    },
    detail: {
      improvedCount: moved.filter((m) => m.positionDelta > 0).length,
      declinedCount: moved.filter((m) => m.positionDelta < 0).length,
      history: rows
    }
  };
}

// ----------------------------------------------------
// Collector: PageSpeed
// ----------------------------------------------------

/**
 * lcp/cls staan als tekst in de database ('2,4 s'). Onparsebaar -> null, zodat
 * het signaal neutraal wordt in plaats van dat er een verzonnen 0 verschijnt.
 */
function parseMetric(value) {
  if (value === null || value === undefined) return null;
  const parsed = parseFloat(String(value).replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

function collectPagespeedSignals(projectId) {
  const audits = db.prepare(`
    SELECT * FROM pagespeed_audits
    WHERE project_id = ? AND strategy = 'mobile'
    ORDER BY created_at DESC LIMIT 2
  `).all(projectId);

  if (audits.length === 0) {
    return {
      connected: false,
      reason: 'no_data',
      message: 'Nog geen PageSpeed audit uitgevoerd. Start er een via de PageSpeed tab.',
      signals: [], movers: {}
    };
  }
  if (audits.length < 2) {
    return {
      connected: true,
      comparable: false,
      message: 'Nog maar één PageSpeed audit — er is niets om mee te vergelijken. Voer een tweede audit uit.',
      signals: [], movers: {}
    };
  }

  const [now, prev] = audits;

  return {
    connected: true,
    comparable: true,
    signals: [
      makeSignal({
        id: 'pagespeed.performance', source: 'pagespeed', metric: 'performance', label: 'Mobiele snelheidsscore', unit: 'score',
        current: now.performance_score, previous: prev.performance_score
      }),
      makeSignal({
        id: 'pagespeed.lcp', source: 'pagespeed', metric: 'lcp', label: 'Laadtijd grootste element (LCP)', unit: 'seconds',
        lowerIsBetter: true,
        current: parseMetric(now.lcp), previous: parseMetric(prev.lcp)
      }),
      makeSignal({
        id: 'pagespeed.cls', source: 'pagespeed', metric: 'cls', label: 'Verspringende layout (CLS)', unit: 'ratio',
        lowerIsBetter: true,
        current: parseMetric(now.cls), previous: parseMetric(prev.cls)
      })
    ],
    movers: {},
    detail: { url: now.url, auditedAt: now.created_at, previousAuditedAt: prev.created_at }
  };
}

// ----------------------------------------------------
// Collector: crawl
// ----------------------------------------------------

function collectCrawlSignals(projectId) {
  const sessions = db.prepare(`
    SELECT * FROM crawl_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 2
  `).all(projectId);

  if (sessions.length === 0) {
    return {
      connected: false,
      reason: 'no_data',
      message: 'Nog geen crawl uitgevoerd. Start een crawl via de Site Crawler tab.',
      signals: [], movers: {}
    };
  }

  const countErrors = (sessionId) => db.prepare(
    'SELECT COUNT(*) AS c FROM crawled_pages WHERE session_id = ? AND status_code >= 400'
  ).get(sessionId).c;

  const errorUrls = (sessionId) => db.prepare(
    'SELECT url FROM crawled_pages WHERE session_id = ? AND status_code >= 400'
  ).all(sessionId).map((r) => r.url);

  if (sessions.length < 2) {
    return {
      connected: true,
      comparable: false,
      message: 'Nog maar één crawl uitgevoerd — er is niets om mee te vergelijken. Voer een tweede crawl uit.',
      signals: [], movers: {}
    };
  }

  const [now, prev] = sessions;
  const nowErrors = errorUrls(now.id);
  const prevErrorSet = new Set(errorUrls(prev.id));
  const newErrors = nowErrors.filter((url) => !prevErrorSet.has(url)).slice(0, 5);

  return {
    connected: true,
    comparable: true,
    signals: [
      makeSignal({
        id: 'crawl.errors', source: 'crawl', metric: 'errors', label: 'Foutpagina\'s op je site', unit: 'count',
        lowerIsBetter: true,
        current: nowErrors.length, previous: prevErrorSet.size,
        detail: { newErrorUrls: newErrors }
      }),
      makeSignal({
        id: 'crawl.pages', source: 'crawl', metric: 'pages', label: 'Gecrawlde pagina\'s', unit: 'count',
        current: now.pages_crawled, previous: prev.pages_crawled
      })
    ],
    movers: {},
    detail: { crawledAt: now.created_at, newErrorUrls: newErrors }
  };
}

// ----------------------------------------------------
// Collector: Google Bedrijfsprofiel (Maps-statistieken)
// ----------------------------------------------------

async function collectGbpSignals(projectId, windows) {
  const summary = await gbpPerformanceService.getPerformanceSummary(projectId, windows);

  if (!summary.connected) {
    return {
      connected: false,
      reason: summary.reason,
      message: summary.message,
      signals: [],
      movers: {}
    };
  }

  if (!summary.comparable || !summary.previousTotals) {
    return {
      connected: true,
      comparable: false,
      message: summary.message,
      signals: [],
      movers: {},
      // Historie tóch teruggeven zodat de snapshots blijven groeien.
      detail: { daily: summary.daily, lastDataDay: summary.lastDataDay }
    };
  }

  const { totals, previousTotals } = summary;
  const signal = (id, metric, label, key) => makeSignal({
    id, source: 'gbp', metric, label, unit: 'count',
    current: totals[key], previous: previousTotals[key]
  });

  return {
    connected: true,
    comparable: true,
    signals: [
      signal('gbp.impressions', 'impressions', 'Weergaven van je bedrijfsprofiel', 'impressions'),
      signal('gbp.calls', 'calls', 'Telefoontjes via Google', 'calls'),
      signal('gbp.directions', 'directions', 'Routebeschrijvingen aangevraagd', 'directions'),
      signal('gbp.websiteClicks', 'websiteClicks', 'Klikken naar je website vanuit Maps', 'websiteClicks'),
      signal('gbp.conversations', 'conversations', 'Berichten via je bedrijfsprofiel', 'conversations')
    ],
    movers: {},
    detail: {
      daily: summary.daily,
      breakdown: summary.breakdown,
      locationTitle: summary.locationTitle,
      lastDataDay: summary.lastDataDay
    }
  };
}

// ----------------------------------------------------
// Collector: Google Maps-beoordelingen (Places)
// ----------------------------------------------------

/** Laatste snapshot op of vóór een datum; Places kent zelf geen vorige periode. */
function previousSnapshotValue(projectId, metric, beforeDay, days) {
  const series = getSeries(projectId, 'places', metric, days);
  const eligible = series.filter((row) => row.day <= beforeDay);
  return eligible.length > 0 ? eligible[eligible.length - 1] : null;
}

async function collectPlacesSignals(projectId, windows) {
  const comparison = await placesService.getPlacesComparison(projectId);

  if (!comparison.connected) {
    return {
      connected: false,
      reason: comparison.reason,
      message: comparison.message,
      signals: [],
      movers: {}
    };
  }

  const own = comparison.own;
  const lookbackDays = windows.days * 4;
  const prevRating = previousSnapshotValue(projectId, 'rating', windows.previous.endDate, lookbackDays);
  const prevReviews = previousSnapshotValue(projectId, 'reviewCount', windows.previous.endDate, lookbackDays);

  const signals = [
    makeSignal({
      id: 'places.rating', source: 'places', metric: 'rating',
      label: 'Je beoordeling in Google Maps', unit: 'rating',
      current: own.rating, previous: prevRating ? prevRating.value : null
    }),
    makeSignal({
      id: 'places.reviewCount', source: 'places', metric: 'reviewCount',
      label: 'Aantal Google-reviews', unit: 'count',
      current: own.reviewCount, previous: prevReviews ? prevReviews.value : null
    })
  ];

  // Alleen matches op website tellen mee: een naam-match is te onzeker om een
  // cijfer op te baseren.
  const trusted = comparison.competitors.filter(
    (c) => (c.confidence === 'exact' || c.confidence === 'domain' || c.confidence === 'stored') && typeof c.rating === 'number'
  );

  if (trusted.length > 0 && typeof own.rating === 'number') {
    const best = trusted.reduce((a, b) => (b.rating > a.rating ? b : a));
    const gap = round(own.rating - best.rating, 2);

    // De voorsprong is alleen vergelijkbaar als de verzameling concurrenten
    // gelijk is gebleven. Een nieuwe concurrent verandert de uitkomst zonder dat
    // er iets aan de eigen score veranderde — dat zou "je voorsprong slonk"
    // opleveren terwijl dat feitelijk onjuist is.
    const currentIds = trusted.map((c) => c.placeId).filter(Boolean).sort().join(',');
    const prevGap = previousSnapshotValue(projectId, 'ratingGap', windows.previous.endDate, lookbackDays);
    const sameSet = prevGap && prevGap.meta?.competitorIds === currentIds;

    signals.push(makeSignal({
      id: 'places.ratingGap', source: 'places', metric: 'ratingGap',
      label: 'Voorsprong op de best beoordeelde concurrent', unit: 'rating',
      current: gap, previous: sameSet ? prevGap.value : null,
      detail: { competitorIds: currentIds, bestCompetitor: best.name, bestRating: best.rating }
    }));
  }

  const dataGaps = [];
  for (const item of comparison.unmatched) {
    dataGaps.push({
      source: 'places',
      message: `"${item.name}" is niet teruggevonden in Google Maps. Controleer de bedrijfsnaam of het domein bij Concurrenten.`
    });
  }
  if (comparison.message) dataGaps.push({ source: 'places', message: comparison.message });

  const ahead = comparison.competitors.filter((c) => typeof c.rating === 'number' && own.rating > c.rating);
  const behind = comparison.competitors.filter((c) => typeof c.rating === 'number' && own.rating <= c.rating);
  const asMover = (c) => ({
    key: c.name,
    rating: c.rating,
    reviewCount: c.reviewCount,
    ratingDelta: typeof own.rating === 'number' ? round(own.rating - c.rating, 2) : null
  });

  return {
    connected: true,
    comparable: true,
    signals,
    movers: { placesCompetitors: { winners: ahead.map(asMover), losers: behind.map(asMover) } },
    detail: {
      own,
      competitors: comparison.competitors,
      unmatched: comparison.unmatched,
      fetchedDay: comparison.fetchedDay,
      fromCache: comparison.fromCache
    },
    dataGaps
  };
}

// ----------------------------------------------------
// Orchestrator
// ----------------------------------------------------

/**
 * Object-parameter in plaats van positionele argumenten: met zeven collectors
 * is een verschoven argument een stille bug die niemand opmerkt.
 */
function persistSnapshots(projectId, { gsc, ga4, gbp, places, rankings }) {
  const rows = [];

  if (gsc?.connected && Array.isArray(gsc.daily)) {
    for (const d of gsc.daily) {
      rows.push({ source: 'gsc', metric: 'clicks', day: d.day, value: d.clicks });
      rows.push({ source: 'gsc', metric: 'impressions', day: d.day, value: d.impressions });
      rows.push({ source: 'gsc', metric: 'ctr', day: d.day, value: d.ctr });
      rows.push({ source: 'gsc', metric: 'position', day: d.day, value: d.position });
    }
  }

  if (rankings?.detail?.history) {
    for (const h of rankings.detail.history) {
      rows.push({ source: 'rankings', metric: 'top3', day: h.day, value: h.top3 });
      rows.push({ source: 'rankings', metric: 'top10', day: h.day, value: h.top10 });
      rows.push({ source: 'rankings', metric: 'avgPosition', day: h.day, value: h.avgPosition });
    }
  }

  if (ga4?.connected && ga4.dailySessions) {
    for (const d of ga4.dailySessions) {
      rows.push({ source: 'ga4', metric: 'sessions', day: d.day, value: d.sessions });
      rows.push({ source: 'ga4', metric: 'keyEvents', day: d.day, value: d.keyEvents });
    }
  }

  if (gbp?.connected && Array.isArray(gbp.detail?.daily)) {
    for (const d of gbp.detail.daily) {
      rows.push({ source: 'gbp', metric: 'impressions', day: d.day, value: d.impressions });
      rows.push({ source: 'gbp', metric: 'calls', day: d.day, value: d.calls });
      rows.push({ source: 'gbp', metric: 'directions', day: d.day, value: d.directions });
      rows.push({ source: 'gbp', metric: 'websiteClicks', day: d.day, value: d.websiteClicks });
      rows.push({ source: 'gbp', metric: 'conversations', day: d.day, value: d.conversations });
    }
  }

  // Places kent geen historie in de API zelf: deze snapshots zijn de enige
  // manier om over tijd te kunnen vergelijken, én ze voeden de dagelijkse
  // guard die verdere API-kosten voorkomt.
  if (places?.connected && places.detail?.own && places.detail.fetchedDay) {
    const day = places.detail.fetchedDay;
    const own = places.detail.own;
    rows.push({ source: 'places', metric: 'rating', day, value: own.rating, meta: { name: own.name, mapsUri: own.mapsUri } });
    rows.push({ source: 'places', metric: 'reviewCount', day, value: own.reviewCount });

    for (const c of places.detail.competitors || []) {
      if (!c.placeId || c.confidence === 'name') continue;
      rows.push({ source: 'places', metric: `competitor:${c.id}:rating`, day, value: c.rating, meta: { name: c.name, mapsUri: c.mapsUri } });
      rows.push({ source: 'places', metric: `competitor:${c.id}:reviewCount`, day, value: c.reviewCount });
    }

    const gapSignal = (places.signals || []).find((s) => s.id === 'places.ratingGap');
    if (gapSignal) {
      rows.push({
        source: 'places', metric: 'ratingGap', day, value: gapSignal.current,
        meta: { competitorIds: gapSignal.detail?.competitorIds || '' }
      });
    }
  }

  return recordSnapshots(projectId, rows);
}

async function buildInsightsReport(projectId, { days = 28, refresh = false } = {}) {
  const cacheKey = `${projectId}:${days}`;
  const cached = cache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.report;
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('Project niet gevonden');

  const windows = buildWindows(days);

  // ⚠️ Deze vier lijsten zijn volgorde-gekoppeld: een collector toevoegen
  // betekent hem op dezelfde positie in alle vier opnemen.
  const settled = await Promise.allSettled([
    collectGscSignals(project, windows),
    collectGa4Signals(project, windows),
    collectGbpSignals(projectId, windows),
    collectPlacesSignals(projectId, windows),
    Promise.resolve().then(() => collectRankingSignals(projectId, windows)),
    Promise.resolve().then(() => collectPagespeedSignals(projectId)),
    Promise.resolve().then(() => collectCrawlSignals(projectId))
  ]);

  const COLLECTOR_NAMES = ['gsc', 'ga4', 'gbp', 'places', 'rankings', 'pagespeed', 'crawl'];

  const [gsc, ga4, gbp, places, rankings, pagespeed, crawl] = settled.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      connected: false,
      reason: 'error',
      message: `Ophalen van ${COLLECTOR_NAMES[i]}-data mislukte: ${result.reason?.message || 'onbekende fout'}`,
      signals: [],
      movers: {}
    };
  });

  const collectors = { gsc, ga4, gbp, places, rankings, pagespeed, crawl };

  const signals = Object.values(collectors).flatMap((c) => c.signals || []);

  const significant = signals.filter((s) => s.significant);
  const bySize = (a, b) => b.magnitude - a.magnitude;

  const dataGaps = [];
  for (const [name, collector] of Object.entries(collectors)) {
    if (!collector.connected || collector.comparable === false) {
      if (collector.message) dataGaps.push({ source: name, message: collector.message });
    }
    for (const gap of collector.dataGaps || []) dataGaps.push(gap);
  }

  const movers = Object.values(collectors).reduce((acc, c) => ({ ...acc, ...(c.movers || {}) }), {});

  const report = {
    project: { id: project.id, name: project.name, domain: project.domain },
    period: windows,
    sources: Object.fromEntries(Object.entries(collectors).map(([name, c]) => ([name, {
      connected: !!c.connected,
      comparable: c.comparable !== false,
      reason: c.reason || null,
      message: c.message || null
    }]))),
    signals,
    highlights: {
      positive: significant.filter((s) => s.sentiment === 'positive').sort(bySize),
      negative: significant.filter((s) => s.sentiment === 'negative').sort(bySize)
    },
    movers,
    dataGaps,
    generatedAt: new Date().toISOString()
  };

  try {
    persistSnapshots(projectId, collectors);
  } catch (e) {
    // Historie wegschrijven mag de respons nooit blokkeren.
    console.error('[insights] snapshots niet weggeschreven:', e.message);
  }

  cache.set(cacheKey, { timestamp: Date.now(), report });
  return report;
}

function clearCache(projectId) {
  if (!projectId) return cache.clear();
  for (const key of cache.keys()) {
    if (key.startsWith(`${projectId}:`)) cache.delete(key);
  }
}

module.exports = {
  buildWindows,
  buildInsightsReport,
  makeSignal,
  clearCache,
  THRESHOLDS
};
