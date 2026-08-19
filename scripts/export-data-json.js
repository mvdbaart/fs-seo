const Database = require('better-sqlite3');
const fs = require('fs');

const dump = {};
const dbPath = './seo_database.db';

// We can extract data using row-by-row scans or reading valid tables
const tables = [
  'projects', 'competitors', 'crawl_sessions', 'crawled_pages', 'keywords',
  'keyword_rankings', 'pagespeed_audits', 'settings', 'geo_rankings',
  'users', 'recovery_codes', 'login_attempts', 'single_page_audits',
  'custom_topic_clusters', 'google_ads_campaigns', 'google_ads_groups',
  'google_ads_keywords', 'google_ads_copies', 'gbp_posts', 'google_ads_negatives',
  'indexing_logs', 'metric_snapshots'
];

// Open in readonly mode
let db;
try {
  db = new Database(dbPath, { readonly: true });
} catch (e) {
  console.error('Cannot open DB:', e.message);
  process.exit(1);
}

for (const t of tables) {
  try {
    const rows = db.prepare(`SELECT * FROM "${t}"`).all();
    dump[t] = rows;
    console.log(`Table ${t}: ${rows.length} rows`);
  } catch (e) {
    console.log(`Table ${t} failed: ${e.message}`);
    dump[t] = [];
  }
}

fs.writeFileSync('./scripts/data_dump.json', JSON.stringify(dump, null, 2));
console.log('Saved data_dump.json successfully!');
db.close();
