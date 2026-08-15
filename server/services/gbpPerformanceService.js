const axios = require('axios');
const gbpService = require('./gbpService');

/**
 * Business Profile Performance API: wat er in Google Maps en Zoeken gebeurt met
 * je bedrijfsprofiel — weergaven, telefoontjes, routeaanvragen, websiteklikken.
 *
 * Authenticatie loopt via dezelfde OAuth-koppeling als gbpService
 * (scope business.manage).
 *
 * ⚠️ Deze API heeft een apart goedkeuringstraject: het quotum staat op 0
 * verzoeken per minuut tot Google het formulier "Application For Basic API
 * Access" heeft goedgekeurd. Een quotumverhóging aanvragen werkt niet.
 */

const API_BASE = 'https://businessprofileperformance.googleapis.com/v1';

// Er bestaat geen aggregaat voor "profielweergaven": dat is de som van deze vier.
const IMPRESSION_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
];

const ACTION_METRICS = [
  'BUSINESS_DIRECTION_REQUESTS',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_CONVERSATIONS'
];

const DAILY_METRICS = [...IMPRESSION_METRICS, ...ACTION_METRICS];

// De data verandert hooguit één keer per dag; 6 uur cache houdt de
// "Vernieuwen"-knop bruikbaar zonder een krap quotum leeg te trekken.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

/**
 * De parameternamen zijn bewust gemengd van casing: dailyMetrics en dailyRange
 * zijn camelCase, start_date/end_date zijn snake_case. Zo staat het in Google's
 * documentatie en zo accepteert de API het. Niet "opschonen".
 */
