const db = require('../server/db');
const { calculateKeywordDifficulty } = require('../server/services/rankTracker');

function run() {
  const keywords = db.prepare('SELECT id, keyword, difficulty FROM keywords').all();
  console.log(`Processing ${keywords.length} keywords...`);

  let updatedKws = 0;
  const updateKwStmt = db.prepare('UPDATE keywords SET difficulty = ? WHERE id = ?');

  db.transaction(() => {
    for (const kw of keywords) {
      let kd = kw.difficulty;
      if (!kd || kd === null || kd === undefined || isNaN(kd) || kd === 0) {
        kd = calculateKeywordDifficulty(kw.keyword);
        updateKwStmt.run(kd, kw.id);
        updatedKws++;
      }
    }
  })();

  console.log(`Updated ${updatedKws} keywords that had null/0 difficulty.`);

  // Update all rankings to match
  const res = db.prepare(`
    UPDATE keyword_rankings 
    SET difficulty = (
      SELECT COALESCE(keywords.difficulty, 30) 
      FROM keywords 
      WHERE keywords.id = keyword_rankings.keyword_id
    )
    WHERE difficulty IS NULL OR difficulty = 0
  `).run();

  console.log(`Updated ${res.changes} ranking rows that had null/0 difficulty.`);

  const check = db.prepare(`
    SELECT 
      count(*) as total,
      sum(case when k.difficulty is null then 1 else 0 end) as null_k_diff,
      sum(case when r.difficulty is null then 1 else 0 end) as null_r_diff
    FROM keywords k
    LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
  `).get();

  console.log('\nFinal DB Status:');
  console.log(check);
}

run();
