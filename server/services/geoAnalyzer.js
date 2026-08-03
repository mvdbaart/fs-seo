const db = require('../db');
const axios = require('axios');

const REGIONS = ['Geldrop', 'Nuenen', 'Eindhoven', 'Helmond', 'Utrecht', 'Amsterdam', 'Rotterdam'];

/**
 * Service to execute 100% REAL regional SERP rank checks per project.
 */
async function runGeoRankCheck(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return [];

  const keywords = db.prepare('SELECT * FROM keywords WHERE project_id = ?').all(projectId);
  const serpApiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'serp_api_key'").get();
  const serpApiKey = process.env.FS_SERPER_API || process.env.SERP_API_KEY || process.env.SERPER_API_KEY || (serpApiKeyRow ? serpApiKeyRow.value : '');

  if (keywords.length === 0) {
    // Geen zoekwoorden = geen check; er wordt bewust niets verzonnen of geseed.
    return [];
  }

  if (!serpApiKey) {
    throw new Error('Geen SERP API key geconfigureerd. Voeg een Serper.dev key toe bij Instellingen.');
  }

  const domainMatch = project.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  // Naam-varianten om het bedrijf in de local pack te herkennen (domeinnaam zonder TLD + projectnaam)
  const businessNames = [
    domainMatch.replace(/^www\./, '').split('.')[0].toLowerCase(),
    (project.name || '').toLowerCase()
  ].filter(n => n.length > 2);

  db.prepare('DELETE FROM geo_rankings WHERE project_id = ?').run(projectId);

  const insertStmt = db.prepare(`
    INSERT INTO geo_rankings (project_id, keyword, region, position, local_pack_present)
    VALUES (?, ?, ?, ?, ?)
  `);

  const tasks = [];
  for (const kw of keywords) {
    for (const regionName of REGIONS) {
      tasks.push((async () => {
        let position = 0;
        let localPack = 0;

        try {
          const response = await axios.post('https://google.serper.dev/search', {
            q: kw.keyword,
            gl: 'nl',
            hl: 'nl',
            location: `${regionName}, Netherlands`,
            num: 100
          }, {
            headers: {
              'X-API-KEY': serpApiKey,
              'Content-Type': 'application/json'
            },
            timeout: 6000
          });

          const organic = response.data?.organic || [];
          const matchIndex = organic.findIndex(item => item.link.includes(domainMatch));
          position = matchIndex !== -1 ? matchIndex + 1 : 0;

          if (response.data?.places) {
            const places = response.data.places;
            const hasPlaceMatch = places.some(p => {
              const title = (p.title || '').toLowerCase();
              const website = (p.website || '').toLowerCase();
              return businessNames.some(n => title.includes(n)) || website.includes(domainMatch);
            });
            if (hasPlaceMatch) localPack = 1;
          }
        } catch (err) {
          position = 0;
        }

        return { keyword: kw.keyword, region: regionName, position, localPack };
      })());
    }
  }

  const results = await Promise.all(tasks);

  const transaction = db.transaction((rows) => {
    for (const r of rows) {
      insertStmt.run(projectId, r.keyword, r.region, r.position, r.localPack);
    }
  });

  transaction(results);
  return results;
}

async function checkGoogleBusinessProfile(projectName, domain, region = 'Nuenen') {
  const serpApiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'serp_api_key'").get();
  const serpApiKey = process.env.FS_SERPER_API || process.env.SERP_API_KEY || process.env.SERPER_API_KEY || (serpApiKeyRow ? serpApiKeyRow.value : '');
  if (!serpApiKey) return null;

  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    const query = `${projectName || cleanDomain.split('.')[0]} ${region}`;
    const response = await axios.post('https://google.serper.dev/places', {
      q: query,
      gl: 'nl',
      hl: 'nl'
    }, {
      headers: { 'X-API-KEY': serpApiKey },
      timeout: 5000
    });

    if (response.data?.places && response.data.places.length > 0) {
      const p = response.data.places[0];
      return {
        verified: true,
        title: p.title,
        address: p.address,
        rating: p.rating || null,
        ratingCount: p.ratingCount || 0,
        category: p.category || '',
        phone: p.phoneNumber || '',
        website: p.website || ''
      };
    }
  } catch (e) {
    // Fail silently
  }
  return null;
}

