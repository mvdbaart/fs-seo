const axios = require('axios');
const db = require('../db');
const googleOAuth = require('./googleOAuth');

/**
 * Google Bedrijfsprofiel: accounts, vestigingen en profielgezondheid.
 *
 * Authenticatie loopt via OAuth, niet via een service account. Google's setup-
 * documentatie voor de Business Profile API schrijft expliciet een OAuth 2.0
 * client ID voor ("your app accesses protected, non-public data"); de data is
 * gebruikerseigendom en een service account werkt alleen met domain-wide
 * delegation op een Workspace-domein. Zie services/googleOAuth.js.
 */

const ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const LOCATIONS_READ_MASK = 'name,title,storefrontAddress,primaryPhone,websiteUri,categories';

// Accounts en vestigingen veranderen zelden; de performance-service leunt
// hierop, dus één uur cache scheelt twee API-aanroepen per verzoek.
const LOCATION_CACHE_TTL_MS = 60 * 60 * 1000;
let locationCache = null;

function isConfigured() {
  return googleOAuth.isConfigured('gbp');
}

async function getAccessToken() {
  return googleOAuth.getOAuthToken('gbp');
}

/**
 * Vertaal een Google-fout naar een reden waar een Nederlandse melding aan
 * gekoppeld kan worden. Gedeeld met gbpPerformanceService.
 */
function classifyGoogleError(err) {
  if (err.oauthReason === 'not_configured') return 'not_configured';
  if (err.oauthReason === 'invalid_grant') return 'invalid_grant';

  const status = err.response?.status;
  const message = err.response?.data?.error?.message || err.message || '';

  if (/has not been used in project|is disabled|SERVICE_DISABLED/i.test(message)) return 'api_not_enabled';
  if (status === 429 || /Quota exceeded|quota metric|RESOURCE_EXHAUSTED/i.test(message)) return 'no_quota';
  if (status === 401 || status === 403) return 'no_access';
  return 'api_error';
}

function googleErrorMessage(err) {
  return err.response?.data?.error?.message || err.message || 'onbekende fout';
}

/**
 * Accounts + vestigingen ophalen. Gooit een fout met .gbpReason zodat elke
 * aanroeper er een eigen Nederlandse melding aan kan hangen.
 */
async function listLocations({ refresh = false } = {}) {
  if (!refresh && locationCache && Date.now() - locationCache.timestamp < LOCATION_CACHE_TTL_MS) {
    return locationCache.data;
  }

  try {
    const token = await getAccessToken();

    const accRes = await axios.get(ACCOUNTS_URL, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });

    const accounts = accRes.data?.accounts || [];
    if (accounts.length === 0) {
      const err = new Error('Geen bedrijfsprofiel-accounts gevonden voor dit Google-account.');
      err.gbpReason = 'no_account';
      throw err;
    }

    const accountName = accounts[0].name;
    const locRes = await axios.get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=${LOCATIONS_READ_MASK}`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );

    const data = { accountName, locations: locRes.data?.locations || [] };
    locationCache = { timestamp: Date.now(), data };
    return data;
  } catch (err) {
    if (!err.gbpReason) err.gbpReason = classifyGoogleError(err);
    throw err;
  }
}

/**
 * Welke vestiging rapporteren we? Standaard de eerste; met een instelling te
 * overrulen als er meerdere zijn.
 */
function resolveLocationName(locations) {
  const override = db.prepare("SELECT value FROM settings WHERE key = 'gbp_location_id'").get()?.value;
  if (override && override.trim()) {
    const trimmed = override.trim();
    return trimmed.startsWith('locations/') ? trimmed : `locations/${trimmed}`;
  }
  return locations[0]?.name || null;
}

/**
 * Nederlandse uitleg per faalmodus. Gedeeld met gbpPerformanceService, zodat
 * beide schermen dezelfde taal spreken over dezelfde oorzaak.
 */
const GBP_REASON_MESSAGES = {
  not_configured: () => googleOAuth.notConfiguredMessage('gbp'),
  invalid_grant: () => 'De koppeling met Google Bedrijfsprofiel is verlopen of ingetrokken. Maak een nieuwe verbinding met: node server/oauth-setup.js gbp',
  api_not_enabled: () => 'De Business Profile API\'s staan nog uit in je Google Cloud-project. Zet "My Business Account Management API", "My Business Business Information API" en "Business Profile Performance API" aan.',
  no_quota: () => 'Je Google Cloud-project heeft nog geen quotum voor de Business Profile API (0 verzoeken per minuut). Dien het formulier "Application For Basic API Access" in bij Google — een quotumverhoging aanvragen werkt hier niet. Voorwaarde: een geverifieerd profiel dat 60+ dagen actief is.',
  no_access: () => 'Het gekoppelde Google-account heeft geen toegang tot een bedrijfsprofiel. Log in met het account dat het profiel beheert, of laat je uitnodigen als beheerder via business.google.com → Instellingen → Mensen en toegang.',
  no_account: () => 'Er is geen bedrijfsprofiel gevonden onder dit Google-account. Controleer of je met het juiste account bent ingelogd.',
  no_location: () => 'Er is nog geen vestiging gevonden in je bedrijfsprofiel. Controleer of het profiel geverifieerd is.',
  api_error: (err) => `Google gaf een foutmelding terug: ${googleErrorMessage(err)}`
};

function reasonMessage(reason, err) {
  const builder = GBP_REASON_MESSAGES[reason] || GBP_REASON_MESSAGES.api_error;
  return builder(err || new Error('onbekende fout'));
}

/**
 * Fetch Google Business Profile Accounts & Locations
 */
async function getGbpAnalysis(projectId) {
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
    const result = await listLocations();
    locations = result.locations;
    connected = true;
  } catch (err) {
    // Niet gekoppeld is een normale toestand, geen storing: leg uit wat er mist.
    errorNotice = GBP_REASON_MESSAGES[err.gbpReason]
      ? GBP_REASON_MESSAGES[err.gbpReason](err)
      : googleErrorMessage(err);
  }

  // Calculated optimization score & action recommendations
  const recommendations = [];

  if (!connected) {
    recommendations.push({
      category: 'Machtigingen & Koppeling',
      title: 'Koppel je Google Bedrijfsprofiel',
      description: errorNotice,
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
    // Historisch veld: de koppeling loopt niet meer via een service account.
    serviceAccountEmail: null,
    napInfo,
    napMessage,
    locations,
    recommendations,
    errorNotice,
    healthChecks,
    profileHealthScore
  };
}

module.exports = {
  getGbpAnalysis,
  getAccessToken,
  isConfigured,
  listLocations,
  resolveLocationName,
  classifyGoogleError,
  googleErrorMessage,
  reasonMessage
};
