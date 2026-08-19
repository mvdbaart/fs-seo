const db = require('../server/db');
const { calculateKeywordDifficulty } = require('../server/services/rankTracker');

function cleanKeyword(kw) {
  if (!kw) return '';
  let cleaned = kw;
  // Strip parentheses and their contents like (code 95), (intern), (e-learning), (1 uur)
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '');
  // Strip ucodes
  cleaned = cleaned.replace(/\b(u[0-9]{1,2}[a-z]?(?:-[0-9]{1,2})?|uo[0-9]{1,2}|u-codes?|ucodes?)\b/gi, '');
  // Clean double dashes, spaces
  cleaned = cleaned.replace(/[-–—]\s*[-–—]/g, '-');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^[-–—:,/]\s*/, '').replace(/\s*[-–—:,/]$/, '').trim();
  return cleaned;
}

function run() {
  const rows = db.prepare('SELECT id, keyword, region, difficulty FROM keywords WHERE project_id = 1').all();
  console.log(`Processing ${rows.length} keywords...`);

  let updatedCount = 0;
  const updateStmt = db.prepare('UPDATE keywords SET keyword = ?, difficulty = ? WHERE id = ?');

  db.transaction(() => {
    for (const r of rows) {
      const cleaned = cleanKeyword(r.keyword);
      if (cleaned && cleaned !== r.keyword) {
        const kd = calculateKeywordDifficulty(cleaned);
        updateStmt.run(cleaned, kd, r.id);
        console.log(`Cleaned: "${r.keyword}" -> "${cleaned}" (KD: ${kd})`);
        updatedCount++;
      }
    }
  })();

  console.log(`\n🎉 Finished! Cleaned ${updatedCount} keywords.`);
}

run();
