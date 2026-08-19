const db = require('../server/db');
const gscClient = require('../server/services/gscClient');
const supabase = require('../server/services/supabaseService');
const { getSerpApiKey } = require('../server/services/rankTracker');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

function calculateKD(keyword, organicSnapshot = [], serpFeatures = []) {
  const kw = (keyword || '').toLowerCase().trim();
  const words = kw.split(/\s+/).filter(Boolean);
  
  let kd = 50;
  if (words.length === 1) kd = 75;
  else if (words.length === 2) kd = 55;
  else if (words.length === 3) kd = 38;
  else if (words.length === 4) kd = 26;
  else kd = 18; // Long tail (5+ words)

  const localTerms = ['geldrop', 'nuenen', 'eindhoven', 'helmond', 'veldhoven', 'best', 'valkenswaard', 'brabant', 'regio', 'zuidoost-brabant'];
  const hasLocal = localTerms.some(term => kw.includes(term));
  if (hasLocal) {
    kd -= 12;
  }

  const actionTerms = ['hercertificering', '1 uur', 'halen', 'cursus', 'opleiding', 'nascholing', 'kosten', 'korting', 'soob', 'subsidie', 'planner', 'spoed', 'behalen', 'vacatures', 'aanmelden'];
  if (actionTerms.some(term => kw.includes(term))) {
    kd -= 6;
  }

  const highCompTerms = ['vacatures', 'rijbewijs', 'vca', 'heftruck', 'vrachtwagen', 'uitzendbureau'];
  if (words.length <= 2 && highCompTerms.some(term => kw.includes(term)) && !hasLocal) {
    kd += 15;
  }

  if (organicSnapshot && organicSnapshot.length > 0) {
    const highAuthDomains = [
      'cbr.nl', 'rijksoverheid.nl', 'belastingdienst.nl', 'kvk.nl', 
      'anwb.nl', 'wikipedia.org', 'indeed.com', 'nationaleberoepengids.nl',
      'werk.nl', 'randstad.nl', 'tempo-team.nl'
    ];
    let authCount = 0;
    organicSnapshot.slice(0, 10).forEach(item => {
      const link = (item.link || '').toLowerCase();
      if (highAuthDomains.some(d => link.includes(d))) {
        authCount++;
      }
    });
    kd += authCount * 4;
  }

  if (serpFeatures && serpFeatures.includes('featured_snippet')) {
    kd += 5;
  }
  if (serpFeatures && serpFeatures.includes('local_pack') && hasLocal) {
    kd -= 5;
  }

  return Math.max(5, Math.min(95, Math.round(kd)));
}

function inferRegion(keyword) {
  const kw = (keyword || '').toLowerCase();
  if (kw.includes('geldrop')) return 'Geldrop';
  if (kw.includes('nuenen')) return 'Nuenen';
  if (kw.includes('eindhoven')) return 'Eindhoven';
  if (kw.includes('helmond')) return 'Helmond';
  if (kw.includes('veldhoven')) return 'Veldhoven';
  if (kw.includes('best')) return 'Best';
  if (kw.includes('valkenswaard')) return 'Valkenswaard';
  if (kw.includes('brabant')) return 'Brabant';
  return 'Nederland';
}

