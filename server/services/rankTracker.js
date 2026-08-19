const db = require('../db');
const axios = require('axios');

/**
 * Service for checking 100% REAL keyword rankings on Google Netherlands (gl=nl, hl=nl)
 */

function getSerpApiKey() {
  const serpApiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'serp_api_key'").get();
  const dbKey = (serpApiKeyRow && serpApiKeyRow.value) ? serpApiKeyRow.value.trim() : '';
  if (dbKey) return dbKey;
  const envKey = process.env.FS_SERPER_API || process.env.SERP_API_KEY || process.env.SERPER_API_KEY || '';
  return envKey.trim();
}

function calculateKeywordDifficulty(keyword, organicSnapshot = [], serpFeatures = []) {
  const kw = (keyword || '').toLowerCase().trim();
  const words = kw.split(/\s+/).filter(Boolean);
  
  let kd = 50;
  if (words.length === 1) kd = 75;
  else if (words.length === 2) kd = 55;
  else if (words.length === 3) kd = 38;
  else if (words.length === 4) kd = 26;
  else kd = 18; // Long tail (5+ words)

  const localTerms = ['geldrop', 'nuenen', 'eindhoven', 'helmond', 'veldhoven', 'best', 'valkenswaard', 'brabant', 'regio', 'zuidoost-brabant'];
  const hasLocal = localTerms.some(term => kw.includes(term));
  if (hasLocal) {
    kd -= 12;
  }

  const actionTerms = ['hercertificering', '1 uur', 'halen', 'cursus', 'opleiding', 'nascholing', 'kosten', 'korting', 'soob', 'subsidie', 'planner', 'spoed', 'behalen', 'vacatures', 'aanmelden'];
  if (actionTerms.some(term => kw.includes(term))) {
    kd -= 6;
  }

  const highCompTerms = ['vacatures', 'rijbewijs', 'vca', 'heftruck', 'vrachtwagen', 'uitzendbureau'];
  if (words.length <= 2 && highCompTerms.some(term => kw.includes(term)) && !hasLocal) {
    kd += 15;
  }

  if (organicSnapshot && organicSnapshot.length > 0) {
    const highAuthDomains = [
      'cbr.nl', 'rijksoverheid.nl', 'belastingdienst.nl', 'kvk.nl', 
      'anwb.nl', 'wikipedia.org', 'indeed.com', 'nationaleberoepengids.nl',
      'werk.nl', 'randstad.nl', 'tempo-team.nl'
    ];
    let authCount = 0;
    organicSnapshot.slice(0, 10).forEach(item => {
      const link = (item.link || '').toLowerCase();
      if (highAuthDomains.some(d => link.includes(d))) {
        authCount++;
      }
    });
    kd += authCount * 4;
  }

  if (serpFeatures && serpFeatures.includes('featured_snippet')) {
    kd += 5;
  }
  if (serpFeatures && serpFeatures.includes('local_pack') && hasLocal) {
    kd -= 5;
  }

  return Math.max(5, Math.min(95, Math.round(kd)));
}

/**
 * Check one keyword live on Google.nl and persist the ranking + a top-20 SERP
 * snapshot (used by the competitor gap & cannibalization analysis).
 * Returns null when no SERP API key is configured, so callers can distinguish
 * "not checked" from "not ranked".
 */
async function checkSingleKeyword(kw, targetDomain, serpApiKey) {
  let position = 0; // 0 = niet gevonden in top 100
  let foundUrl = '';
  let serpFeatures = ['organic'];
  let organicSnapshot = [];

  try {
    const response = await axios.post('https://google.serper.dev/search', {
      q: kw.keyword,
      gl: 'nl',
      hl: 'nl',
      location: kw.region && kw.region !== 'Nederland' ? `${kw.region}, Netherlands` : 'Netherlands',
      num: 50
    }, {
      headers: {
        'X-API-KEY': serpApiKey,
        'Content-Type': 'application/json'
      },
      timeout: 6000
    });

    const organic = response.data?.organic || [];
    organicSnapshot = organic.slice(0, 20).map((item, idx) => ({
      position: idx + 1,
      link: item.link,
      title: item.title || ''
    }));

    const matchIndex = organic.findIndex(item => item.link.includes(targetDomain));
    if (matchIndex !== -1) {
      position = matchIndex + 1;
      foundUrl = organic[matchIndex].link;
    }

    if (response.data?.answerBox) serpFeatures.push('featured_snippet');
    if (response.data?.places) serpFeatures.push('local_pack');
    if (response.data?.images) serpFeatures.push('image_pack');
  } catch (err) {
    console.error(`SERP API call failed for keyword "${kw.keyword}":`, err.message);
    return null;
  }

  const prevRankRow = db.prepare('SELECT position FROM keyword_rankings WHERE keyword_id = ? ORDER BY checked_at DESC LIMIT 1').get(kw.id);
  const prevPosition = prevRankRow ? prevRankRow.position : position;
  const kd = calculateKeywordDifficulty(kw.keyword, organicSnapshot, serpFeatures);

  db.prepare('UPDATE keywords SET difficulty = ? WHERE id = ?').run(kd, kw.id);

  db.prepare(`
    INSERT INTO keyword_rankings (keyword_id, position, previous_position, search_volume, serp_features, url_found, organic_results, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    kw.id,
    position,
    prevPosition,
    null,
    JSON.stringify(serpFeatures),
    foundUrl,
    JSON.stringify(organicSnapshot),
    kd
  );

  return {
    keywordId: kw.id,
    keyword: kw.keyword,
    region: kw.region,
    position,
    previousPosition: prevPosition,
    change: prevPosition - position,
    serpFeatures,
    urlFound: foundUrl,
    difficulty: kd
  };
}

async function checkKeywordRankings(projectId, keywordIds = null) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('Project niet gevonden');
  const targetDomain = project.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  let keywords;
  if (Array.isArray(keywordIds) && keywordIds.length > 0) {
    const placeholders = keywordIds.map(() => '?').join(',');
    keywords = db.prepare(`SELECT * FROM keywords WHERE project_id = ? AND id IN (${placeholders})`).all(projectId, ...keywordIds);
  } else {
    keywords = db.prepare('SELECT * FROM keywords WHERE project_id = ?').all(projectId);
  }

  const serpApiKey = getSerpApiKey();
  if (!serpApiKey) throw new Error('Geen SERP API key geconfigureerd. Voeg een Serper.dev key toe bij Instellingen.');

  const results = [];
  for (const kw of keywords) {
    const result = await checkSingleKeyword(kw, targetDomain, serpApiKey);
    if (result) results.push(result);
  }

  return results;
}

module.exports = { checkKeywordRankings, checkSingleKeyword, getSerpApiKey, calculateKeywordDifficulty };
