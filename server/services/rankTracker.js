const db = require('../db');
const axios = require('axios');

/**
 * Service for checking 100% REAL keyword rankings on Google Netherlands (gl=nl, hl=nl)
 */

function getSerpApiKey() {
  const serpApiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'serp_api_key'").get();
  return process.env.FS_SERPER_API || process.env.SERP_API_KEY || process.env.SERPER_API_KEY || (serpApiKeyRow ? serpApiKeyRow.value : '');
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

  db.prepare(`
    INSERT INTO keyword_rankings (keyword_id, position, previous_position, search_volume, serp_features, url_found, organic_results)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    kw.id,
    position,
    prevPosition,
    null,
    JSON.stringify(serpFeatures),
    foundUrl,
    JSON.stringify(organicSnapshot)
  );

  return {
    keywordId: kw.id,
    keyword: kw.keyword,
    region: kw.region,
    position,
    previousPosition: prevPosition,
    change: prevPosition - position,
    serpFeatures,
    urlFound: foundUrl
  };
}

async function checkKeywordRankings(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('Project niet gevonden');
  const targetDomain = project.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  const keywords = db.prepare('SELECT * FROM keywords WHERE project_id = ?').all(projectId);
  const serpApiKey = getSerpApiKey();
  if (!serpApiKey) throw new Error('Geen SERP API key geconfigureerd. Voeg een Serper.dev key toe bij Instellingen.');

  const results = [];
  for (const kw of keywords) {
    const result = await checkSingleKeyword(kw, targetDomain, serpApiKey);
    if (result) results.push(result);
  }

  return results;
}

module.exports = { checkKeywordRankings, checkSingleKeyword, getSerpApiKey };
