const axios = require('axios');
const db = require('../db');
const { getSeries, hasSnapshot } = require('./metricSnapshots');

/**
 * Places API (New): publieke beoordelingen en reviewaantallen, van je eigen
 * bedrijf én van je concurrenten. Dit is de enige bron waarmee je je Maps-score
 * kunt vergelijken met die van anderen — de Business Profile API geeft alleen
 * je eigen profiel.
 *
 * ⚠️ KOSTEN. De velden `rating` en `userRatingCount` vallen in de duurste
 * (Enterprise) prijstier, en Google rekent af op het duurste veld in het
 * verzoek. Elke ophaalactie kost dus geld, met een beperkt gratis maandtegoed.
 * Daarom drie cachelagen, waarvan de dagelijkse snapshot-guard de belangrijkste
 * is: die maximeert het verbruik op (1 + aantal concurrenten) verzoeken per dag,
 * ongeacht hoe vaak het dashboard geopend wordt.
 */

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

// ⚠️ De veldmaskers zijn asymmetrisch: Text Search wil een 'places.'-prefix,
// Place Details niet. Verwisselen levert een HTTP 400 op. Geen spaties.
const SEARCH_MASK = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.location';
const DETAILS_MASK = 'id,displayName,formattedAddress,rating,userRatingCount,websiteUri,googleMapsUri,location';

const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
const detailsCache = new Map();

// Elke uitgaande aanroep wordt geteld en gelogd: als de dagelijkse guard ooit
// regresseert, is dat het enige wat het zichtbaar maakt vóór de rekening komt.
let outboundCallCount = 0;

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row && row.value ? String(row.value).trim() : '';
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

function getApiKey() {
  return process.env.FS_PLACES_API_KEY
    || process.env.FS_SEO_GSC_API
    || getSetting('places_api_key');
}

function isConfigured() {
  return !!getApiKey();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ----------------------------------------------------
// Matching: liever geen match dan de verkeerde
// ----------------------------------------------------

function hostOf(url) {
  if (!url) return null;
  try {
    const parsed = new URL(String(url).startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return null;
  }
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(b\.?v\.?|v\.?o\.?f\.?|n\.?v\.?)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Plaatsnaam uit "De Tienden 26B, 5674 TB Nuenen" -> "nuenen" */
function cityFromAddress(address) {
  if (!address) return null;
  const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || '';
  const city = last.replace(/\d{4}\s*[A-Za-z]{2}/, '').trim();
  return city ? city.toLowerCase() : null;
}

/**
 * Ladder, eerste treffer wint. Valt bewust nooit terug op het eerste
 * zoekresultaat: een stille verkeerde match is erger dan een zichtbaar gat.
 */
function matchCandidate(candidates, { name, domain, city }) {
  const wantedHost = hostOf(domain);

  if (wantedHost) {
    const exact = candidates.find((c) => hostOf(c.websiteUri) === wantedHost);
    if (exact) return { place: exact, confidence: 'exact' };

    const related = candidates.find((c) => {
      const host = hostOf(c.websiteUri);
      if (!host) return false;
      return host.endsWith(`.${wantedHost}`) || wantedHost.endsWith(`.${host}`);
    });
    if (related) return { place: related, confidence: 'domain' };
  }

  if (name) {
    const wantedName = normalizeName(name);
    const byName = candidates.find((c) => {
      if (normalizeName(c.displayName?.text) !== wantedName) return false;
      if (!city) return true;
      return String(c.formattedAddress || '').toLowerCase().includes(city);
    });
    if (byName) return { place: byName, confidence: 'name' };
  }

  return null;
}

// ----------------------------------------------------
// API-aanroepen
// ----------------------------------------------------

function normalizePlace(place) {
  return {
    placeId: place.id || null,
    displayName: place.displayName?.text || null,
    address: place.formattedAddress || null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    websiteUri: place.websiteUri || null,
    mapsUri: place.googleMapsUri || null,
    location: place.location || null
  };
}

function classifyPlacesError(err) {
  const status = err.response?.status;
  const message = err.response?.data?.error?.message || err.message || '';
  if (/has not been used in project|is disabled|SERVICE_DISABLED/i.test(message)) return 'api_not_enabled';
  if (/API key not valid|API_KEY_INVALID|referer|IP address/i.test(message)) return 'invalid_key';
  if (status === 429 || /Quota exceeded|RESOURCE_EXHAUSTED/i.test(message)) return 'no_quota';
  if (status === 403) return 'invalid_key';
  return 'api_error';
}

async function searchPlace(textQuery, { locationBias = null } = {}) {
  const body = {
    textQuery,
    languageCode: 'nl',
    regionCode: 'NL',
    maxResultCount: 5
  };
  if (locationBias) body.locationBias = locationBias;

  outboundCallCount += 1;
  console.log(`[places] searchText #${outboundCallCount}: ${textQuery}`);

  const response = await axios.post(SEARCH_URL, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': SEARCH_MASK
    },
    timeout: 15000
  });

  return (response.data?.places || []).map(normalizePlace);
}

async function getPlaceDetails(placeId) {
  const cached = detailsCache.get(placeId);
  if (cached && Date.now() - cached.timestamp < MEMORY_TTL_MS) return cached.place;

  outboundCallCount += 1;
  console.log(`[places] details #${outboundCallCount}: ${placeId}`);

  const response = await axios.get(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': DETAILS_MASK
    },
    timeout: 15000
  });

  const place = normalizePlace(response.data);
  detailsCache.set(placeId, { timestamp: Date.now(), place });
  return place;
}