async function collectAllKeywords() {
  const keywordMap = new Map();

  function addKeyword(kw, targetUrl, region, source = 'manual', searchVolume = 0, initialPos = 0) {
    if (!kw || typeof kw !== 'string') return;
    const cleanKw = kw.trim().toLowerCase();
    if (cleanKw.length < 2) return;

    const detectedRegion = region || inferRegion(cleanKw);
    const existing = keywordMap.get(cleanKw);
    if (!existing) {
      keywordMap.set(cleanKw, {
        keyword: cleanKw,
        target_url: targetUrl || 'https://frissestart.nl',
        region: detectedRegion,
        source,
        search_volume: searchVolume,
        initial_position: initialPos
      });
    } else {
      if (!existing.target_url && targetUrl) existing.target_url = targetUrl;
      if (searchVolume > existing.search_volume) existing.search_volume = searchVolume;
      if (initialPos > 0 && (!existing.initial_position || existing.initial_position === 0)) {
        existing.initial_position = initialPos;
      }
    }
  }

  // 1. Core High-Intent & Curated Target Longtails from MEMORY.md and candidates
  console.log('[1/4] Adding Curated High-Value & Longtail Keywords...');
  const curatedKeywords = [
    { kw: 'certificeringsbeheer', url: 'https://frissestart.nl/opleidingen/certificeringsbeheer', vol: 4800 },
    { kw: 'certificeringsbeheer transport logistiek', url: 'https://frissestart.nl/opleidingen/certificeringsbeheer', vol: 3200 },
    { kw: 'certificering chauffeurs bijhouden', url: 'https://frissestart.nl/opleidingen/certificeringsbeheer', vol: 1500 },
    { kw: 'code 95 hercertificering 1 uur', url: 'https://frissestart.nl/opleidingen/1-uurs-hercertificering', vol: 2900, pos: 1 },
    { kw: '1 uurs hercertificering chauffeurs', url: 'https://frissestart.nl/opleidingen/1-uurs-hercertificering', vol: 1800 },
    { kw: 'snelle hercertificering code 95', url: 'https://frissestart.nl/opleidingen/1-uurs-hercertificering', vol: 1200 },
    { kw: 'code 95 certificering 3 dagen', url: 'https://frissestart.nl/3-daagse-code-95-korting', vol: 4100, pos: 7 },
    { kw: 'code 95 in 3.5 dag behalen', url: 'https://frissestart.nl/3-daagse-code-95-opleiding-korting', vol: 2500, pos: 10 },
    { kw: '3 daagse code 95 met soob subsidie', url: 'https://frissestart.nl/3-daagse-code-95-korting', vol: 2200 },
    { kw: 'e-learning code 95 combineren', url: 'https://frissestart.nl/code95-planner', vol: 3600 },
    { kw: 'code 95 nascholing nuenen', url: 'https://frissestart.nl/code-95-eindhoven', vol: 3800, pos: 1 },
    { kw: 'code 95 eindhoven', url: 'https://frissestart.nl/code-95-eindhoven', vol: 4100, pos: 3 },
    { kw: 'code 95 geldrop', url: 'https://frissestart.nl/code-95-eindhoven', vol: 1900 },
    { kw: 'code 95 helmond', url: 'https://frissestart.nl/code-95-eindhoven', vol: 2400 },
    { kw: 'nascholing chauffeurs geldrop', url: 'https://frissestart.nl/', vol: 1900, pos: 3 },
    { kw: 'nascholing chauffeurs nuenen', url: 'https://frissestart.nl/', vol: 1400 },
    { kw: 'nascholing code 95 zaterdag cursus', url: 'https://frissestart.nl/code-95-eindhoven', vol: 2100 },
    { kw: 'heftruckcertificaat halen eindhoven', url: 'https://frissestart.nl/heftruck-cursus', vol: 2950 },
    { kw: 'heftruckcursus geldrop', url: 'https://frissestart.nl/heftruck-cursus', vol: 1600 },
    { kw: 'heftruck hercertificering 1 uur', url: 'https://frissestart.nl/heftruck-cursus', vol: 1400 },
    { kw: 'heftruckcertificaat 1 dag helmond', url: 'https://frissestart.nl/heftruck-cursus', vol: 1800 },
    { kw: 'reachtruck cursus eindhoven', url: 'https://frissestart.nl/opleidingen', vol: 1900 },
    { kw: 'vca behalen regio geldrop', url: 'https://frissestart.nl/vca-cursus', vol: 1800 },
    { kw: 'vca cursus nuenen', url: 'https://frissestart.nl/vca-cursus', vol: 1200 },
    { kw: 'vca basis cursus eindhoven', url: 'https://frissestart.nl/vca-cursus', vol: 2600 },
    { kw: 'vca vol certificaat helmond', url: 'https://frissestart.nl/vca-cursus', vol: 1950 },
    { kw: 'vrachtwagen rijbewijs c eindhoven', url: 'https://frissestart.nl/opleidingen', vol: 3100 },
    { kw: 'vrachtwagen rijbewijs ce geldrop', url: 'https://frissestart.nl/opleidingen', vol: 2200 },
    { kw: 'vrachtwagenchauffeur vacatures brabant', url: 'https://frissestart.nl/vacatures', vol: 6100 },
    { kw: 'vrachtwagenchauffeur vacatures eindhoven', url: 'https://frissestart.nl/vacatures', vol: 4400 },
    { kw: 'transport uitzendbureau nuenen', url: 'https://frissestart.nl/vacatures', vol: 2200, pos: 6 },
    { kw: 'uitzendbureau transport eindhoven', url: 'https://frissestart.nl/transport-logistiek', vol: 5400 },
    { kw: 'chauffeur c ce vacatures regio eindhoven', url: 'https://frissestart.nl/vacatures', vol: 3300 },
    { kw: 'logistiek medewerker vacatures geldrop', url: 'https://frissestart.nl/vacatures', vol: 1800 },
    { kw: 'adr certificaat basis en tank brabant', url: 'https://frissestart.nl/opleidingen', vol: 2100 },
    { kw: 'soob subsidie transport opleidingen', url: 'https://frissestart.nl/subsidies', vol: 2800 },
    { kw: 'soob subsidie vrachtwagen rijbewijs', url: 'https://frissestart.nl/subsidies', vol: 2400 }
  ];

  curatedKeywords.forEach(k => {
    addKeyword(k.kw, k.url, inferRegion(k.kw), 'curated', k.vol || 0, k.pos || 0);
  });

  // 2. Fetch Supabase Course Categories & Variants
  console.log('[2/4] Fetching Courses from Supabase...');
  try {
    const courses = await supabase.fetchCourseCategoriesFromSupabase();
    console.log(` > Fetched ${courses.length} course categories from Supabase`);
    const regionalSuffixes = ['eindhoven', 'geldrop', 'nuenen', 'helmond', 'brabant'];

    courses.forEach(cat => {
      if (cat.keyword) {
        addKeyword(cat.keyword, cat.targetUrl, inferRegion(cat.keyword), 'supabase_course');
        // generate local variants for key courses
        regionalSuffixes.forEach(reg => {
          addKeyword(`${cat.keyword} ${reg}`, cat.targetUrl, inferRegion(reg), 'supabase_course_longtail');
        });
      }
      if (cat.categoryKeyword && cat.categoryKeyword !== cat.keyword) {
        addKeyword(cat.categoryKeyword, cat.targetUrl, inferRegion(cat.categoryKeyword), 'supabase_course');
      }
      if (cat.variants && Array.isArray(cat.variants)) {
        cat.variants.forEach(v => {
          if (v.keyword) {
            addKeyword(v.keyword, v.seoUrl || cat.targetUrl, inferRegion(v.keyword), 'supabase_variant');
          }
          if (v.title) {
            addKeyword(v.title.toLowerCase(), v.seoUrl || cat.targetUrl, inferRegion(v.title), 'supabase_variant');
          }
        });
      }
    });
  } catch (err) {
    console.warn(' > Could not fetch Supabase courses:', err.message);
  }

  // 3. Fetch Real GSC queries (Search Console API)
  console.log('[3/4] Fetching Real Queries from Google Search Console...');
  try {
    if (gscClient.isConfigured()) {
      const siteUrl = await gscClient.resolveSiteUrl('frissestart.nl');
      if (siteUrl) {
        const today = new Date();
        const end = new Date(today.setDate(today.getDate() - 3)).toISOString().split('T')[0];
        const start = new Date(today.setDate(today.getDate() - 90)).toISOString().split('T')[0];
        const rows = await gscClient.querySearchAnalytics(siteUrl, {
          startDate: start,
          endDate: end,
          dimensions: ['query', 'page'],
          rowLimit: 500
        });
        console.log(` > Fetched ${rows.length} rows from Google Search Console`);
        rows.forEach(r => {
          const query = (r.keys[0] || '').trim();
          const page = r.keys[1] || 'https://frissestart.nl';
          const pos = Math.round(r.position || 0);
          addKeyword(query, page, inferRegion(query), 'gsc', r.impressions || 0, pos);
        });
      }
    }
  } catch (err) {
    console.warn(' > GSC query failed:', err.message);
  }

  // 4. Crawled Pages Focus Keywords
  console.log('[4/4] Fetching Focus Keywords from Crawled Pages...');
  try {
    const pages = db.prepare('SELECT url, keywords, title FROM crawled_pages WHERE keywords IS NOT NULL AND keywords != "" LIMIT 100').all();
    pages.forEach(p => {
      const kwList = (p.keywords || '').split(',').map(s => s.trim());
      kwList.forEach(k => {
        if (k.length > 2) {
          addKeyword(k, p.url, inferRegion(k), 'crawled_page');
        }
      });
    });
  } catch (err) {
    console.warn(' > Crawled pages keywords query skipped:', err.message);
  }

  const allKeywords = Array.from(keywordMap.values());
  console.log(`\n==> Total aggregated keywords & long-tails: ${allKeywords.length}`);
  return allKeywords;
}

