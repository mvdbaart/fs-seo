const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../db');

/**
 * Google Analytics 4 client via een service account.
 * Zelfde opzet als services/gscClient.js: de Analytics API's accepteren geen
 * plain API key, er is een service account nodig dat als Lezer is toegevoegd
 * op de GA4 property.
 *
 * Twee API's, allebei nodig:
 *   - Data API  (analyticsdata.googleapis.com)  -> de cijfers
 *   - Admin API (analyticsadmin.googleapis.com) -> property-detectie
 * Eén scope (analytics.readonly) dekt beide.
 *
 * Credential-resolutie: zelfde cascade als gscClient.
 */

const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const ADMIN_API_BASE = 'https://analyticsadmin.googleapis.com/v1beta';

// Eigen tokencache: andere scope dan gscClient, dus niet deelbaar.
let cachedToken = null;
let cachedTokenExpiry = 0;

// De Data API hernoemde 'conversions' naar 'keyEvents' (2024). Welke naam deze
// property accepteert onthouden we na de eerste succesvolle call.
let keyEventMetricName = null;

const ORGANIC_FILTER = {
  filter: {
    fieldName: 'sessionDefaultChannelGroup',
    // Deze waarde is altijd Engels, ook in een Nederlandse property.
    stringFilter: { matchType: 'EXACT', value: 'Organic Search' }
  }
};

const BASE_METRICS = ['sessions', 'engagedSessions', 'averageSessionDuration', 'bounceRate'];

const path = require('path');

function loadCredentials() {
  const candidates = [];
  if (process.env.FS_GSC_SERVICE_ACCOUNT) candidates.push(process.env.FS_GSC_SERVICE_ACCOUNT);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) candidates.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'gsc_service_account_json'").get();
  if (settingsRow && settingsRow.value) candidates.push(settingsRow.value);

  for (const candidate of candidates) {
    const trimmed = String(candidate).trim();
    if (!trimmed) continue;
    try {
      let raw;
      if (trimmed.startsWith('{')) {
        raw = trimmed;
      } else {
        const filePath = path.isAbsolute(trimmed)
          ? trimmed
          : path.resolve(__dirname, '../../', trimmed);
        raw = fs.readFileSync(filePath, 'utf8');
      }
      const parsed = JSON.parse(raw);
      if (parsed.client_email && parsed.private_key) return parsed;
    } catch (e) {
      // Ongeldig pad of JSON: probeer de volgende bron
    }
  }
  return null;
}

function isConfigured() {
  return loadCredentials() !== null;
}

