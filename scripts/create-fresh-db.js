const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../seo_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');

// Require db.js will run initDb() and create every table & index correctly
const db = require('../server/db');

console.log('Integrity check on fresh DB:', db.pragma('integrity_check'));

// Create default project
const projInfo = db.prepare('INSERT INTO projects (name, domain) VALUES (?, ?)').run('FrisseStart', 'https://frissestart.nl');
const projectId = projInfo.lastInsertRowid;
console.log('Created project with ID:', projectId);

// Populate default settings
const defaultSettings = [
  ['business_name', 'FrisseStart'],
  ['business_address', 'De Tienden 26B, 5674 TB Nuenen'],
  ['business_phone', '+31408459091'],
  ['ga4_property_id', '403827651'],
  ['clarity_project_id', 'xofo8xpmob'],
  ['github_repo', 'FrisseStart/fs-next'],
  ['auto_check_enabled', '1'],
  ['auto_check_frequency', 'weekly'],
  ['report_email_recipients', 'frissestartbv@gmail.com'],
  ['google_ads_customer_id', '186-879-0470']
];

for (const [k, v] of defaultSettings) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(k, v);
}

// Add competitor for Places
db.prepare('INSERT INTO competitors (project_id, name, domain) VALUES (?, ?, ?)').run(
  projectId,
  'BLOM Opleidingen',
  'https://blomopleidingen.nl'
);

console.log('Seeded settings and default project.');