async function run() {
  const projectId = 1;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    console.error('Project ID 1 niet gevonden!');
    return;
  }
  const targetDomain = project.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  const keywords = await collectAllKeywords();
  const serpApiKey = getSerpApiKey();
  console.log(`SERP API Key present: ${Boolean(serpApiKey)}`);

  // Ensure table columns exist
  try { db.exec('ALTER TABLE keywords ADD COLUMN difficulty INTEGER'); } catch(e){}
  try { db.exec('ALTER TABLE keyword_rankings ADD COLUMN difficulty INTEGER'); } catch(e){}

  const insertKwStmt = db.prepare(`
    INSERT INTO keywords (project_id, keyword, target_url, region, language, difficulty)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertRankStmt = db.prepare(`
    INSERT INTO keyword_rankings (keyword_id, position, previous_position, search_volume, serp_features, url_found, organic_results, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // We will insert all keywords into DB
  console.log('\nInserting keywords into SQLite database...');
  const insertedKeywords = [];
  
  const insertTransaction = db.transaction((kwList) => {
    for (const item of kwList) {
      const kd = calculateKD(item.keyword);
      const res = insertKwStmt.run(
        projectId,
        item.keyword,
        item.target_url,
        item.region || 'Nederland',
        'nl',
        kd
      );
      const kwId = res.lastInsertRowid;
      insertedKeywords.push({
        id: kwId,
        ...item,
        difficulty: kd
      });
    }
  });

  insertTransaction(keywords);
  console.log(`Inserted ${insertedKeywords.length} keywords into database!`);

  // Now, check live Google.nl rankings for the top keywords via Serper.dev
  // To avoid hitting API rate limits or excessive quota, check priority keywords first
  console.log('\nChecking live Google.nl rankings via Serper API for key search terms...');
  let checkedCount = 0;
  let topRankedCount = 0;

  for (let i = 0; i < insertedKeywords.length; i++) {
    const kw = insertedKeywords[i];
    
    // We check high value / GSC / curated keywords live (or top 40 keywords)
    const isPriority = kw.source === 'curated' || kw.source === 'gsc' || i < 35;
    
    if (serpApiKey && isPriority) {
      try {
        console.log(`[${i+1}/${insertedKeywords.length}] Checking Google.nl for "${kw.keyword}" (${kw.region})...`);
        const response = await axios.post('https://google.serper.dev/search', {
          q: kw.keyword,
          gl: 'nl',
          hl: 'nl',
          location: kw.region && kw.region !== 'Nederland' ? `${kw.region}, Netherlands` : 'Netherlands',
          num: 50
        }, {
          headers: {
            'X-API-KEY': serpApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 6000
        });

        const organic = response.data?.organic || [];
        const organicSnapshot = organic.slice(0, 20).map((item, idx) => ({
          position: idx + 1,
          link: item.link,
          title: item.title || ''
        }));

        let position = 0;
        let foundUrl = '';
        const serpFeatures = ['organic'];

        const matchIndex = organic.findIndex(item => item.link.includes(targetDomain));
        if (matchIndex !== -1) {
          position = matchIndex + 1;
          foundUrl = organic[matchIndex].link;
          topRankedCount++;
        }

        if (response.data?.answerBox) serpFeatures.push('featured_snippet');
        if (response.data?.places) serpFeatures.push('local_pack');
        if (response.data?.images) serpFeatures.push('image_pack');

        // Recalculate precise KD with live SERP data
        const preciseKD = calculateKD(kw.keyword, organicSnapshot, serpFeatures);

        // Update keyword table difficulty
        db.prepare('UPDATE keywords SET difficulty = ? WHERE id = ?').run(preciseKD, kw.id);

        insertRankStmt.run(
          kw.id,
          position,
          kw.initial_position > 0 ? kw.initial_position : position,
          kw.search_volume || null,
          JSON.stringify(serpFeatures),
          foundUrl,
          JSON.stringify(organicSnapshot),
          preciseKD
        );

        checkedCount++;
        // Small delay to be polite with rate limit
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.warn(`SERP error for "${kw.keyword}":`, err.message);
        // Fallback ranking entry
        insertRankStmt.run(
          kw.id,
          kw.initial_position || 0,
          kw.initial_position || 0,
          kw.search_volume || null,
          JSON.stringify(['organic']),
          kw.target_url,
          JSON.stringify([]),
          kw.difficulty
        );
      }
    } else {
      // Set initial ranking entry from known GSC data or default
      insertRankStmt.run(
        kw.id,
        kw.initial_position || 0,
        kw.initial_position || 0,
        kw.search_volume || null,
        JSON.stringify(['organic']),
        kw.initial_position > 0 ? kw.target_url : '',
        JSON.stringify([]),
        kw.difficulty
      );
    }
  }

  console.log(`\n🎉 DONE!`);
  console.log(`Total keywords restored: ${insertedKeywords.length}`);
  console.log(`Live SERP checked: ${checkedCount}`);
  console.log(`Rankings in Top 50: ${topRankedCount}`);
}

run().catch(console.error);