function getServiceAccountEmail() {
  const creds = loadCredentials();
  return creds ? creds.client_email : null;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60000) return cachedToken;

  const creds = loadCredentials();
  if (!creds) throw new Error('GA4 service account niet geconfigureerd');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: GA4_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(creds.private_key, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const response = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${header}.${claims}.${signature}`
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });

  cachedToken = response.data.access_token;
  cachedTokenExpiry = Date.now() + (response.data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function ga4Request(method, url, body) {
  const token = await getAccessToken();
  try {
    const response = await axios({
      method,
      url,
      data: body,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000
    });
    return response.data;
  } catch (err) {
    // Geef de echte Google-foutmelding door in plaats van een kale statuscode
    const apiMessage = err.response?.data?.error?.message;
    if (apiMessage) {
      const wrapped = new Error(apiMessage);
      wrapped.status = err.response?.status;
      throw wrapped;
    }
    throw err;
  }
}

/**
 * Alle GA4 properties waar dit service account bij kan. Levert meteen de beste
 * diagnose: een lege lijst betekent 'geen rechten', niet 'API staat uit'.
 */
async function listProperties() {
  const data = await ga4Request('get', `${ADMIN_API_BASE}/accountSummaries?pageSize=200`);
  const summaries = data.accountSummaries || [];
  const properties = [];
  for (const account of summaries) {
    for (const prop of account.propertySummaries || []) {
      properties.push({
        propertyId: String(prop.property || '').replace('properties/', ''),
        displayName: prop.displayName || null,
        accountName: account.displayName || null
      });
    }
  }
  return properties;
}

/**
 * Normaliseer een ingevoerd property ID en weiger de twee meestgemaakte fouten.
 */
function normalizePropertyId(value) {
  if (!value) return null;
  const trimmed = String(value).trim().replace(/^properties\//i, '');
  if (/^G-/i.test(trimmed) || /^UA-/i.test(trimmed)) {
    throw new Error(`"${trimmed}" is een meet-ID, geen property ID. Vul het numerieke GA4 Property ID in (bijv. 312345678); dat vind je bij Beheer > Property-instellingen.`);
  }
  if (!/^\d{6,12}$/.test(trimmed)) {
    throw new Error(`"${trimmed}" is geen geldig GA4 Property ID. Verwacht een getal van 6 tot 12 cijfers.`);
  }
  return trimmed;
}

/**
 * Property ID bepalen: env -> project -> settings -> automatisch via de Admin API
 * (alleen als het service account precies één property ziet).
 */
async function resolvePropertyId(project) {
  const candidates = [
    process.env.FS_GA4_PROPERTY_ID,
    project && project.ga4_property_id
  ];

  const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'ga4_property_id'").get();
  if (settingsRow && settingsRow.value) candidates.push(settingsRow.value);

  for (const candidate of candidates) {
    if (candidate && String(candidate).trim()) return normalizePropertyId(candidate);
  }

  // Niets ingesteld: probeer automatische detectie.
  const properties = await listProperties();
  if (properties.length === 1) return properties[0].propertyId;
  return null;
}

/**
 * Eén rapport. Bewust géén tweede dateRange: bij meer dan één dateRange voegt de
 * Data API een verborgen dateRange-kolom toe aan elke rij, waardoor de
 * dimensie-indexen verschuiven. De vergelijking doen we met twee losse calls.
 */
async function runReport(propertyId, {
  startDate,
  endDate,
  dimensions = [],
  metrics = ['sessions'],
  dimensionFilter = null,
  orderBys = null,
  limit = 100
} = {}) {
  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit,
    keepEmptyRows: false
  };
  if (dimensionFilter) body.dimensionFilter = dimensionFilter;
  if (orderBys) body.orderBys = orderBys;

  const data = await ga4Request('post', `${DATA_API_BASE}/properties/${propertyId}:runReport`, body);

  const metricHeaders = (data.metricHeaders || []).map((h) => h.name);
  const rows = (data.rows || []).map((r) => ({
    keys: (r.dimensionValues || []).map((v) => v.value),
    metrics: Object.fromEntries(
      metricHeaders.map((name, i) => [name, Number(r.metricValues?.[i]?.value ?? 0)])
    )
  }));

  const totalsRow = data.totals?.[0];
  const totals = totalsRow
    ? Object.fromEntries(metricHeaders.map((name, i) => [name, Number(totalsRow.metricValues?.[i]?.value ?? 0)]))
    : null;

  return { rows, totals, rowCount: data.rowCount || rows.length };
}

/**
 * Rapport met de conversie-metriek erbij, met terugval van keyEvents naar het
 * oude 'conversions' voor properties die de nieuwe naam nog niet kennen.
 */
async function runReportWithKeyEvents(propertyId, options) {
  const names = keyEventMetricName ? [keyEventMetricName] : ['keyEvents', 'conversions'];

  for (let i = 0; i < names.length; i++) {
    try {
      const result = await runReport(propertyId, {
        ...options,
        metrics: [...(options.metrics || []), names[i]]
      });
      keyEventMetricName = names[i];
      return { ...result, keyEventMetric: names[i] };
    } catch (err) {
      const isMetricError = /keyEvents|conversions/i.test(err.message || '');
      const hasFallbackLeft = i < names.length - 1;
      if (!isMetricError || !hasFallbackLeft) {
        if (isMetricError && !hasFallbackLeft) {
          // Geen van beide namen werkt: rapporteer zonder conversies.
          const result = await runReport(propertyId, options);
          return { ...result, keyEventMetric: null };
        }
        throw err;
      }
    }
  }
  throw new Error('Kon geen conversie-metriek bepalen');
}

function readKeyEvents(metrics, keyEventMetric) {
  if (!keyEventMetric) return null;
  const value = metrics[keyEventMetric];
  return value === undefined ? null : value;
}

/**
 * Totalen voor organisch zoekverkeer over één periode.
 */
async function fetchOrganicTotals(propertyId, { startDate, endDate }) {
  const result = await runReportWithKeyEvents(propertyId, {
    startDate,
    endDate,
    dimensions: [],
    metrics: BASE_METRICS,
    dimensionFilter: ORGANIC_FILTER,
    limit: 1
  });

  const m = result.totals || {};
  return {
    sessions: m.sessions ?? 0,
    engagedSessions: m.engagedSessions ?? 0,
    averageSessionDuration: m.averageSessionDuration ?? 0,
    // GA4 levert bounceRate als ratio 0-1; wij rekenen in procenten.
    bounceRate: (m.bounceRate ?? 0) * 100,
    keyEvents: readKeyEvents(m, result.keyEventMetric)
  };
}

/**
 * Totale sessies zonder kanaalfilter. Gebruikt om te detecteren of een property
 * aangepaste kanaalgroepen hanteert: 0 organisch bij >0 totaal is verdacht.
 */
async function fetchAllChannelSessions(propertyId, { startDate, endDate }) {
  const result = await runReport(propertyId, {
    startDate,
    endDate,
    dimensions: [],
    metrics: ['sessions'],
    limit: 1
  });
  return result.totals?.sessions ?? 0;
}

async function fetchOrganicLandingPages(propertyId, { startDate, endDate }, limit = 150) {
  const result = await runReportWithKeyEvents(propertyId, {
    startDate,
    endDate,
    dimensions: ['landingPagePlusQueryString'],
    metrics: BASE_METRICS,
    dimensionFilter: ORGANIC_FILTER,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit
  });

  return result.rows.map((row) => ({
    path: row.keys[0] || '(onbekend)',
    sessions: row.metrics.sessions ?? 0,
    engagedSessions: row.metrics.engagedSessions ?? 0,
    averageSessionDuration: row.metrics.averageSessionDuration ?? 0,
    bounceRate: (row.metrics.bounceRate ?? 0) * 100,
    keyEvents: readKeyEvents(row.metrics, result.keyEventMetric)
  }));
}

/**
 * Dag-voor-dag reeks, voedt metric_snapshots.
 */
async function fetchOrganicDaily(propertyId, { startDate, endDate }) {
  const result = await runReportWithKeyEvents(propertyId, {
    startDate,
    endDate,
    dimensions: ['date'],
    metrics: ['sessions'],
    dimensionFilter: ORGANIC_FILTER,
    limit: 400
  });

  return result.rows.map((row) => ({
    // GA4 levert 'YYYYMMDD'
    day: formatGa4Date(row.keys[0]),
    sessions: row.metrics.sessions ?? 0,
    keyEvents: readKeyEvents(row.metrics, result.keyEventMetric)
  })).filter((r) => r.day);
}

function formatGa4Date(value) {
  const raw = String(value || '');
  if (!/^\d{8}$/.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/**
 * Vertaal een Google-fout naar een Nederlandse instructie die zegt wat je moet doen.
 */
function explainError(err, propertyId) {
  const message = err.message || '';
  const email = getServiceAccountEmail() || 'het service account';

  if (/has not been used in project|is disabled/i.test(message)) {
    return `De Google Analytics Data API staat nog uit in Google Cloud. Zet analyticsdata.googleapis.com aan in hetzelfde project als het service account. (${message})`;
  }
  if (err.status === 403 || /PERMISSION_DENIED|permission/i.test(message)) {
    return `${email} heeft geen toegang tot GA4 property ${propertyId || '(onbekend)'}. Voeg dit adres toe als Lezer bij Beheer > Toegangsbeheer property — op property-niveau, niet alleen op accountniveau.`;
  }
  if (err.status === 404 || /NOT_FOUND/i.test(message)) {
    return `GA4 property ${propertyId || '(onbekend)'} bestaat niet of hoort bij een ander account.`;
  }
  return message;
}

/**
 * Alles wat de views en de insights-engine nodig hebben, in één aanroep.
 * Niet gekoppeld is een eerlijke toestand, geen fout: nooit verzonnen cijfers.
 */
async function getGa4Summary(project, windows) {
  const notConnected = (reason, message, extra = {}) => ({
    connected: false,
    reason,
    message,
    propertyId: null,
    serviceAccountEmail: getServiceAccountEmail(),
    totals: null,
    previousTotals: null,
    landingPages: [],
    error: null,
    ...extra
  });

  if (!isConfigured()) {
    return notConnected(
      'not_configured',
      'Google Analytics is nog niet gekoppeld: er is geen service account ingesteld. Plak de service-account JSON bij Instellingen (dezelfde die Search Console gebruikt).'
    );
  }

  let propertyId = null;
  try {
    propertyId = await resolvePropertyId(project);
  } catch (err) {
    return notConnected('invalid_property', err.message, { error: err.message });
  }

  if (!propertyId) {
    let available = [];
    try {
      available = await listProperties();
    } catch (err) {
      return notConnected('no_property', explainError(err, null), { error: err.message });
    }
    const message = available.length === 0
      ? `Het service account (${getServiceAccountEmail()}) ziet geen enkele GA4 property. Voeg het toe als Lezer bij Beheer > Toegangsbeheer property.`
      : 'Er zijn meerdere GA4 properties beschikbaar. Kies de juiste bij Instellingen.';
    return notConnected('no_property', message, { availableProperties: available });
  }

  try {
    const [totals, previousTotals, landingPages] = await Promise.all([
      fetchOrganicTotals(propertyId, windows.current),
      fetchOrganicTotals(propertyId, windows.previous),
      fetchOrganicLandingPages(propertyId, windows.current, 150)
    ]);

    // Custom channel groups: 0 organisch terwijl er wel verkeer is.
    let channelWarning = null;
    if (totals.sessions === 0 && previousTotals.sessions === 0) {
      const allSessions = await fetchAllChannelSessions(propertyId, windows.current).catch(() => 0);
      if (allSessions > 0) {
        channelWarning = `Deze property meldt ${allSessions} sessies, maar geen enkele in de kanaalgroep "Organic Search". Waarschijnlijk gebruikt de property aangepaste kanaalgroepen; de organische cijfers kloppen dan niet.`;
      }
    }

    return {
      connected: true,
      reason: null,
      message: null,
      propertyId,
      serviceAccountEmail: getServiceAccountEmail(),
      totals,
      previousTotals,
      landingPages,
      channelWarning,
      error: null
    };
  } catch (err) {
    return notConnected('api_error', explainError(err, propertyId), { error: err.message, propertyId });
  }
}

module.exports = {
  isConfigured,
  getServiceAccountEmail,
  listProperties,
  resolvePropertyId,
  normalizePropertyId,
  runReport,
  fetchOrganicTotals,
  fetchOrganicLandingPages,
  fetchOrganicDaily,
  fetchAllChannelSessions,
  getGa4Summary,
  explainError
};
