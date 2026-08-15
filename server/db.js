const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbPath = path.join(__dirname, '../seo_database.db');

if (process.env.VERCEL) {
  const tmpPath = path.join('/tmp', 'seo_database.db');
  let shouldCopy = false;
  if (fs.existsSync(dbPath)) {
    if (!fs.existsSync(tmpPath)) {
      shouldCopy = true;
    } else {
      const bundledStat = fs.statSync(dbPath);
      const tmpStat = fs.statSync(tmpPath);
      // If bundled db is newer than tmp db, copy it.
      if (bundledStat.mtimeMs > tmpStat.mtimeMs) {
        shouldCopy = true;
      }
    }
  }
  
  if (shouldCopy) {
    try {
      fs.copyFileSync(dbPath, tmpPath);
    } catch (err) {
      console.error('[db] Error copying db to /tmp:', err.message);
    }
  }
  dbPath = tmpPath;
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDb() {
  db.exec(`
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
      language TEXT DEFAULT 'nl',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS keyword_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword_id INTEGER,
      position INTEGER,
      previous_position INTEGER,
      search_volume INTEGER DEFAULT 0,
      serp_features TEXT,
      url_found TEXT,
      organic_results TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS geo_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      keyword TEXT NOT NULL,
      region TEXT NOT NULL,
      position INTEGER,
      local_pack_present INTEGER DEFAULT 0,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pagespeed_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      url TEXT NOT NULL,
      strategy TEXT DEFAULT 'mobile',
      performance_score INTEGER,
      accessibility_score INTEGER,
      seo_score INTEGER,
      best_practices_score INTEGER,
      lcp TEXT,
      cls TEXT,
      inp TEXT,
      fcp TEXT,
      diagnostics TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Authentication. Timestamps in these four tables are epoch milliseconds
    -- (INTEGER), deliberately unlike the DATETIME columns elsewhere: SQLite's
    -- CURRENT_TIMESTAMP has no timezone suffix and Date.parse() reads it as
    -- local time, which silently breaks the throttle and expiry comparisons.
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      totp_secret TEXT,
      totp_confirmed_at INTEGER,
      last_totp_step INTEGER,
      enroll_token TEXT,
      enroll_expires_at INTEGER,
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      user_agent TEXT,
      ip TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_users_enroll_token ON users(enroll_token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_email ON login_attempts(email, created_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_ip ON login_attempts(ip, created_at);

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
      final_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES google_ads_groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS google_ads_negatives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      match_type TEXT DEFAULT 'PHRASE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES google_ads_campaigns(id) ON DELETE CASCADE
    );

    -- Dagelijkse metriek-snapshots per bron. Nodig omdat GSC zelf maar 16 maanden
    -- historie bewaart en de GA4/GSC-caches in-memory zijn: zonder deze tabel
    -- verdwijnt elke trend bij een herstart.
    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      metric TEXT NOT NULL,
      day TEXT NOT NULL,
      value REAL,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_snapshots_key
      ON metric_snapshots(project_id, source, metric, day);

    CREATE INDEX IF NOT EXISTS idx_metric_snapshots_lookup
      ON metric_snapshots(project_id, source, metric, day DESC);
  `);


  // Ensure column keywords exists in crawled_pages if table was created previously
  try {
    db.exec('ALTER TABLE crawled_pages ADD COLUMN keywords TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE crawled_pages ADD COLUMN internal_links TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE keyword_rankings ADD COLUMN organic_results TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE projects ADD COLUMN ga4_property_id TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE projects ADD COLUMN ads_customer_id TEXT');
  } catch (e) {
    // Column already exists
  }
}

initDb();

module.exports = db;