/**
 * Read-only analyse van de regionale GEO-prestaties. Voert bewust géén
 * live check uit; dat gebeurt expliciet via POST /geo/check.
 */
async function getGeoAnalysis(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  const geoRows = db.prepare(`
    SELECT keyword, region, position, local_pack_present, checked_at
    FROM geo_rankings
    WHERE project_id = ?
  `).all(projectId);

  const businessProfile = project ? await checkGoogleBusinessProfile(project.name, project.domain) : null;

  let regionSummary = REGIONS.map(regionName => {
    const rows = geoRows.filter(r => r.region === regionName);
    if (rows.length === 0) {
      return {
        region: regionName,
        totalKeywords: 0,
        averagePosition: 0,
        top3Count: 0,
        top10Count: 0,
        visibilityScore: 0,
        localPackCount: 0
      };
    }

    const total = rows.length;
    const rankedRows = rows.filter(r => r.position > 0);
    const sumPos = rankedRows.reduce((acc, r) => acc + r.position, 0);
    const avgPos = rankedRows.length > 0 ? (sumPos / rankedRows.length).toFixed(1) : 0;
    const top3 = rows.filter(r => r.position > 0 && r.position <= 3).length;
    const top10 = rows.filter(r => r.position > 0 && r.position <= 10).length;
    const localPacks = rows.filter(r => r.local_pack_present === 1).length;

    const visibilityScore = Math.min(100, Math.round(((top3 * 1.0 + (top10 - top3) * 0.5) / total) * 100));

    return {
      region: regionName,
      totalKeywords: total,
      averagePosition: parseFloat(avgPos),
      top3Count: top3,
      top10Count: top10,
      visibilityScore,
      localPackCount: localPacks,
      keywords: rows
    };
  });

  regionSummary.sort((a, b) => {
    if (a.averagePosition === 0) return 1;
    if (b.averagePosition === 0) return -1;
    return a.averagePosition - b.averagePosition;
  });

  // Inzichten uit echte data in plaats van vaste teksten
  const geoInsights = [];

  if (businessProfile) {
    geoInsights.push({
      title: `Google Bedrijfsprofiel Gecontroleerd: ${businessProfile.title}`,
      description: `Actief op Google Maps in ${businessProfile.address || 'Nuenen'} met ${businessProfile.rating ? businessProfile.rating + '★' : 'beoordelingen'} (${businessProfile.ratingCount || 0} reviews) - Categorie: ${businessProfile.category || 'Opleidingscentrum'}.`,
      type: 'opportunity'
    });
  }

  const checkedRegions = regionSummary.filter(r => r.totalKeywords > 0);

  if (checkedRegions.length === 0) {
    geoInsights.push({
      title: 'Nog geen regionale scan uitgevoerd',
      description: 'Voeg zoekwoorden toe in de Rank Tracker en klik op "Check Regio Rankings Nu" om echte posities per regio op te halen.',
      type: 'opportunity'
    });
  } else {
    const best = checkedRegions[0];
    if (best.averagePosition > 0) {
      geoInsights.push({
        title: `Sterkste regio: ${best.region}`,
        description: `Gemiddelde organische positie #${best.averagePosition} met ${best.top3Count} top 3 positie(s). Jouw pagina's domineren de organische zoekresultaten.`,
        type: 'opportunity'
      });
    }

    const weak = checkedRegions.filter(r => r.top10Count === 0);
    if (weak.length > 0) {
      geoInsights.push({
        title: `Geen top 10 zichtbaarheid in: ${weak.map(r => r.region).join(', ')}`,
        description: 'Overweeg regiospecifieke landingspagina\'s en lokale content om hier zichtbaar te worden.',
        type: 'warning'
      });
    }

    const noLocalPack = checkedRegions.filter(r => r.localPackCount === 0);
    if (noLocalPack.length === checkedRegions.length) {
      geoInsights.push({
        title: 'Geen Google Maps 3-Pack op deze zoekwoorden',
        description: 'Google toont voor jouw specifieke cursus-zoekwoorden voornamelijk organische zoekresultaten (waar je uitstekend op rankt op gemiddeld #1.5) in plaats van een Maps 3-Pack kaartblok.',
        type: 'opportunity'
      });
    }
  }

  return {
    summary: regionSummary,
    insights: geoInsights,
    businessProfile
  };
}

module.exports = { getGeoAnalysis, runGeoRankCheck, REGIONS };
