const db = require('../server/db');

function isCoreFocusKeyword(keyword, region) {
  const kw = (keyword || '').toLowerCase().trim();
  
  // High value core terms
  const corePillars = [
    'certificeringsbeheer',
    'hercertificering',
    'code 95',
    'nascholing',
    '3 daagse',
    '3.5 dag',
    'soob',
    'subsidie',
    'e-learning',
    'heftruck',
    'reachtruck',
    'vca',
    'vrachtwagen',
    'rijbewijs c',
    'rijbewijs ce',
    'chauffeur c',
    'chauffeur ce',
    'vacatures',
    'uitzendbureau',
    'logistiek medewerker',
    'adr',
    'bhv',
    'veiligheid'
  ];

  // Specific junk to definitely remove
  const junkPatterns = [
    /^[0-9\s+*^/%€=,.:-]+$/, // math equations like "95+20", "3×95", "0.95^20"
    /^[\d]+$/, // pure numbers
    /multiservicefrissestart/i,
    /cobelfret/i,
    /beeztees/i,
    /dalfsen/i,
    /emmeloord/i,
    /heerenveen/i,
    /friesland/i,
    /zeeland/i,
    /amsterdam/i,
    /rotterdam/i,
    /utrecht/i,
    /buschauffeur/i,
    /bobcat/i,
    /burgerschap/i,
    /bursar/i,
    /begin land tachograaf/i,
    /1 minuut regeling/i,
    /30 seconden regeling/i
  ];

  for (const p of junkPatterns) {
    if (p.test(kw)) return false;
  }

  // Must match at least one core pillar
  const matchesPillar = corePillars.some(pillar => kw.includes(pillar));
  if (!matchesPillar) return false;

  // Words count check
  const words = kw.split(/\s+/).filter(Boolean);
  if (words.length === 1 && !['certificeringsbeheer', 'heftruckcertificaat', 'vrachtwagenchauffeur'].includes(kw)) {
    return false; // Remove single generic words like "bedrijven", "chauffeur", "95"
  }

  return true;
}

function run() {
  const rows = db.prepare(`
    SELECT k.id, k.keyword, k.region, k.difficulty,
           (SELECT position FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1) as pos,
           (SELECT search_volume FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1) as vol
    FROM keywords k
    WHERE k.project_id = 1
  `).all();

  console.log(`Total keywords currently: ${rows.length}`);

  const toKeep = [];
  const toDelete = [];

  for (const r of rows) {
    // Keep if ranked in top 20 or if it is a core commercial focus term
    const isRankedTop20 = r.pos > 0 && r.pos <= 20;
    const isCore = isCoreFocusKeyword(r.keyword, r.region);

    if (isRankedTop20 || isCore) {
      toKeep.push(r);
    } else {
      toDelete.push(r.id);
    }
  }

  console.log(`Keywords to keep: ${toKeep.length}`);
  console.log(`Keywords to delete: ${toDelete.length}`);

  if (toDelete.length > 0) {
    const deleteRankings = db.prepare(`DELETE FROM keyword_rankings WHERE keyword_id IN (${toDelete.map(() => '?').join(',')})`);
    const deleteKeywords = db.prepare(`DELETE FROM keywords WHERE id IN (${toDelete.map(() => '?').join(',')})`);

    db.transaction(() => {
      deleteRankings.run(...toDelete);
      deleteKeywords.run(...toDelete);
    })();
  }

  const remaining = db.prepare('SELECT count(*) as c FROM keywords WHERE project_id = 1').get().c;
  console.log(`\n🎉 Successfully pruned to ${remaining} high-value focus keywords!`);

  console.log('\nTop 20 Samples of Remaining Focus Keywords:');
  const samples = db.prepare('SELECT id, keyword, region, difficulty FROM keywords WHERE project_id = 1 LIMIT 20').all();
  console.table(samples);
}

run();
