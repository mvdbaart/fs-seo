const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../db');

/**
 * Google Business Profile (My Business) Performance & Insights Service
 * Uses official Google My Business Business Information & Account Management APIs.
 */

const GBP_SCOPES = [
  'https://www.googleapis.com/auth/business.manage'
].join(' ');

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
      // Ignore
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
  if (!creds) throw new Error('Service Account niet geconfigureerd. Vul service account in bij Instellingen.');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: GBP_SCOPES,
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
 * Fetch Google Business Profile Accounts & Locations
 */
async function getGbpAnalysis(projectId) {
  const creds = loadCredentials();
  const serviceAccountEmail = creds ? creds.client_email : null;

  const napInfo = {
    name: db.prepare("SELECT value FROM settings WHERE key = 'business_name'").get()?.value || null,
    address: db.prepare("SELECT value FROM settings WHERE key = 'business_address'").get()?.value || null,
    phone: db.prepare("SELECT value FROM settings WHERE key = 'business_phone'").get()?.value || null
  };

  const napMessage = (napInfo.name && napInfo.address && napInfo.phone)
    ? null
    : 'Vul bedrijfsnaam, adres en telefoonnummer in bij Instellingen — die zijn nodig om de NAP-gegevens te kunnen controleren.';

  let connected = false;
  let locations = [];
  let errorNotice = null;

  try {
    const token = await getAccessToken();
    // Call Google My Business Account Management API
    const accRes = await axios.get('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 6000
    });

    if (accRes.data && accRes.data.accounts) {
      connected = true;
      const accountName = accRes.data.accounts[0].name;

      // Fetch locations under this account
      const locRes = await axios.get(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,primaryPhone,websiteUri,categories,rating`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 6000
      });

      locations = locRes.data.locations || [];
    }
  } catch (err) {
    // Service account error or not invited yet
    errorNotice = err.response?.data?.error?.message || err.message;
  }

  // Calculated optimization score & action recommendations
  const recommendations = [];

  if (!connected) {
    recommendations.push({
      category: 'Machtigingen & Koppeling',
      title: 'Voeg het service account toe als beheerder in Google Bedrijfsprofiel',
      description: serviceAccountEmail
        ? `Voeg ${serviceAccountEmail} toe als gebruiker/beheerder via business.google.com ➔ Instellingen ➔ Gebruikers, zodat de Maps-gegevens automatisch kunnen worden ingelezen.`
        : 'Er is nog geen service account ingesteld. Plak de service-account JSON bij Instellingen en voeg het adres daarna toe als beheerder in Google Bedrijfsprofiel.',
      priority: 'Kritiek'
    });
  }

  // Reviewadvies koppelen aan de eigen zoekwoorden in plaats van vaste termen.
  const topKeywords = db.prepare(
    'SELECT keyword FROM keywords WHERE project_id = ? ORDER BY id LIMIT 2'
  ).all(projectId).map((r) => r.keyword);

  recommendations.push({
    category: 'Reviews',
    title: topKeywords.length > 0
      ? `Verzamel nieuwe reviews waarin "${topKeywords.join('" en "')}" voorkomen`
      : 'Verzamel structureel nieuwe reviews',
    description: 'Reviews waarin bezoekers je dienst met naam noemen, helpen Google die dienst aan je profiel te koppelen in de lokale resultaten.',
    priority: 'Hoog'
  });

  recommendations.push({
    category: 'Profielcategorieën',
    title: 'Controleer je hoofd- en secundaire bedrijfscategorie',
    description: 'De hoofdcategorie bepaalt voor welke zoekopdrachten je überhaupt in de lokale resultaten kunt verschijnen. Zorg dat elke tak van het bedrijf een passende categorie heeft.',
    priority: 'Hoog'
  });

  recommendations.push({
    category: 'Google Posts',
    title: 'Plaats elke 14 dagen een update-post op het bedrijfsprofiel',
    description: 'Actieve profielen met regelmatige foto- en nieuwsposts krijgen voorkeur in de lokale zoekresultaten.',
    priority: 'Medium'
  });

  // Echte checklist in plaats van een vast cijfer: alleen te bepalen als er
  // daadwerkelijk profielgegevens zijn opgehaald.
  const healthChecks = connected
    ? [
      { key: 'locations', label: 'Vestiging gevonden', ok: locations.length > 0 },
      { key: 'website', label: 'Website ingevuld', ok: locations.some((l) => !!l.websiteUri) },
      { key: 'phone', label: 'Telefoonnummer ingevuld', ok: locations.some((l) => !!l.primaryPhone) },
      { key: 'address', label: 'Adres ingevuld', ok: locations.some((l) => !!l.storefrontAddress) },
      { key: 'categories', label: 'Meerdere categorieën', ok: locations.some((l) => (l.categories?.additionalCategories?.length || 0) > 0) }
    ]
    : null;

  const profileHealthScore = healthChecks
    ? Math.round((healthChecks.filter((c) => c.ok).length / healthChecks.length) * 100)
    : null;

  return {
    connected,
    serviceAccountEmail,
    napInfo,
    napMessage,
    locations,
    recommendations,
    errorNotice,
    healthChecks,
    profileHealthScore
  };
}

module.exports = { getGbpAnalysis };
