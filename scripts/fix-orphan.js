const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const src = new Database('./seo_database.db');
try {
  src.pragma('writable_schema = ON');
  src.exec("DELETE FROM sqlite_master WHERE type='index' AND name LIKE '%mvdbaart%'");
  src.pragma('writable_schema = OFF');
  console.log('Orphan index deleted!');
  console.log('Integrity check:', src.pragma('integrity_check'));
} catch (e) {
  console.error('Error fixing orphan index:', e.message);
}
src.close();
