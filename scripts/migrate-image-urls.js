const fs = require('fs');
const path = require('path');

// 1. Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    }
  });
}

const { createClient } = require('../node_modules/@supabase/supabase-js');
const db = require('../server/db');

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
const OLD_DOMAIN = 'https://nfyoovfqylsqdrbebpkg.supabase.co';
const NEW_DOMAIN = 'https://proxy.frissestart.nl';

console.log('====================================================');
console.log(`MODE: ${isDryRun ? 'DRY-RUN (Geen wijzigingen opgeslagen)' : 'APPLY (Wijzigingen worden doorgevoerd!)'}`);
console.log(`Migratie: ${OLD_DOMAIN} -> ${NEW_DOMAIN}`);
console.log('====================================================\n');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || NEW_DOMAIN;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('ERORR: Supabase key is niet ingesteld in .env.local!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function replaceUrlsInValue(val) {
  if (!val) return { updated: false, val };
  
  if (typeof val === 'string') {
    if (val.includes(OLD_DOMAIN)) {
      const newVal = val.split(OLD_DOMAIN).join(NEW_DOMAIN);
      return { updated: true, val: newVal };
    }
    return { updated: false, val };
  }

  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val);
    if (jsonStr.includes(OLD_DOMAIN)) {
      const newJsonStr = jsonStr.split(OLD_DOMAIN).join(NEW_DOMAIN);
      return { updated: true, val: JSON.parse(newJsonStr) };
    }
    return { updated: false, val };
  }

  return { updated: false, val };
}

async function migrateSupabaseTable(tableName, idColumn, targetColumns) {
  console.log(`\n>>> Controleren van Supabase tabel: '${tableName}'...`);
  const { data, error } = await supabase.from(tableName).select('*');
  
  if (error) {
    console.error(`  Fout bij ophalen van tabel '${tableName}':`, error.message);
    return 0;
  }

  if (!data || data.length === 0) {
    console.log(`  Geen data in tabel '${tableName}'.`);
    return 0;
  }

  let totalUpdatedRows = 0;

  for (const row of data) {
    const updates = {};
    let rowNeedsUpdate = false;

    for (const col of targetColumns) {
      if (row[col] !== undefined && row[col] !== null) {
        const { updated, val } = replaceUrlsInValue(row[col]);
        if (updated) {
          updates[col] = val;
          rowNeedsUpdate = true;
          console.log(`  [${tableName} ID:${row[idColumn] || row.id}] Kolom '${col}' wordt bijgewerkt.`);
        }
      }
    }

    if (rowNeedsUpdate) {
      totalUpdatedRows++;
      if (!isDryRun) {
        const primaryKeyCol = idColumn || 'id';
        const { error: updateError } = await supabase
          .from(tableName)
          .update(updates)
          .eq(primaryKeyCol, row[primaryKeyCol]);

        if (updateError) {
          console.error(`  Fout bij updaten van rij ${row[primaryKeyCol]} in ${tableName}:`, updateError.message);
        } else {
          console.log(`  -> Succesvol geüpdatet in database.`);
        }
      }
    }
  }

  console.log(`Tabel '${tableName}': ${totalUpdatedRows} rijen ${isDryRun ? 'te updaten' : 'geüpdatet'}.`);
  return totalUpdatedRows;
}

async function migrateSqlite() {
  console.log('\n>>> Controleren van lokale SQLite database (seo_database.db)...');
  const rows = db.prepare(`SELECT * FROM single_page_audits WHERE full_data LIKE '%${OLD_DOMAIN}%'`).all();
  
  console.log(`  Gevonden in SQLite table 'single_page_audits': ${rows.length} rijen.`);
  
  if (rows.length > 0 && !isDryRun) {
    const updateStmt = db.prepare(`UPDATE single_page_audits SET full_data = REPLACE(full_data, ?, ?) WHERE id = ?`);
    let updatedCount = 0;
    for (const row of rows) {
      updateStmt.run(OLD_DOMAIN, NEW_DOMAIN, row.id);
      updatedCount++;
    }
    console.log(`  -> ${updatedCount} rijen in SQLite succesvol geüpdatet.`);
  }
  return rows.length;
}

async function main() {
  let totalCount = 0;
  
  totalCount += await migrateSupabaseTable('course_categories', 'id', ['image_url', 'gallery_images']);
  totalCount += await migrateSupabaseTable('blog_posts', 'id', ['featured_image', 'content', 'content_markdown']);
  totalCount += await migrateSupabaseTable('marketing_content_items', 'id', ['featured_image', 'content_text', 'media_refs']);
  totalCount += await migrateSupabaseTable('site_settings', 'key', ['value']);

  totalCount += await migrateSqlite();

  console.log('\n====================================================');
  console.log(`SAMENVATTING: Totaal ${totalCount} records ${isDryRun ? 'geïdentificeerd voor migratie.' : 'succesvol gemigreerd!'}`);
  if (isDryRun) {
    console.log('Voer uit met `--apply` om de wijzigingen definitief door te voeren.');
  }
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Migratiefout:', err);
  process.exit(1);
});
