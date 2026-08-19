const Database = require('better-sqlite3');
const db = new Database('./seo_database.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));
for (const t of tables) {
  try {
    const count = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get();
    console.log(` - ${t.name}: ${count.c} rows`);
  } catch (e) {
    console.log(` - ${t.name}: ERROR (${e.message})`);
  }
}
