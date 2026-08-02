const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../db');

/**
 * Google Search Console API client via een service account.
 * De GSC API werkt NIET met een simpele API key; er is een service account
 * (JSON credentials) nodig dat als gebruiker is toegevoegd aan de GSC property.
 *
 * Credential-resolutie (zelfde cascade-patroon als de andere keys):
 *   1. FS_GSC_SERVICE_ACCOUNT env var (pad naar JSON-bestand of inline JSON)
 *   2. GOOGLE_APPLICATION_CREDENTIALS env var (pad naar JSON-bestand)
 *   3. settings-tabel key 'gsc_service_account_json' (geplakte JSON in de UI)
 */

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const API_BASE = 'https://www.googleapis.com/webmasters/v3';

let cachedToken = null;
let cachedTokenExpiry = 0;

function loadCredentials() {
  const candidates = [];
  if (process.env.FS_GSC_SERVICE_ACCOUNT) candidates.push(process.env.FS_GSC_SERVICE_ACCOUNT);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) candidates.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'gsc_service_account_json'").get();
  if (settingsRow && settingsRow.value) candidates.push(settingsRow.value);

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    try {
      const raw = trimmed.startsWith('{') ? trimmed : fs.readFileSync(trimmed, 'utf8');
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

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60000) return cachedToken;

  const creds = loadCredentials();
  if (!creds) throw new Error('GSC service account niet geconfigureerd');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: GSC_SCOPE,
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

async function gscRequest(method, urlPath, body) {
  const token = await getAccessToken();
  try {
    const response = await axios({
      method,
      url: `${API_BASE}${urlPath}`,
      data: body,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    return response.data;
  } catch (err) {
    // Geef de echte Google-foutmelding door in plaats van een kale statuscode
    const apiMessage = err.response?.data?.error?.message;
    if (apiMessage) throw new Error(apiMessage);
    throw err;
  }
}

/**
 * Bepaal de GSC property voor een domein: voorkeur voor sc-domain,
 * anders de URL-prefix property die het domein bevat.
 */
async function resolveSiteUrl(domain) {
  const bareDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  const data = await gscRequest('get', '/sites');
  const entries = data.siteEntry || [];

  const domainProp = entries.find(s => s.siteUrl === `sc-domain:${bareDomain}`);
  if (domainProp) return domainProp.siteUrl;

  const urlProp = entries.find(s => s.siteUrl.includes(bareDomain));
  if (urlProp) return urlProp.siteUrl;

  return null;
}

async function querySearchAnalytics(siteUrl, { startDate, endDate, dimensions = [], rowLimit = 250, dimensionFilterGroups } = {}) {
  const body = { startDate, endDate, dimensions, rowLimit };
  if (dimensionFilterGroups) body.dimensionFilterGroups = dimensionFilterGroups;
  const data = await gscRequest('post', `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, body);
  return data.rows || [];
}

async function listSitemaps(siteUrl) {
  const data = await gscRequest('get', `/sites/${encodeURIComponent(siteUrl)}/sitemaps`);
  return data.sitemap || [];
}

module.exports = { isConfigured, resolveSiteUrl, querySearchAnalytics, listSitemaps };
