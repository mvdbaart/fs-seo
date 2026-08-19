const db = require('../server/db');

const uCodeRegex = /\b(u[0-9]{1,2}(?:-[0-9]{1,2})?|uo[0-9]{1,2}|u-codes?|ucodes?)\b/gi;

function cleanKeyword(kw) {
  if (!kw) return '';
  // Remove ucodes
  let cleaned = kw.replace(uCodeRegex, '');
  // Clean up punctuation leftovers like "- ", "( )", double spaces
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim();
  cleaned = cleaned.replace(/^[-–—:,/]\s*/, '').replace(/\s*[-–—:,/]$/, '').trim();
  return cleaned;
}

function run() {
  const rows = db.prepare('SELECT id, keyword, target_url, region, project_id, difficulty FROM keywords').all();
  console.log(`Total keywords before cleanup: ${rows.length}`);

  let deletedCount = 0;
  let updatedCount = 0;
  let mergedCount = 0;

  const existingKeywords = new Map();
  // Map of lowercase keyword -> id for deduping
  rows.forEach(r => {
    existingKeywords.set(r.keyword.toLowerCase().trim(), r.id);
  });

  const deleteStmt = db.prepare('DELETE FROM keywords WHERE id = ?');
  const updateStmt = db.prepare('UPDATE keywords SET keyword = ? WHERE id = ?');
  const updateRankingStmt = db.prepare('UPDATE keyword_rankings SET keyword_id = ? WHERE keyword_id = ?');

  const transaction = db.transaction(() => {
    for (const r of rows) {
      const original = r.keyword.trim();
      const cleaned = cleanKeyword(original);

      // 1. If keyword was only a ucode or becomes too short (< 2 chars), delete it
      if (!cleaned || cleaned.length < 2) {
        deleteStmt.run(r.id);
        deletedCount++;
        existingKeywords.delete(original.toLowerCase());
        continue;
      }

      // 2. If keyword was modified (had a ucode stripped)
      if (cleaned.toLowerCase() !== original.toLowerCase()) {
        const cleanedKey = cleaned.toLowerCase();
        const existingId = existingKeywords.get(cleanedKey);

        if (existingId && existingId !== r.id) {
          // Duplicate exists! Merge rankings into existingId and delete this row
          updateRankingStmt.run(existingId, r.id);
          deleteStmt.run(r.id);
          mergedCount++;
        } else {
          // Update to clean keyword
          updateStmt.run(cleaned, r.id);
          existingKeywords.delete(original.toLowerCase());
          existingKeywords.set(cleanedKey, r.id);
          updatedCount++;
        }
      }
    }
  });

  transaction();

  const totalRemaining = db.prepare('SELECT count(*) as c FROM keywords').get().c;
  console.log(`\n🎉 U-Code Cleanup Completed:`);
  console.log(` - Pure U-Codes deleted: ${deletedCount}`);
  console.log(` - U-Codes stripped from keywords: ${updatedCount}`);
  console.log(` - Duplicate keywords merged: ${mergedCount}`);
  console.log(` - Total keywords now in database: ${totalRemaining}`);
}

run();
