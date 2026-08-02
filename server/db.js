const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../seo_database.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
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
}

initDb();

module.exports = db;