/**
 * Place ID één keer opzoeken en bewaren. searchText is de dure aanroep; daarna
 * volstaat Place Details. Een handmatige verversing mag dit nooit opnieuw doen.
 */
async function resolvePlaceId({ name, domain, city, locationBias, storedPlaceId }) {
  if (storedPlaceId) {
    const place = await getPlaceDetails(storedPlaceId);
    return { place, confidence: 'stored' };
  }

  const query = city ? `${name} ${city}` : name;
  const candidates = await searchPlace(query, { locationBias });
  if (candidates.length === 0) return null;

  return matchCandidate(candidates, { name, domain, city });
}

// ----------------------------------------------------
// Publieke API
// ----------------------------------------------------

const REASON_MESSAGES = {
  not_configured: 'Google Maps-cijfers zijn nog niet beschikbaar. Vul een Places API-sleutel in bij Instellingen om je beoordeling en die van je concurrenten op te halen.',
  api_not_enabled: 'De Places API (New) staat nog uit in je Google Cloud-project. Zet "Places API (New)" aan in de Google Cloud Console.',
  no_quota: 'Het aanvraaglimiet van de Places API is bereikt. Controleer je quota en facturatie in de Google Cloud Console; de cijfers worden maximaal één keer per dag opgehaald.',
  invalid_key: 'De Places API-sleutel wordt geweigerd door Google. Controleer of de sleutel geldig is en of er geen verwijzer- of IP-beperking op staat die deze server blokkeert.',
  no_business: 'Vul je bedrijfsnaam in bij Instellingen, zodat we je bedrijf in Google Maps kunnen opzoeken.',
  no_match: 'Je bedrijf is niet teruggevonden in Google Maps. Controleer de bedrijfsnaam en het adres bij Instellingen.',
  api_error: 'Google Maps gaf een foutmelding terug.'
};

function notConnected(reason, extra = {}) {
  return {
    connected: false,
    reason,
    message: REASON_MESSAGES[reason] || REASON_MESSAGES.api_error,
    own: null,
    competitors: [],
    unmatched: [],
    fetchedDay: null,
    fromCache: false,
    ...extra
  };
}

/**
 * Antwoord opbouwen uit de snapshots van vandaag: nul API-aanroepen.
 */
function buildFromSnapshots(projectId, day) {
  const latest = (metric) => {
    const series = getSeries(projectId, 'places', metric, 2);
    const row = series.filter((r) => r.day === day).pop();
    return row || null;
  };

  const ownRating = latest('rating');
  const ownReviews = latest('reviewCount');
  if (!ownRating) return null;

  const competitors = db.prepare('SELECT id, name, domain, place_id, place_match FROM competitors WHERE project_id = ?').all(projectId);
  const rows = [];
  for (const competitor of competitors) {
    const rating = latest(`competitor:${competitor.id}:rating`);
    const reviews = latest(`competitor:${competitor.id}:reviewCount`);
    if (!rating) continue;
    rows.push({
      id: competitor.id,
      name: rating.meta?.name || competitor.name,
      placeId: competitor.place_id,
      confidence: competitor.place_match || 'stored',
      rating: rating.value,
      reviewCount: reviews ? reviews.value : null,
      mapsUri: rating.meta?.mapsUri || null
    });
  }

  return {
    connected: true,
    reason: null,
    message: null,
    own: {
      name: ownRating.meta?.name || getSetting('business_name') || null,
      placeId: getSetting('places_place_id') || null,
      rating: ownRating.value,
      reviewCount: ownReviews ? ownReviews.value : null,
      mapsUri: ownRating.meta?.mapsUri || null
    },
    competitors: rows,
    unmatched: [],
    fetchedDay: day,
    fromCache: true
  };
}

