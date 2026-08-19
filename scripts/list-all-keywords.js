const db = require('../server/db');
const rows = db.prepare('SELECT id, keyword, region, difficulty FROM keywords WHERE project_id = 1').all();
rows.forEach((r, i) => {
  console.log(`${(i+1).toString().padStart(2, ' ')}. [ID: ${r.id}] ${r.keyword} (${r.region}) - KD: ${r.difficulty}`);
});
