const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const db = require('../db');

const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const INDEXING_API_BASE = 'https://indexing.googleapis.com/v3/urlNotifications';

let cachedToken = null;
let cachedTokenExpiry = 0;

function loadCredentials() {
  const candidates = [];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) candidates.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (process.env.FS_GSC_SERVICE_ACCOUNT) candidates.push(process.env.FS_GSC_SERVICE_ACCOUNT);

  // Direct file fallback in project root
  const rootJsonPath = path.join(__dirname, '../../frissestart-21fea-24b59bd8ea4c.json');
  if (fs.existsSync(rootJsonPath)) candidates.push(rootJsonPath);

  const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'gsc_service_account_json'").get();
  if (settingsRow && settingsRow.value) candidates.push(settingsRow.value);

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    try {
      const raw = trimmed.startsWith('{') ? trimmed : fs.readFileSync(trimmed, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.client_email && parsed.private_key) return parsed;
    } catch (e) {
      // Probeer de volgende candidate
    }
  }
  return null;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60000) return cachedToken;

  const creds = loadCredentials();
  if (!creds) throw new Error('Google Service Account niet geconfigureerd');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: INDEXING_SCOPE,
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

/**
 * Publiceer een URL update of verwijdering naar de Google Indexing API
 * @param {string} targetUrl - Volledige URL (bijv. https://frissestart.nl/heftruck-cursus)
 * @param {'URL_UPDATED'|'URL_DELETED'} type - Type verzoek
 */
async function publishUrl(targetUrl, type = 'URL_UPDATED') {
  if (!targetUrl || !targetUrl.startsWith('http')) {
    throw new Error('Geef een geldige volledige URL op (inclusief http:// of https://)');
  }

  const token = await getAccessToken();

  try {
    const response = await axios.post(`${INDEXING_API_BASE}:publish`, {
      url: targetUrl,
      type: type
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    // Sla log op in SQLite database indien gewenst
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS indexing_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          response_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      db.prepare(`
        INSERT INTO indexing_logs (url, type, status, response_json)
        VALUES (?, ?, ?, ?)
      `).run(targetUrl, type, 'SUCCESS', JSON.stringify(response.data));
    } catch (dbErr) {
      console.error('Kon indexing log niet opslaan:', dbErr);
    }

    return {
      success: true,
      url: targetUrl,
      type: type,
      notifyTime: response.data?.urlNotificationMetadata?.latestUpdate?.notifyTime || new Date().toISOString(),
      raw: response.data
    };
  } catch (err) {
    const apiError = err.response?.data?.error?.message || err.message;
    
    try {
      db.prepare(`
        INSERT INTO indexing_logs (url, type, status, response_json)
        VALUES (?, ?, ?, ?)
      `).run(targetUrl, type, 'ERROR', JSON.stringify({ error: apiError }));
    } catch (e) {}

    throw new Error(`Google Indexing API Fout: ${apiError}`);
  }
}

/**
 * Haal de laatste notificatiestatus van een URL op bij Google
 */
async function getUrlStatus(targetUrl) {
  if (!targetUrl) throw new Error('Geen URL opgegeven');
  const token = await getAccessToken();

  try {
    const response = await axios.get(`${INDEXING_API_BASE}/metadata?url=${encodeURIComponent(targetUrl)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 15000
    });
    return response.data;
  } catch (err) {
    const apiError = err.response?.data?.error?.message || err.message;
    throw new Error(`Google Indexing Metadata Fout: ${apiError}`);
  }
}

module.exports = { publishUrl, getUrlStatus };
