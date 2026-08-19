const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const backupPath = path.join(__dirname, '../seo_database.db.corrupt_backup');
const cleanPath = path.join(__dirname, '../seo_database.db.clean');

if (fs.existsSync(cleanPath)) fs.unlinkSync(cleanPath);

const src = new Database(backupPath, { readonly: true });
const dest = new Database(cleanPath);

// Step 1: Let the official schema initialize the clean DB
dest.pragma('journal_mode = WAL');

// Define all tables cleanly
dest.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    ga4_property_id TEXT,
    ads_customer_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    place_id TEXT,
    place_match TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS crawl_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    start_url TEXT NOT NULL,
    pages_crawled INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS crawled_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    url TEXT NOT NULL,
    status_code INTEGER,
    title TEXT,
    title_length INTEGER,
    meta_description TEXT,
    meta_description_length INTEGER,
    h1 TEXT,
    h1_count INTEGER,
    h2_count INTEGER,
    canonical TEXT,
    robots TEXT,
    images_total INTEGER DEFAULT 0,
    images_missing_alt INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    keywords TEXT,
    links_internal_count INTEGER DEFAULT 0,
    links_external_count INTEGER DEFAULT 0,
    internal_links TEXT,
    broken_links TEXT,
    load_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES crawl_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    keyword TEXT NOT NULL,
    target_url TEXT,
    region TEXT DEFAULT 'Nederland',
    search_volume INTEGER DEFAULT 0,
    device TEXT DEFAULT 'desktop',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS keyword_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id INTEGER NOT NULL,
    rank INTEGER,
    found_url TEXT,
    page_title TEXT,
    meta_desc TEXT,
    organic_results TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pagespeed_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    url TEXT NOT NULL,
    device TEXT NOT NULL,
    performance_score INTEGER,
    fcp_ms INTEGER,
    lcp_ms INTEGER,
    cls REAL,
    tbt_ms INTEGER,
    speed_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS geo_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    keyword TEXT NOT NULL,
    city TEXT NOT NULL,
    rank INTEGER,
    found_url TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    totp_secret TEXT,
    enroll_token TEXT,
    enroll_expires_at INTEGER,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    ip TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recovery_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code_hash TEXT NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    ip TEXT,
    success INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS single_page_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    url TEXT NOT NULL,
    score INTEGER,
    status_code INTEGER,
    load_time_ms INTEGER,
    title TEXT,
    meta_description TEXT,
    issues_count INTEGER DEFAULT 0,
    full_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS custom_topic_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT NOT NULL,
    pillar_url TEXT NOT NULL,
    keywords TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS google_ads_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    budget_daily_eur REAL DEFAULT 15.0,
    target_locations TEXT DEFAULT 'Eindhoven, Geldrop, Helmond, Veldhoven, Nuenen',
    status TEXT DEFAULT 'PAUSED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS google_ads_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    landing_page_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES google_ads_campaigns(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS google_ads_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    match_type TEXT DEFAULT 'EXACT',
    cpc_bid_eur REAL DEFAULT 2.50,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES google_ads_groups(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS google_ads_copies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    headlines_json TEXT NOT NULL,
    descriptions_json TEXT NOT NULL,
    final_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES google_ads_groups(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gbp_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT,
    summary TEXT NOT NULL,
    topic_type TEXT DEFAULT 'STANDARD',
    cta_type TEXT DEFAULT 'LEARN_MORE',
    cta_url TEXT,
    media_url TEXT,
    status TEXT DEFAULT 'draft',
    google_post_id TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS google_ads_negatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    match_type TEXT DEFAULT 'PHRASE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES google_ads_campaigns(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS indexing_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    url TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    response_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS metric_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    extra TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, day, metric),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

// Step 2: Copy rows from each table
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
      // Filter keys to only those columns present in destination table
      const destCols = dest.prepare(`PRAGMA table_info("${t}")`).all().map(c => c.name);
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
      const insert = dest.prepare(`INSERT OR IGNORE INTO "${t}" (${cols}) VALUES (${placeholders})`);
      const insertMany = dest.transaction((items) => {
        for (const item of items) insert.run(...Object.values(item));
      });
      insertMany(validRows);
    }
    console.log(`✅ Table ${t}: copied ${rows.length} rows`);
  } catch (e) {
    console.error(`⚠️ Table ${t} query error: ${e.message}`);
  }
}

console.log('\nIntegrity check on clean DB:');
console.log(dest.pragma('integrity_check'));

src.close();
dest.close();
