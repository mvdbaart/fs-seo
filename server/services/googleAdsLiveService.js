const { GoogleAdsApi } = require('google-ads-api');
const db = require('../db');

/**
 * Google Ads live statistieken.
 *
 * De Ads API accepteert géén service account (behalve met domain-wide
 * delegation op een Workspace-account) en ook geen API key. Nodig zijn:
 *   - een developer token (aanvragen via Ads > Tools > API Center)
 *   - een OAuth2 client id + secret
 *   - een refresh token voor het account dat de campagnes beheert
 *   - het customer id van het Ads-account (10 cijfers, zonder streepjes)
 *
 * Zolang die niet compleet zijn, rapporteert deze service eerlijk dat er geen
 * koppeling is. Er worden nooit cijfers verzonnen.
 */

const REQUIRED_KEYS = [
  'google_ads_developer_token',
  'google_ads_client_id',
  'google_ads_client_secret',
  'google_ads_refresh_token',
  'google_ads_customer_id'
];

const SETTING_TO_ENV = {
  google_ads_developer_token: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_DEV_TEST_TOKEN'],
  google_ads_client_id: ['GOOGLE_ADS_CLIENT_ID'],
  google_ads_client_secret: ['GOOGLE_ADS_CLIENT_SECRET'],
  google_ads_refresh_token: ['GOOGLE_ADS_REFRESH_TOKEN'],
  google_ads_customer_id: ['GOOGLE_ADS_CUSTOMER_ID'],
  google_ads_login_customer_id: ['GOOGLE_ADS_LOGIN_CUSTOMER_ID']
};

/** Zelfde cascade als de andere keys: env eerst, dan de settings-tabel. */
function getCredential(key) {
  for (const envName of SETTING_TO_ENV[key] || []) {
    if (process.env[envName]) return String(process.env[envName]).trim();
  }
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row && row.value ? String(row.value).trim() : '';
}

function loadCredentials() {
  const creds = {};
  for (const key of [...REQUIRED_KEYS, 'google_ads_login_customer_id']) {
    creds[key] = getCredential(key);
  }
  return creds;
}

function missingCredentials() {
  const creds = loadCredentials();
  return REQUIRED_KEYS.filter((key) => !creds[key]);
}

function isConfigured() {
  return missingCredentials().length === 0;
}

const MISSING_LABELS = {
  google_ads_developer_token: 'developer token',
  google_ads_client_id: 'OAuth client ID',
  google_ads_client_secret: 'OAuth client secret',
  google_ads_refresh_token: 'refresh token',
  google_ads_customer_id: 'customer ID'
};

function notConnected(missing, extra = {}) {
  const labels = missing.map((key) => MISSING_LABELS[key] || key);
  return {
    connected: false,
    summary: null,
    previousSummary: null,
    campaigns: [],
    missing,
    message: `Google Ads is nog niet gekoppeld. Vul bij Instellingen nog in: ${labels.join(', ')}. Een developer token vraag je aan via Google Ads > Tools > API Center; een service account werkt hier niet.`,
    ...extra
  };
}

/** Ads rapporteert kosten in micro's: 1.000.000 micro = 1 euro. */
function fromMicros(value) {
  return Number(value || 0) / 1000000;
}

function formatEuro(value) {
  return `€${value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildSummary(rows) {
  const totals = rows.reduce((acc, row) => {
    const m = row.metrics || {};
    acc.clicks += Number(m.clicks || 0);
    acc.impressions += Number(m.impressions || 0);
    acc.costMicros += Number(m.cost_micros || 0);
    acc.conversions += Number(m.conversions || 0);
    return acc;
  }, { clicks: 0, impressions: 0, costMicros: 0, conversions: 0 });

  const cost = fromMicros(totals.costMicros);
  return {
    totalClicks: totals.clicks,
    totalImpressions: totals.impressions,
    totalConversions: Math.round(totals.conversions * 10) / 10,
    totalCost: cost,
    totalCostFormatted: formatEuro(cost),
    ctr: totals.impressions > 0
      ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%`
      : null,
    avgCpc: totals.clicks > 0 ? formatEuro(cost / totals.clicks) : null
  };
}

function buildClient(creds) {
  return new GoogleAdsApi({
    client_id: creds.google_ads_client_id,
    client_secret: creds.google_ads_client_secret,
    developer_token: creds.google_ads_developer_token
  });
}

async function queryRange(customer, { startDate, endDate }) {
  return customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  `);
}

/**
 * Live statistieken over een periode, met de vorige periode ernaast zodat de
 * insights-engine er hetzelfde soort signalen uit kan halen als bij GSC/GA4.
 */
async function fetchLiveAccountStats(windows) {
  const missing = missingCredentials();
  if (missing.length > 0) return notConnected(missing);

  const creds = loadCredentials();

  try {
    const client = buildClient(creds);
    const customer = client.Customer({
      customer_id: creds.google_ads_customer_id.replace(/-/g, ''),
      refresh_token: creds.google_ads_refresh_token,
      ...(creds.google_ads_login_customer_id
        ? { login_customer_id: creds.google_ads_login_customer_id.replace(/-/g, '') }
        : {})
    });

    const [currentRows, previousRows] = await Promise.all([
      queryRange(customer, windows.current),
      windows.previous ? queryRange(customer, windows.previous).catch(() => []) : Promise.resolve([])
    ]);

    const campaigns = currentRows.map((row) => ({
      id: row.campaign?.id ? String(row.campaign.id) : null,
      name: row.campaign?.name || '(onbekend)',
      status: row.campaign?.status || null,
      clicks: Number(row.metrics?.clicks || 0),
      impressions: Number(row.metrics?.impressions || 0),
      cost: fromMicros(row.metrics?.cost_micros),
      conversions: Number(row.metrics?.conversions || 0)
    })).sort((a, b) => b.cost - a.cost);

    return {
      connected: true,
      customerId: creds.google_ads_customer_id,
      period: windows,
      summary: buildSummary(currentRows),
      previousSummary: previousRows.length > 0 ? buildSummary(previousRows) : null,
      campaigns,
      missing: [],
      message: null
    };
  } catch (err) {
    // De Ads API verpakt fouten diep; haal de bruikbaarste melding naar boven.
    const detail = err.errors?.[0]?.message || err.message || 'onbekende fout';
    return notConnected([], {
      missing: [],
      error: detail,
      message: `Google Ads gaf een foutmelding terug: ${detail}`
    });
  }
}

module.exports = { isConfigured, missingCredentials, fetchLiveAccountStats };
