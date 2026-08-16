const axios = require('axios');
const db = require('../db');

/**
 * Gedeelde OAuth2-laag voor Google-diensten die géén service account accepteren.
 *
 * Google Bedrijfsprofiel en Google Ads werken allebei met gebruikerseigen data:
 * Google's eigen documentatie schrijft voor die API's een OAuth 2.0 client ID
 * voor. Een service account werkt daar alleen met domain-wide delegation op een
 * Workspace-domein, en dat is op een consumentenaccount niet beschikbaar.
 *
 * Eén OAuth-client kan beide bedienen; per product bewaren we een eigen refresh
 * token, omdat een refresh token vastzit aan de scopes die bij toestemming zijn
 * gevraagd.
 *
 * Credential-resolutie per veld: env -> settings-tabel, met terugval op de
 * bestaande google_ads_* keys zodat een al ingerichte Ads-koppeling blijft werken.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const PRODUCTS = {
  gbp: {
    label: 'Google Bedrijfsprofiel',
    scope: 'https://www.googleapis.com/auth/business.manage',
    refreshTokenKey: 'google_gbp_refresh_token',
    refreshTokenEnv: ['GOOGLE_GBP_REFRESH_TOKEN']
  },
  ads: {
    label: 'Google Ads',
    scope: 'https://www.googleapis.com/auth/adwords',
    refreshTokenKey: 'google_ads_refresh_token',
    refreshTokenEnv: ['GOOGLE_ADS_REFRESH_TOKEN']
  }
};

// Tokencache per (clientId, refreshToken): verschillende producten kunnen
// dezelfde client gebruiken maar hebben elk hun eigen token.
const tokenCache = new Map();

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row && row.value ? String(row.value).trim() : '';
}

function resolve(envNames, settingKey, fallbackSettingKey) {
  for (const name of envNames) {
    if (process.env[name]) return String(process.env[name]).trim();
  }
  const value = getSetting(settingKey);
  if (value) return value;
  return fallbackSettingKey ? getSetting(fallbackSettingKey) : '';
}

/**
 * De client is gedeeld; google_ads_* blijft als terugval bestaan zodat een
 * bestaande Ads-inrichting niet opnieuw hoeft.
 */
function getCredentials(product) {
  const config = PRODUCTS[product];
  if (!config) throw new Error(`Onbekend OAuth-product: ${product}`);

  return {
    clientId: resolve(['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_ADS_CLIENT_ID'], 'google_oauth_client_id', 'google_ads_client_id'),
    clientSecret: resolve(['GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_ADS_CLIENT_SECRET'], 'google_oauth_client_secret', 'google_ads_client_secret'),
    refreshToken: resolve(config.refreshTokenEnv, config.refreshTokenKey),
    scope: config.scope,
    label: config.label
  };
}

const FIELD_LABELS = {
  clientId: 'OAuth client ID',
  clientSecret: 'OAuth client secret',
  refreshToken: 'refresh token'
};

function missingCredentials(product) {
  const creds = getCredentials(product);
  return ['clientId', 'clientSecret', 'refreshToken']
    .filter((field) => !creds[field])
    .map((field) => FIELD_LABELS[field]);
}

function isConfigured(product) {
  return missingCredentials(product).length === 0;
}

function notConfiguredMessage(product) {
  const missing = missingCredentials(product);
  const config = PRODUCTS[product];
  return `${config.label} is nog niet gekoppeld. Vul bij Instellingen nog in: ${missing.join(', ')}. Een refresh token maak je aan met: node server/oauth-setup.js ${product}`;
}

async function getOAuthToken(product) {
  const creds = getCredentials(product);
  const missing = missingCredentials(product);
  if (missing.length > 0) {
    const err = new Error(notConfiguredMessage(product));
    err.oauthReason = 'not_configured';
    throw err;
  }

  const cacheKey = `${creds.clientId}:${creds.refreshToken}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry - 60000) return cached.token;

  try {
    const response = await axios.post(TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });

    const token = response.data.access_token;
    tokenCache.set(cacheKey, {
      token,
      expiry: Date.now() + (response.data.expires_in || 3600) * 1000
    });
    return token;
  } catch (err) {
    // Een ingetrokken of verlopen refresh token is de meest voorkomende fout;
    // die verdient een instructie in plaats van een kale OAuth-foutcode.
    const detail = err.response?.data?.error_description || err.response?.data?.error || err.message;
    const wrapped = new Error(
      /invalid_grant/i.test(String(detail))
        ? `De refresh token voor ${creds.label} is niet meer geldig (ingetrokken of verlopen). Maak een nieuwe aan met: node server/oauth-setup.js ${product}`
        : `Inloggen bij ${creds.label} mislukte: ${detail}`
    );
    wrapped.oauthReason = /invalid_grant/i.test(String(detail)) ? 'invalid_grant' : 'auth_error';
    throw wrapped;
  }
}

function clearTokenCache() {
  tokenCache.clear();
}

module.exports = {
  PRODUCTS,
  getCredentials,
  getOAuthToken,
  isConfigured,
  missingCredentials,
  notConfiguredMessage,
  clearTokenCache
};