function buildQuery(startDate, endDate) {
  const qs = new URLSearchParams();
  for (const metric of DAILY_METRICS) qs.append('dailyMetrics', metric);

  const [sy, sm, sd] = startDate.split('-');
  const [ey, em, ed] = endDate.split('-');
  qs.set('dailyRange.start_date.year', String(Number(sy)));
  qs.set('dailyRange.start_date.month', String(Number(sm)));
  qs.set('dailyRange.start_date.day', String(Number(sd)));
  qs.set('dailyRange.end_date.year', String(Number(ey)));
  qs.set('dailyRange.end_date.month', String(Number(em)));
  qs.set('dailyRange.end_date.day', String(Number(ed)));

  return qs.toString();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * Twee valkuilen in de respons, allebei uit de documentatie:
 *   - value is een int64 als string
 *   - een ontbrekende value betekent 0, niet null; dagen zonder data staan
 *     helemaal niet in datedValues
 * Geëxporteerd zodat dit met de voorbeeld-JSON uit de docs te testen is.
 */
function parseMultiDailyResponse(data) {
  const perMetric = new Map();

  for (const outer of data?.multiDailyMetricTimeSeries || []) {
    for (const series of outer?.dailyMetricTimeSeries || []) {
      const metric = series.dailyMetric;
      if (!metric) continue;

      const byDay = perMetric.get(metric) || new Map();
      for (const dated of series.timeSeries?.datedValues || []) {
        const d = dated.date;
        if (!d?.year || !d?.month || !d?.day) continue;
        byDay.set(`${d.year}-${pad(d.month)}-${pad(d.day)}`, Number(dated.value || 0));
      }
      perMetric.set(metric, byDay);
    }
  }

  return perMetric;
}

function eachDay(startDate, endDate) {
  const days = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function readDay(perMetric, metric, day) {
  return perMetric.get(metric)?.get(day) ?? 0;
}

function buildDailyRows(perMetric, startDate, endDate) {
  return eachDay(startDate, endDate).map((day) => ({
    day,
    impressions: IMPRESSION_METRICS.reduce((sum, m) => sum + readDay(perMetric, m, day), 0),
    mapsImpressions: readDay(perMetric, 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', day)
      + readDay(perMetric, 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', day),
    searchImpressions: readDay(perMetric, 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', day)
      + readDay(perMetric, 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', day),
    mobileImpressions: readDay(perMetric, 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', day)
      + readDay(perMetric, 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', day),
    desktopImpressions: readDay(perMetric, 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', day)
      + readDay(perMetric, 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', day),
    calls: readDay(perMetric, 'CALL_CLICKS', day),
    directions: readDay(perMetric, 'BUSINESS_DIRECTION_REQUESTS', day),
    websiteClicks: readDay(perMetric, 'WEBSITE_CLICKS', day),
    conversations: readDay(perMetric, 'BUSINESS_CONVERSATIONS', day)
  }));
}

const SUMMABLE = ['impressions', 'mapsImpressions', 'searchImpressions', 'mobileImpressions',
  'desktopImpressions', 'calls', 'directions', 'websiteClicks', 'conversations'];

function sumRows(rows) {
  const totals = Object.fromEntries(SUMMABLE.map((k) => [k, 0]));
  for (const row of rows) {
    for (const key of SUMMABLE) totals[key] += row[key] || 0;
  }
  return totals;
}

/**
 * De verversingsvertraging van deze API is nergens gedocumenteerd. Knip daarom
 * lege staartdagen af en rapporteer de laatste dag met echte data, zodat een
 * langere vertraging als een kort venster verschijnt in plaats van als nullen.
 */
function trimTrailingEmptyDays(rows) {
  let lastWithData = -1;
  for (let i = 0; i < rows.length; i++) {
    const hasData = SUMMABLE.some((k) => (rows[i][k] || 0) > 0);
    if (hasData) lastWithData = i;
  }
  if (lastWithData === -1) return { rows: [], lastDataDay: null };
  return { rows: rows.slice(0, lastWithData + 1), lastDataDay: rows[lastWithData].day };
}

function notConnected(reason, err) {
  return {
    connected: false,
    comparable: false,
    reason,
    message: gbpService.reasonMessage(reason, err),
    locationName: null,
    locationTitle: null,
    totals: null,
    previousTotals: null,
    breakdown: null,
    daily: [],
    lastDataDay: null
  };
}

async function getPerformanceSummary(projectId, windows, { refresh = false } = {}) {
  if (!gbpService.isConfigured()) return notConnected('not_configured');

  let locationName = null;
  let locationTitle = null;

  try {
    const { locations } = await gbpService.listLocations({ refresh });
    locationName = gbpService.resolveLocationName(locations);
    if (!locationName) return notConnected('no_location');
    locationTitle = locations.find((l) => l.name === locationName)?.title || null;
  } catch (err) {
    return notConnected(err.gbpReason || gbpService.classifyGoogleError(err), err);
  }

  // Eén verzoek voor beide periodes: het venster loopt van het begin van de
  // vorige periode tot het eind van de huidige, daarna splitsen we in JS.
  const startDate = windows.previous.startDate;
  const endDate = windows.current.endDate;

  const cacheKey = `${locationName}:${startDate}:${endDate}`;
  const cached = cache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const token = await gbpService.getAccessToken();
    const url = `${API_BASE}/${locationName}:fetchMultiDailyMetricsTimeSeries?${buildQuery(startDate, endDate)}`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000
    });

    const perMetric = parseMultiDailyResponse(response.data);
    const allRows = buildDailyRows(perMetric, startDate, endDate);
    const { rows, lastDataDay } = trimTrailingEmptyDays(allRows);

    if (rows.length === 0) return notConnected('no_data');

    const currentRows = rows.filter((r) => r.day >= windows.current.startDate);
    const previousRows = rows.filter((r) => r.day >= windows.previous.startDate && r.day <= windows.previous.endDate);

    const totals = sumRows(currentRows);
    const previousTotals = previousRows.length > 0 ? sumRows(previousRows) : null;

    const result = {
      connected: true,
      comparable: previousTotals !== null,
      reason: null,
      message: previousTotals === null
        ? 'Er is nog maar één meetperiode aan bedrijfsprofiel-cijfers. Vanaf de volgende periode kunnen we vergelijken.'
        : null,
      locationName,
      locationTitle,
      totals: {
        impressions: totals.impressions,
        calls: totals.calls,
        directions: totals.directions,
        websiteClicks: totals.websiteClicks,
        conversations: totals.conversations
      },
      previousTotals: previousTotals && {
        impressions: previousTotals.impressions,
        calls: previousTotals.calls,
        directions: previousTotals.directions,
        websiteClicks: previousTotals.websiteClicks,
        conversations: previousTotals.conversations
      },
      breakdown: {
        mapsImpressions: totals.mapsImpressions,
        searchImpressions: totals.searchImpressions,
        mobileImpressions: totals.mobileImpressions,
        desktopImpressions: totals.desktopImpressions
      },
      // Alleen de huidige periode wegschrijven naar de snapshots.
      daily: currentRows,
      lastDataDay
    };

    cache.set(cacheKey, { timestamp: Date.now(), result });
    return result;
  } catch (err) {
    return notConnected(gbpService.classifyGoogleError(err), err);
  }
}

function clearCache() {
  cache.clear();
}

module.exports = {
  getPerformanceSummary,
  parseMultiDailyResponse,
  buildDailyRows,
  buildQuery,
  trimTrailingEmptyDays,
  clearCache,
  DAILY_METRICS
};
