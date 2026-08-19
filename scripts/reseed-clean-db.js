const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const backupPath = path.join(__dirname, '../seo_database.db.corrupt_backup');
const targetDbPath = path.join(__dirname, '../seo_database.db');

// Read from corrupt backup
const src = new Database(backupPath, { readonly: true });

// Remove target and let db.js initialize target cleanly
if (fs.existsSync(targetDbPath)) fs.unlinkSync(targetDbPath);
if (fs.existsSync(targetDbPath + '-shm')) fs.unlinkSync(targetDbPath + '-shm');
if (fs.existsSync(targetDbPath + '-wal')) fs.unlinkSync(targetDbPath + '-wal');

// Require db.js which creates all tables and indexes cleanly
const db = require('../server/db');

// Tables to copy
const tables = [
  'projects', 'competitors', 'crawl_sessions', 'crawled_pages', 'keywords',
  'keyword_rankings', 'pagespeed_audits', 'settings', 'geo_rankings',
  'users', 'sessions', 'recovery_codes', 'login_attempts', 'single_page_audits',
  'custom_topic_clusters', 'google_ads_campaigns', 'google_ads_groups',
  'google_ads_keywords', 'google_ads_copies', 'gbp_posts', 'google_ads_negatives',
  'indexing_logs', 'metric_snapshots'
];

for (const t of tables) {
  try {
    const rows = src.prepare(`SELECT * FROM "${t}"`).all();
    if (rows.length > 0) {
      const destCols = db.prepare(`PRAGMA table_info("${t}")`).all().map(c => c.name);
      const validRows = rows.map(row => {
        const clean = {};
        for (const col of destCols) {
          if (row[col] !== undefined) clean[col] = row[col];
        }
        return clean;
      });

      const keys = Object.keys(validRows[0]);
      const cols = keys.map(k => `"${k}"`).join(',');
      const placeholders = keys.map(() => '?').join(',');
      const insert = db.prepare(`INSERT OR IGNORE INTO "${t}" (${cols}) VALUES (${placeholders})`);
      const insertMany = db.transaction((items) => {
        for (const item of items) insert.run(...Object.values(item));
      });
      insertMany(validRows);
      console.log(`✅ Table ${t}: transferred ${rows.length} rows`);
    }
  } catch (e) {
    console.log(`ℹ️ Table ${t}: ${e.message}`);
  }
}

console.log('\nFinal DB Integrity Check:');
console.log(db.pragma('integrity_check'));

src.close();
