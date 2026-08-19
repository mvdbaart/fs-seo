const db = require('../server/db');

const res1 = db.prepare("DELETE FROM keyword_rankings WHERE keyword_id IN (SELECT id FROM keywords WHERE keyword LIKE '%multiservice%' OR keyword LIKE '%owner founder%')").run();
const res2 = db.prepare("DELETE FROM keywords WHERE keyword LIKE '%multiservice%' OR keyword LIKE '%owner founder%'").run();

console.log(`Deleted ${res2.changes} brand junk queries.`);
