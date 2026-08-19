const db = require('../server/db');
const { calculateKeywordDifficulty } = require('../server/services/rankTracker');

// Regex for CCV/CBR course module codes:
// Matches U01, U05, U14, U23, U39, U45, U45E, U23E, W01, W02, W02E, W03, W05, V01, etc.
const moduleCodeRegex = /\b([uUwWvVkKtT][0-9]{1,3}[a-zA-Z]?(?:-[0-9]{1,2})?|uo[0-9]{1,2}|wo[0-9]{1,2}|u-codes?|w-codes?|ucodes?|wcodes?)\b/gi;

function cleanModuleCodes(kw) {
  if (!kw) return '';
  // Remove module codes like W02E, U05, etc.
  let cleaned = kw.replace(moduleCodeRegex, '');
  // Clean double spaces, hyphens, colons
  cleaned = cleaned.replace(/[-–—]\s*[-–—]/g, '-');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^[-–—:,/]\s*/, '').replace(/\s*[-–—:,/]$/, '').trim();
  return cleaned;
}

function run() {
  const rows = db.prepare('SELECT id, keyword, region, difficulty FROM keywords WHERE project_id = 1').all();
  console.log(`Scanning ${rows.length} keywords for module codes (W02E, U05, etc.)...\n`);

  let modifiedCount = 0;
  let deletedCount = 0;
  let mergedCount = 0;

  const existingMap = new Map();
  rows.forEach(r => existingMap.set(r.keyword.toLowerCase().trim(), r.id));

  const updateStmt = db.prepare('UPDATE keywords SET keyword = ?, difficulty = ? WHERE id = ?');
  const deleteStmt = db.prepare('DELETE FROM keywords WHERE id = ?');
  const deleteRankingsStmt = db.prepare('DELETE FROM keyword_rankings WHERE keyword_id = ?');
  const mergeRankingsStmt = db.prepare('UPDATE keyword_rankings SET keyword_id = ? WHERE keyword_id = ?');

  db.transaction(() => {
    for (const r of rows) {
      const original = r.keyword.trim();
      const cleaned = cleanModuleCodes(original);

      // If keyword was only a module code or becomes empty
      if (!cleaned || cleaned.length < 2) {
        console.log(`[DELETE] Pure module code: "${original}"`);
        deleteRankingsStmt.run(r.id);
        deleteStmt.run(r.id);
        deletedCount++;
        existingMap.delete(original.toLowerCase());
        continue;
      }

      // If modified
      if (cleaned.toLowerCase() !== original.toLowerCase()) {
        const cleanedKey = cleaned.toLowerCase();
        const existingId = existingMap.get(cleanedKey);

        if (existingId && existingId !== r.id) {
          console.log(`[MERGE] "${original}" -> "${cleaned}" (matches existing id: ${existingId})`);
          mergeRankingsStmt.run(existingId, r.id);
          deleteStmt.run(r.id);
          mergedCount++;
        } else {
          const kd = calculateKeywordDifficulty(cleaned);
          updateStmt.run(cleaned, kd, r.id);
          console.log(`[CLEAN] "${original}" -> "${cleaned}" (KD: ${kd})`);
          existingMap.delete(original.toLowerCase());
          existingMap.set(cleanedKey, r.id);
          modifiedCount++;
        }
      }
    }
  })();

  const totalRemaining = db.prepare('SELECT count(*) as c FROM keywords WHERE project_id = 1').get().c;
  console.log(`\n🎉 Module Code Cleanup Finished!`);
  console.log(` - Pure module codes deleted: ${deletedCount}`);
  console.log(` - Module codes stripped from keywords: ${modifiedCount}`);
  console.log(` - Duplicates merged: ${mergedCount}`);
  console.log(` - Total clean focus keywords in DB: ${totalRemaining}`);

  console.log('\nSample Clean Keywords:');
  const sample = db.prepare('SELECT id, keyword, region, difficulty FROM keywords WHERE project_id = 1 LIMIT 20').all();
  console.table(sample);
}

run();
