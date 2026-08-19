const db = require('../server/db');

const rows = db.prepare(`
  SELECT 
    k.id, k.keyword, k.difficulty as k_diff,
    r.difficulty as r_diff,
    COALESCE(r.difficulty, k.difficulty) as final_diff,
    r.position, r.checked_at
  FROM keywords k
  LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
  WHERE k.project_id = 1
  LIMIT 20
`).all();

console.log('Sample rows:');
console.table(rows);

const nullKDiff = db.prepare('SELECT count(*) as c FROM keywords WHERE difficulty IS NULL').get().c;
const nullRDiff = db.prepare('SELECT count(*) as c FROM keyword_rankings WHERE difficulty IS NULL').get().c;
console.log('Keywords with NULL difficulty:', nullKDiff);
console.log('Rankings with NULL difficulty:', nullRDiff);