async function getPlacesComparison(projectId, { refresh = false } = {}) {
  if (!isConfigured()) return notConnected('not_configured');

  const day = today();

  // Laag 2 — de kostenbewaking. Staat er al een meting van vandaag, dan doen we
  // nul netwerkaanroepen. Dit is de belangrijkste regel in dit bestand.
  if (!refresh && hasSnapshot(projectId, 'places', 'rating', day)) {
    const cached = buildFromSnapshots(projectId, day);
    if (cached) return cached;
  }

  const businessName = getSetting('business_name');
  if (!businessName) return notConnected('no_business');

  const city = cityFromAddress(getSetting('business_address'));
  const project = db.prepare('SELECT domain FROM projects WHERE id = ?').get(projectId);

  let own;
  let locationBias = null;

  try {
    // Laag 1 — place_id blijft bewaard, ook bij een handmatige verversing.
    const storedPlaceId = getSetting('places_place_id');
    const matched = await resolvePlaceId({
      name: businessName,
      domain: project?.domain,
      city,
      storedPlaceId: storedPlaceId || null
    });

    if (!matched) return notConnected('no_match');
    own = matched.place;
    if (own.placeId && own.placeId !== storedPlaceId) setSetting('places_place_id', own.placeId);

    if (own.location?.latitude && own.location?.longitude) {
      locationBias = {
        circle: {
          center: { latitude: own.location.latitude, longitude: own.location.longitude },
          radius: 25000.0
        }
      };
    }
  } catch (err) {
    return notConnected(classifyPlacesError(err), { error: err.response?.data?.error?.message || err.message });
  }

  const competitors = db.prepare('SELECT id, name, domain, place_id FROM competitors WHERE project_id = ?').all(projectId);
  const matchedCompetitors = [];
  const unmatched = [];

  for (const competitor of competitors) {
    try {
      const result = await resolvePlaceId({
        name: competitor.name,
        domain: competitor.domain,
        city,
        locationBias,
        storedPlaceId: competitor.place_id || null
      });

      if (!result) {
        unmatched.push({ id: competitor.id, name: competitor.name });
        continue;
      }

      const confidence = competitor.place_id ? (competitor.place_match || 'stored') : result.confidence;
      if (result.place.placeId && result.place.placeId !== competitor.place_id) {
        db.prepare('UPDATE competitors SET place_id = ?, place_match = ? WHERE id = ?')
          .run(result.place.placeId, result.confidence, competitor.id);
      }

      matchedCompetitors.push({
        id: competitor.id,
        name: result.place.displayName || competitor.name,
        placeId: result.place.placeId,
        confidence,
        rating: result.place.rating,
        reviewCount: result.place.reviewCount,
        mapsUri: result.place.mapsUri,
        address: result.place.address
      });
    } catch (err) {
      unmatched.push({ id: competitor.id, name: competitor.name, error: err.message });
    }
  }

  return {
    connected: true,
    reason: null,
    message: competitors.length === 0
      ? 'Er zijn nog geen concurrenten ingevoerd. Voeg concurrenten toe om je beoordeling te kunnen vergelijken.'
      : null,
    own: {
      name: own.displayName || businessName,
      placeId: own.placeId,
      rating: own.rating,
      reviewCount: own.reviewCount,
      mapsUri: own.mapsUri,
      address: own.address
    },
    competitors: matchedCompetitors,
    unmatched,
    fetchedDay: day,
    fromCache: false
  };
}

function getOutboundCallCount() {
  return outboundCallCount;
}

module.exports = {
  isConfigured,
  getPlacesComparison,
  searchPlace,
  getPlaceDetails,
  matchCandidate,
  normalizeName,
  hostOf,
  cityFromAddress,
  getOutboundCallCount
};
