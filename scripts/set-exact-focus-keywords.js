const db = require('../server/db');

const uCodeRegex = /\b(u[0-9]{1,2}[a-z]?(?:-[0-9]{1,2})?|uo[0-9]{1,2}|u-codes?|ucodes?)\b/gi;

function cleanKw(kw) {
  if (!kw) return '';
  let cleaned = kw.replace(uCodeRegex, '');
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim();
  cleaned = cleaned.replace(/^[-–—:,/]\s*/, '').replace(/\s*[-–—:,/]$/, '').trim();
  return cleaned;
}

function run() {
  // First clean any ucodes like u23e, u45e
  const allRows = db.prepare('SELECT id, keyword, region, difficulty FROM keywords WHERE project_id = 1').all();
  for (const r of allRows) {
    const cleaned = cleanKw(r.keyword);
    if (!cleaned || cleaned.length < 2) {
      db.prepare('DELETE FROM keyword_rankings WHERE keyword_id = ?').run(r.id);
      db.prepare('DELETE FROM keywords WHERE id = ?').run(r.id);
    } else if (cleaned !== r.keyword) {
      db.prepare('UPDATE keywords SET keyword = ? WHERE id = ?').run(cleaned, r.id);
    }
  }

  // Now select the top ~85 priority keywords
  const rows = db.prepare(`
    SELECT k.id, k.keyword, k.region, k.difficulty,
           COALESCE((SELECT position FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1), 0) as pos,
           COALESCE((SELECT search_volume FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1), 0) as vol
    FROM keywords k
    WHERE k.project_id = 1
  `).all();

  console.log(`Total keywords before tight focus filter: ${rows.length}`);

  // We score keywords to prioritize the best 85:
  // - Top rank position (pos > 0): +50 points
  // - Strategic region (Geldrop, Nuenen, Eindhoven, Helmond): +30 points
  // - Brabant: +20 points
  // - Priority core commercial keywords: +40 points
  // - Higher search volume: + vol / 100
  const scored = rows.map(r => {
    let score = 0;
    const kw = r.keyword.toLowerCase();
    const region = r.region || 'Nederland';

    if (r.pos > 0 && r.pos <= 10) score += 80;
    else if (r.pos > 10 && r.pos <= 30) score += 50;

    if (['Geldrop', 'Nuenen', 'Eindhoven', 'Helmond'].includes(region)) score += 35;
    else if (region === 'Brabant') score += 25;

    const topKeywords = [
      'certificeringsbeheer', 'hercertificering', 'code 95', 'nascholing',
      '3 daagse', '3.5 dag', 'soob', 'subsidie', 'e-learning',
      'heftruck', 'reachtruck', 'vca', 'vrachtwagen', 'rijbewijs c',
      'rijbewijs ce', 'chauffeur c', 'chauffeur ce', 'vacatures',
      'uitzendbureau', 'adr', 'bhv'
    ];

    topKeywords.forEach(tk => {
      if (kw.includes(tk)) score += 15;
    });

    // Penalize overly generic/weak terms
    if (kw.split(' ').length === 1 && !['certificeringsbeheer', 'heftruckcursus', 'vrachtwagenchauffeur'].includes(kw)) {
      score -= 30;
    }
    if (kw.includes('examen') && !kw.includes('vca') && !kw.includes('cbr')) {
      score -= 20;
    }

    return { ...r, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Keep top 85 unique keywords
  const kept = scored.slice(0, 85);
  const keptIds = new Set(kept.map(k => k.id));
  const deleteIds = scored.filter(k => !keptIds.has(k.id)).map(k => k.id);

  console.log(`Keeping top ${kept.length} focus keywords, deleting ${deleteIds.length} secondary terms.`);

  if (deleteIds.length > 0) {
    const delRank = db.prepare(`DELETE FROM keyword_rankings WHERE keyword_id IN (${deleteIds.map(() => '?').join(',')})`);
    const delKw = db.prepare(`DELETE FROM keywords WHERE id IN (${deleteIds.map(() => '?').join(',')})`);
    db.transaction(() => {
      delRank.run(...deleteIds);
      delKw.run(...deleteIds);
    })();
  }

  const finalCount = db.prepare('SELECT count(*) as c FROM keywords WHERE project_id = 1').get().c;
  console.log(`\n🎉 Final Focus Keywords Count: ${finalCount}`);

  const byRegion = {};
  const finalRows = db.prepare('SELECT id, keyword, region, difficulty FROM keywords WHERE project_id = 1').all();
  finalRows.forEach(r => { byRegion[r.region] = (byRegion[r.region] || 0) + 1; });
  console.log('Distribution by region:', byRegion);
}

run();
