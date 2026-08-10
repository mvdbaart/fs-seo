const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const db = require('./db');
const Crawler = require('./crawler');
const { runPageSpeedAudit } = require('./services/pagespeed');
const { checkKeywordRankings, checkSingleKeyword, getSerpApiKey } = require('./services/rankTracker');
const { generateSeoRecommendations } = require('./services/aiAdvisor');
const { getGeoAnalysis, runGeoRankCheck } = require('./services/geoAnalyzer');
const { analyzeSinglePage } = require('./services/pageAnalyzer');
const { analyzeGscData } = require('./services/gscAnalyzer');
const { 
  getLocalPackAudit, 
  getSchemaAudit, 
  getInternalLinkMatrix, 
  getCompetitorGapAnalysis 
} = require('./services/seoToolsService');
const { getTopicClusters } = require('./services/pillarClusterService');
const { isBrandKeyword } = require('./utils/brandFilter');
const { publishUrl, getUrlStatus } = require('./services/googleIndexingService');
const { 
  isSupabaseConfigured, 
  syncSeoMetadataToSupabase, 
  pushBlogPostToSupabase, 
  fetchCourseCategoriesFromSupabase 
} = require('./services/supabaseService');
const { generateAiContent } = require('./services/aiGenerator');
const authRouter = require('./auth/routes');
const { requireAuth } = require('./auth/middleware');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Needed behind a reverse proxy, otherwise req.ip is the proxy for everyone and
// the per-IP login throttle would treat the whole team as one client.
app.set('trust proxy', 1);

// CORS is off by default. Previously `app.use(cors())` sent
// Access-Control-Allow-Origin: * , which let any website on the internet read
// GET /api/settings — including the Serper, PageSpeed and GitHub keys. In both
// dev and production the browser only ever talks to its own origin (the Vite
// proxy is a server-to-server hop the browser never sees), so nothing needs it.
if (process.env.FS_SEO_CORS_ORIGINS) {
  const allowed = process.env.FS_SEO_CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({ origin: allowed, credentials: true })); // explicit list, never `true`
}

// ----------------------------------------------------
// Authentication
//
// Order is load-bearing: Express matches in declaration order, so the gate must
// sit above the ~60 routes below. Mounting the public auth router on its own
// prefix first avoids needing a skip-list (a skip-list is how you ship a hole:
// a typo, a trailing slash, or a new public route nobody remembers to add).
// ----------------------------------------------------
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);

// ----------------------------------------------------
// Google Indexing API Endpoints
// ----------------------------------------------------
app.post('/api/indexing/publish', async (req, res) => {
  try {
    const { url, type = 'URL_UPDATED' } = req.body;
    if (!url) return res.status(400).json({ error: 'Geen URL opgegeven' });
    const result = await publishUrl(url, type);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/indexing/status', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Geen URL opgegeven' });
    const result = await getUrlStatus(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Supabase Sync Endpoints
// ----------------------------------------------------
app.get('/api/supabase/status', (req, res) => {
  res.json({ configured: isSupabaseConfigured() });
});

app.post('/api/supabase/sync', async (req, res) => {
  try {
    const { pageUrl, keyword, title, metaDescription, aiPrompt, status } = req.body;
    const result = await syncSeoMetadataToSupabase({ pageUrl, keyword, title, metaDescription, aiPrompt, status });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/supabase/push-blog', async (req, res) => {
  try {
    const { title, slug, metaDescription, content, targetKeywords, status = 'draft' } = req.body;
    const result = await pushBlogPostToSupabase({ title, slug, metaDescription, content, targetKeywords, status });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/supabase/courses', async (req, res) => {
  try {
    const courses = await fetchCourseCategoriesFromSupabase();
    res.json({ success: true, count: courses.length, courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/supabase/import-course-keywords', async (req, res) => {
  try {
    const { projectId = 1 } = req.body;
    const courses = await fetchCourseCategoriesFromSupabase();
    const insertStmt = db.prepare('INSERT OR IGNORE INTO keywords (project_id, keyword, target_url, region, language) VALUES (?, ?, ?, ?, ?)');
    
    let imported = 0;
    const transaction = db.transaction((list) => {
      for (const item of list) {
        if (item.keyword && item.targetUrl) {
          insertStmt.run(projectId, item.keyword, item.targetUrl, 'Geldrop, Netherlands', 'nl');
          imported++;
        }
        if (item.variants && item.variants.length > 0) {
          for (const v of item.variants) {
            if (v.keyword && v.seoUrl) {
              insertStmt.run(projectId, v.keyword, v.seoUrl, 'Geldrop, Netherlands', 'nl');
              imported++;
            }
          }
        }
      }
    });
    transaction(courses);

    res.json({ success: true, imported, totalCategories: courses.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Direct AI Generation Endpoints
// ----------------------------------------------------
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { promptText, provider = 'auto', style = 'default' } = req.body;
    if (!promptText) return res.status(400).json({ error: 'Geen prompttekst opgegeven' });
    const result = await generateAiContent({ promptText, provider, style });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// fs-next Live Integration Endpoints
// ----------------------------------------------------

// Haal alle SEO-routes + keywords op uit het fs-next project (Next.js API)
app.get('/api/fs-next/sitemap-urls', async (req, res) => {
  try {
    const fsNextUrl = process.env.FS_NEXT_URL || 'http://localhost:3000';
    const token = req.headers.authorization || '';
    const response = await require('axios').get(`${fsNextUrl}/api/admin/seo-sitemap-urls`, {
      headers: { Authorization: token },
      timeout: 5000
    });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ 
      error: 'fs-next is niet bereikbaar. Start het fs-next project eerst op poort 3000.',
      details: err.message 
    });
  }
});

// Live Google.nl ranking check via fs-next API (gebruikt FS_SERPER_API van fs-next .env.local)
app.get('/api/fs-next/live-rankings', async (req, res) => {
  try {
    const fsNextUrl = process.env.FS_NEXT_URL || 'http://localhost:3000';
    const token = req.headers.authorization || '';
    const location = req.query.location || 'Geldrop, Netherlands';
    const response = await require('axios').get(
      `${fsNextUrl}/api/admin/seo-rankings?location=${encodeURIComponent(location)}`,
      { headers: { Authorization: token }, timeout: 60000 }
    );
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ 
      error: 'fs-next is niet bereikbaar of gebruiker is niet ingelogd.',
      details: err.message 
    });
  }
});

// Importeer keywords van fs-next sitemap direct naar de SQLite rank tracker
app.post('/api/fs-next/import-sitemap-keywords', async (req, res) => {
  try {
    const { projectId = 1 } = req.body;
    const fsNextUrl = process.env.FS_NEXT_URL || 'http://localhost:3000';
    const token = req.headers.authorization || '';

    const sitemapRes = await require('axios').get(`${fsNextUrl}/api/admin/seo-sitemap-urls`, {
      headers: { Authorization: token },
      timeout: 5000
    });

    const payload = sitemapRes.data.rankTrackerPayload || [];
    const insertStmt = db.prepare('INSERT OR IGNORE INTO keywords (project_id, keyword, target_url, region, language) VALUES (?, ?, ?, ?, ?)');
    
    let imported = 0;
    const transaction = db.transaction((list) => {
      for (const item of list) {
        insertStmt.run(projectId, item.keyword, item.targetUrl, item.region, item.language || 'nl');
        imported++;
      }
    });
    transaction(payload);

    res.json({ success: true, imported, total: payload.length });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ----------------------------------------------------
// GitHub & Remote Vercel Connector Endpoints
// ----------------------------------------------------
const githubConnector = require('./services/githubConnector');

app.get('/api/github/status', async (req, res) => {
  try {
    const status = await githubConnector.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/github/fetch-sitemap', async (req, res) => {
  try {
    const data = await githubConnector.fetchSitemapFromGithub();
    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/github/commit-fix', async (req, res) => {
  try {
    const { filePath, commitMessage, fileContent } = req.body;
    const result = await githubConnector.pushSeoFixToGithub({ filePath, commitMessage, fileContent });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ----------------------------------------------------
// Advanced SEO Tools Endpoints (Local Pack, Schema, Links, Gap)
// ----------------------------------------------------
app.get('/api/projects/:id/local-pack', (req, res) => {
  try {
    const data = getLocalPackAudit(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id/schema-audit', async (req, res) => {
  try {
    const data = await getSchemaAudit(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Google Business Profile (My Business) API Endpoint
// ----------------------------------------------------
const { getGbpAnalysis } = require('./services/gbpService');

app.get('/api/projects/:id/gbp', async (req, res) => {
  try {
    const data = await getGbpAnalysis(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen Google Bedrijfsprofiel data: ' + err.message });
  }
});

app.get('/api/projects/:id/internal-links', (req, res) => {
  try {
    const data = getInternalLinkMatrix(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id/competitor-gap', (req, res) => {
  try {
    const data = getCompetitorGapAnalysis(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id/topic-clusters', (req, res) => {
  try {
    const data = getTopicClusters(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/:id/topic-clusters', (req, res) => {
  try {
    const projectId = req.params.id;
    const { title, pillarUrl, keywords } = req.body;
    if (!title || !pillarUrl) {
      return res.status(400).json({ error: 'Titel en Pillar URL zijn verplicht.' });
    }
    const result = db.prepare(`
      INSERT INTO custom_topic_clusters (project_id, title, pillar_url, keywords)
      VALUES (?, ?, ?, ?)
    `).run(projectId, title, pillarUrl, keywords || '');

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/topic-clusters/:clusterId', (req, res) => {
  try {
    db.prepare('DELETE FROM custom_topic_clusters WHERE id = ?').run(req.params.clusterId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// GA4 & Microsoft Clarity Analytics Endpoints
// ----------------------------------------------------
const { getGa4ClarityAnalytics } = require('./services/ga4ClarityService');

app.get('/api/projects/:id/ga4-clarity', async (req, res) => {
  try {
    const data = await getGa4ClarityAnalytics(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen GA4/Clarity data: ' + err.message });
  }
});
app.get('/api/projects/:id/gsc', async (req, res) => {
  try {
    const data = await analyzeGscData(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen GSC data: ' + err.message });
  }
});

app.post('/api/projects/:id/gsc/import-keywords', async (req, res) => {
  try {
    const projectId = req.params.id;
    const gscData = await analyzeGscData(projectId);

    const allGscKeywords = [...gscData.ctrOpportunities, ...gscData.strikingDistance];
    const insertStmt = db.prepare('INSERT OR IGNORE INTO keywords (project_id, keyword, target_url, region) VALUES (?, ?, ?, ?)');

    const knownRegions = ['Geldrop', 'Nuenen', 'Eindhoven', 'Helmond', 'Utrecht', 'Amsterdam', 'Rotterdam'];
    const transaction = db.transaction((list) => {
      for (const item of list) {
        const matched = knownRegions.find(r => item.keyword.toLowerCase().includes(r.toLowerCase()));
        insertStmt.run(projectId, item.keyword, item.targetUrl, matched || 'Nederland');
      }
    });

    transaction(allGscKeywords);
    await checkKeywordRankings(projectId);

    res.json({ success: true, importedCount: allGscKeywords.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Single Page Doctor & AI Prompt Generator
// ----------------------------------------------------
app.post('/api/analyze-page', async (req, res) => {
  try {
    const { url, projectId = 1 } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is verplicht' });

    const auditResult = await analyzeSinglePage(url);

    // Save to database history
    try {
      db.prepare(`
        INSERT INTO single_page_audits (
          project_id, url, score, status_code, load_time_ms, title, meta_description, issues_count, full_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        auditResult.url,
        auditResult.score,
        auditResult.statusCode,
        auditResult.loadTimeMs,
        auditResult.metrics.title,
        auditResult.metrics.metaDescription,
        auditResult.issues.length,
        JSON.stringify(auditResult)
      );
    } catch (dbErr) {
      console.error('Fout bij opslaan Single Page Audit in DB:', dbErr.message);
    }

    res.json(auditResult);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij analyseren pagina: ' + err.message });
  }
});

app.get('/api/single-page-audits', (req, res) => {
  try {
    const projectId = req.query.projectId || 1;
    const rows = db.prepare(`
      SELECT id, project_id, url, score, status_code, load_time_ms, title, meta_description, issues_count, full_data, created_at
      FROM single_page_audits
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(projectId);

    const parsed = rows.map(r => ({
      ...r,
      full_data: r.full_data ? JSON.parse(r.full_data) : null
    }));

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AI Content Generator & Title Optimizer Endpoints
// ----------------------------------------------------
const { generateTitleMetaVariations, generateContentBrief, generateFaqJsonLd } = require('./services/contentGenerator');

app.post('/api/content-generator/brief', async (req, res) => {
  try {
    const { url, keyword, originalTitle, originalMeta, domain } = req.body;
    const titleMeta = generateTitleMetaVariations(originalTitle, originalMeta, keyword, domain);
    const brief = await generateContentBrief(url, keyword);
    const faqSchema = generateFaqJsonLd(brief.suggestedStructure.recommendedFaqs);

    res.json({
      ...titleMeta,
      brief,
      faqSchema
    });
  } catch (err) {
    res.status(500).json({ error: 'Fout bij genereren content briefing: ' + err.message });
  }
});

// ----------------------------------------------------
// Multi-Domain / Project Endpoints
// ----------------------------------------------------
app.get('/api/projects', (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', (req, res) => {
  try {
    const { name, domain } = req.body;
    if (!name || !domain) {
      return res.status(400).json({ error: 'Naam en domein zijn verplicht' });
    }

    const cleanDomain = domain.startsWith('http') ? domain : `https://${domain}`;
    const info = db.prepare('INSERT INTO projects (name, domain) VALUES (?, ?)').run(name, cleanDomain);
    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid);

    runGeoRankCheck(info.lastInsertRowid).catch(err => console.error('GEO check bij project-aanmaak mislukt:', err.message));

    res.json(newProject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', (req, res) => {
  try {
    const projectId = req.params.id;

    const deleteProject = db.transaction(() => {
      db.prepare('DELETE FROM keywords WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM crawl_sessions WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM pagespeed_audits WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM geo_rankings WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM competitors WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    });

    deleteProject();
    res.json({ success: true, deletedId: projectId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Competitor tracking endpoints
app.get('/api/projects/:id/competitors', (req, res) => {
  try {
    const competitors = db.prepare('SELECT * FROM competitors WHERE project_id = ?').all(req.params.id);
    res.json(competitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/:id/competitors', (req, res) => {
  try {
    const { name, domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domein is verplicht' });

    const cleanDomain = domain.startsWith('http') ? domain : `https://${domain}`;
    const info = db.prepare('INSERT INTO competitors (project_id, name, domain) VALUES (?, ?, ?)').run(req.params.id, name || domain, cleanDomain);
    
    res.json({ id: info.lastInsertRowid, project_id: req.params.id, name: name || domain, domain: cleanDomain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/competitors/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM competitors WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard summary data
app.get('/api/projects/:id/dashboard', async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project niet gevonden' });

    const competitors = db.prepare('SELECT * FROM competitors WHERE project_id = ?').all(projectId);

    const lastSession = db.prepare('SELECT * FROM crawl_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);
    
    let crawlStats = { pagesCrawled: 0, errorsCount: 0, missingTitles: 0, missingMeta: 0, missingH1: 0 };
    if (lastSession) {
      const pages = db.prepare('SELECT * FROM crawled_pages WHERE session_id = ?').all(lastSession.id);
      crawlStats = {
        pagesCrawled: pages.length,
        errorsCount: pages.filter(p => p.status_code >= 400).length,
        missingTitles: pages.filter(p => !p.title || p.title.trim() === '').length,
        missingMeta: pages.filter(p => !p.meta_description || p.meta_description.trim() === '').length,
        missingH1: pages.filter(p => p.h1_count === 0).length,
        sessionId: lastSession.id,
        createdAt: lastSession.created_at
      };
    }

    const keywords = db.prepare(`
      SELECT k.id, k.keyword, k.target_url, k.region, r.position, r.previous_position
      FROM keywords k
      LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
      WHERE k.project_id = ?
      AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
    `).all(projectId);

    const rankStats = {
      totalKeywords: keywords.length,
      top3: keywords.filter(k => k.position > 0 && k.position <= 3).length,
      top10: keywords.filter(k => k.position > 0 && k.position <= 10).length,
      improved: keywords.filter(k => k.position > 0 && k.position < k.previous_position).length,
      declined: keywords.filter(k => k.position > 0 && k.position > k.previous_position).length
    };

    const lastAudit = db.prepare('SELECT * FROM pagespeed_audits WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);
    const geoData = await getGeoAnalysis(projectId);
    const recommendations = generateSeoRecommendations(projectId);

    res.json({
      project,
      competitors,
      crawlStats,
      rankStats,
      keywords,
      pageSpeed: lastAudit || null,
      geoData,
      recommendations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GEO Analysis Endpoint
app.get('/api/projects/:id/geo', async (req, res) => {
  try {
    const geoData = await getGeoAnalysis(req.params.id);
    res.json(geoData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/:id/geo/check', async (req, res) => {
  try {
    const projectId = req.params.id;
    await runGeoRankCheck(projectId);
    const updatedGeoData = await getGeoAnalysis(projectId);
    res.json(updatedGeoData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Crawler Endpoints (Screaming Frog replacement)
// ----------------------------------------------------
app.get('/api/projects/:id/crawl/latest', (req, res) => {
  try {
    const projectId = req.params.id;
    const lastSession = db.prepare('SELECT * FROM crawl_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);
    
    if (!lastSession) {
      return res.json({ session: null, pages: [] });
    }

    const pages = db.prepare('SELECT * FROM crawled_pages WHERE session_id = ? ORDER BY id ASC').all(lastSession.id);
    res.json({ session: lastSession, pages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/crawl', async (req, res) => {
  try {
    const { projectId, startUrl, maxPages = 25 } = req.body;
    if (!startUrl) {
      return res.status(400).json({ error: 'Start URL is verplicht' });
    }

    const formattedUrl = startUrl.startsWith('http') ? startUrl : `https://${startUrl}`;

    const sessionInfo = db.prepare('INSERT INTO crawl_sessions (project_id, start_url, status) VALUES (?, ?, ?)').run(projectId, formattedUrl, 'in_progress');
    const sessionId = sessionInfo.lastInsertRowid;

    const crawler = new Crawler(formattedUrl, parseInt(maxPages, 10));
    const crawlResult = await crawler.run();

    const insertPageStmt = db.prepare(`
      INSERT INTO crawled_pages (
        session_id, url, status_code, title, title_length, meta_description, meta_description_length,
        h1, h1_count, h2_count, canonical, robots, images_total, images_missing_alt, word_count,
        keywords, links_internal_count, links_external_count, internal_links, broken_links, load_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let errorCount = 0;
    const insertTransaction = db.transaction((pages) => {
      for (const page of pages) {
        if (page.status_code >= 400) errorCount++;
        insertPageStmt.run(
          sessionId, page.url, page.status_code, page.title, page.title_length,
          page.meta_description, page.meta_description_length, page.h1, page.h1_count,
          page.h2_count, page.canonical, page.robots, page.images_total, page.images_missing_alt,
          page.word_count, page.keywords || '', page.links_internal_count, page.links_external_count,
          JSON.stringify(page.internalLinks || []), page.broken_links, page.load_time_ms
        );
      }
    });

    insertTransaction(crawlResult.pages);

    db.prepare('UPDATE crawl_sessions SET pages_crawled = ?, errors_count = ?, status = ? WHERE id = ?')
      .run(crawlResult.pagesCrawled, errorCount, 'completed', sessionId);

    res.json({
      sessionId,
      pagesCrawled: crawlResult.pagesCrawled,
      errorsCount: errorCount,
      durationMs: crawlResult.duration_ms
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/crawl/sessions/:id', (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = db.prepare('SELECT * FROM crawl_sessions WHERE id = ?').get(sessionId);
    if (!session) return res.status(404).json({ error: 'Sessie niet gevonden' });

    const pages = db.prepare('SELECT * FROM crawled_pages WHERE session_id = ? ORDER BY id ASC').all(sessionId);
    res.json({ session, pages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Keyword Rank Tracker Endpoints
// ----------------------------------------------------
app.get('/api/keywords', async (req, res) => {
  try {
    const projectId = req.query.projectId || 1;
    const keywords = db.prepare(`
      SELECT 
        k.id, k.keyword, k.target_url, k.region, k.language, k.created_at,
        r.position, r.previous_position, r.search_volume, r.serp_features, r.url_found, r.checked_at
      FROM keywords k
      LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
      WHERE k.project_id = ?
      AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
      ORDER BY k.id DESC
    `).all(projectId);

    const { getGscKeywordMetrics } = require('./services/gscAnalyzer');
    const gscMetrics = await getGscKeywordMetrics(projectId);

    const parsedKeywords = keywords.map(kw => {
      const kwClean = kw.keyword ? kw.keyword.toLowerCase().trim() : '';
      let gscData = gscMetrics.map[kwClean] || null;

      // Fallback: match if all core words of keyword appear in a GSC query
      if (!gscData && kwClean) {
        const words = kwClean.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          for (const [query, data] of Object.entries(gscMetrics.map)) {
            if (words.every(w => query.includes(w))) {
              gscData = data;
              break;
            }
          }
        }
      }

      const impressions = gscData ? gscData.impressions : 0;
      const clicks = gscData ? gscData.clicks : 0;
      const ctr = gscData ? gscData.ctr : null;
      const trend = gscData ? gscData.trend : 0;

      return {
        ...kw,
        impressions,
        clicks,
        ctr,
        trend,
        gsc_connected: gscMetrics.gscConnected,
        search_volume: kw.search_volume && kw.search_volume > 0 ? kw.search_volume : impressions,
        serp_features: kw.serp_features ? JSON.parse(kw.serp_features) : []
      };
    });

    res.json(parsedKeywords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keywords', async (req, res) => {
  try {
    const { projectId = 1, keyword, targetUrl, region = 'Nederland', language = 'nl' } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Zoekwoord is verplicht' });

    const info = db.prepare('INSERT INTO keywords (project_id, keyword, target_url, region, language) VALUES (?, ?, ?, ?, ?)').run(projectId, keyword, targetUrl, region, language);
    const keywordId = info.lastInsertRowid;

    // Direct een echte live check uitvoeren; zonder API key blijft de positie
    // "nog niet gecheckt" (null) in plaats van een verzonnen waarde.
    let liveResult = null;
    const serpApiKey = getSerpApiKey();
    if (serpApiKey) {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
      const targetDomain = project ? project.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '';
      liveResult = await checkSingleKeyword({ id: keywordId, keyword, region }, targetDomain, serpApiKey);
    }

    res.json({
      id: keywordId,
      keyword,
      target_url: targetUrl,
      region,
      language,
      position: liveResult ? liveResult.position : null,
      checked: Boolean(liveResult)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ranking-geschiedenis van één zoekwoord (alle checks, oudste eerst)
app.get('/api/keywords/:id/history', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT position, previous_position, url_found, checked_at
      FROM keyword_rankings
      WHERE keyword_id = ?
      ORDER BY checked_at ASC
    `).all(req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dagelijkse aggregaten voor het hele project: laatste positie per keyword per dag
app.get('/api/projects/:id/rankings-history', (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const rows = db.prepare(`
      WITH daily AS (
        SELECT
          r.keyword_id,
          date(r.checked_at) AS day,
          r.position,
          ROW_NUMBER() OVER (PARTITION BY r.keyword_id, date(r.checked_at) ORDER BY r.checked_at DESC) AS rn
        FROM keyword_rankings r
        JOIN keywords k ON k.id = r.keyword_id
        WHERE k.project_id = ?
        AND date(r.checked_at) >= date('now', ?)
      )
      SELECT
        day,
        COUNT(*) AS totalKeywords,
        SUM(CASE WHEN position BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS top3,
        SUM(CASE WHEN position BETWEEN 1 AND 10 THEN 1 ELSE 0 END) AS top10,
        ROUND(AVG(CASE WHEN position > 0 THEN position END), 1) AS avgPosition
      FROM daily
      WHERE rn = 1
      GROUP BY day
      ORDER BY day ASC
    `).all(req.params.id, `-${days} days`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/keywords/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM keywords WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verwijder alle merknaam zoekwoorden in bulk voor een project
app.post('/api/keywords/delete-brand', (req, res) => {
  try {
    const { projectId = 1 } = req.body;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project niet gevonden' });

    const businessNameRow = db.prepare("SELECT value FROM settings WHERE key = 'business_name'").get();
    const businessName = businessNameRow ? businessNameRow.value : project.name;

    const allKeywords = db.prepare('SELECT id, keyword FROM keywords WHERE project_id = ?').all(projectId);
    const brandIds = allKeywords
      .filter(k => isBrandKeyword(k.keyword, project.domain, businessName))
      .map(k => k.id);

    if (brandIds.length > 0) {
      const deleteStmt = db.prepare(`DELETE FROM keywords WHERE id IN (${brandIds.map(() => '?').join(',')})`);
      deleteStmt.run(...brandIds);
    }

    res.json({ success: true, deletedCount: brandIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keywords/check-rankings', async (req, res) => {
  try {
    const { projectId = 1 } = req.body;
    const updatedRankings = await checkKeywordRankings(projectId);
    res.json({ success: true, updatedCount: updatedRankings.length, rankings: updatedRankings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PageSpeed Insights Endpoints
// ----------------------------------------------------
app.post('/api/pagespeed', async (req, res) => {
  try {
    const { projectId = 1, url, strategy = 'mobile' } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is verplicht' });

    const auditData = await runPageSpeedAudit(url, strategy);

    db.prepare(`
      INSERT INTO pagespeed_audits (
        project_id, url, strategy, performance_score, accessibility_score, seo_score,
        best_practices_score, lcp, cls, inp, fcp, diagnostics
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, auditData.url, auditData.strategy, auditData.performance_score,
      auditData.accessibility_score, auditData.seo_score, auditData.best_practices_score,
      auditData.lcp, auditData.cls, auditData.inp, auditData.fcp, auditData.diagnostics
    );

    res.json({ ...auditData, diagnostics: JSON.parse(auditData.diagnostics) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pagespeed', (req, res) => {
  try {
    const projectId = req.query.projectId || 1;
    const audits = db.prepare('SELECT * FROM pagespeed_audits WHERE project_id = ? ORDER BY created_at DESC LIMIT 10').all(projectId);
    
    const parsedAudits = audits.map(a => ({
      ...a,
      diagnostics: a.diagnostics ? JSON.parse(a.diagnostics) : []
    }));

    res.json(parsedAudits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Settings Endpoints
// ----------------------------------------------------
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    settings.forEach(s => settingsObj[s.key] = s.value);
    
    const envPagespeedKey = process.env.FS_SEO_PAGESPEED_API || process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY;
    if (envPagespeedKey && !settingsObj.pagespeed_api_key) {
      settingsObj.pagespeed_api_key = envPagespeedKey;
    }
    const envSerpKey = process.env.FS_SERPER_API || process.env.SERP_API_KEY || process.env.SERPER_API_KEY;
    if (envSerpKey && !settingsObj.serp_api_key) {
      settingsObj.serp_api_key = envSerpKey;
    }

    // Nooit de service account JSON zelf naar de client sturen; alleen de status.
    settingsObj.gsc_connected = require('./services/gscClient').isConfigured();
    delete settingsObj.gsc_service_account_json;

    res.json(settingsObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alleen deze keys mogen via de API geschreven worden. Zonder whitelist kan een
// client willekeurige rijen in de settings-tabel zetten of overschrijven.
const ALLOWED_SETTING_KEYS = new Set([
  'pagespeed_api_key',
  'serp_api_key',
  'business_name',
  'business_address',
  'business_phone',
  'ga4_property_id',
  'clarity_project_id',
  'github_token',
  'github_repo',
  'remote_fs_next_url',
  'auto_check_enabled',
  'auto_check_frequency',
  'report_email_recipients',
  'gsc_service_account_json'
]);

app.post('/api/settings', (req, res) => {
  try {
    const settingsObj = req.body;
    const unknown = Object.keys(settingsObj).filter(k => !ALLOWED_SETTING_KEYS.has(k));
    if (unknown.length > 0) {
      // Weigeren in plaats van negeren, zodat een typefout in de UI zichtbaar is.
      return res.status(400).json({ error: `Onbekende instelling(en): ${unknown.join(', ')}` });
    }

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    const transaction = db.transaction((obj) => {
      for (const [key, value] of Object.entries(obj)) {
        stmt.run(key, String(value));
      }
    });

    transaction(settingsObj);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Resend E-mail Integration & Test Route
// ----------------------------------------------------
const { sendReportEmail, buildReportHtml } = require('./services/emailService');

app.post('/api/reports/send-email', async (req, res) => {
  try {
    const { projectId = 1, to } = req.body;
    const recipients = to || db.prepare("SELECT value FROM settings WHERE key = 'report_email_recipients'").get()?.value;

    if (!recipients) {
      return res.status(400).json({ error: 'Geen e-mailadres opgegeven. Vul een e-mailadres in bij de instellingen of geef deze mee.' });
    }

    // Get dashboard data for project
    const dashRes = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!dashRes) return res.status(404).json({ error: 'Project niet gevonden' });

    const keywords = db.prepare(`
      SELECT k.id, k.keyword, k.target_url, k.region, r.position, r.previous_position
      FROM keywords k
      LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
      WHERE k.project_id = ?
      AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
    `).all(projectId);

    const rankStats = {
      totalKeywords: keywords.length,
      top3: keywords.filter(k => k.position > 0 && k.position <= 3).length,
      top10: keywords.filter(k => k.position > 0 && k.position <= 10).length,
      improved: keywords.filter(k => k.position > 0 && k.position < k.previous_position).length,
      declined: keywords.filter(k => k.position > 0 && k.position > k.previous_position).length
    };

    const htmlContent = buildReportHtml({ project: dashRes, rankStats, keywords });
    const result = await sendReportEmail({
      to: recipients,
      subject: `SEO Rapport ${dashRes.name} (${dashRes.domain.replace(/^https?:\/\//, '')})`,
      html: htmlContent
    });

    res.json({ success: true, result, recipients });
  } catch (err) {
    res.status(500).json({ error: 'Fout bij versturen rapport e-mail: ' + err.message });
  }
});

// ----------------------------------------------------
// Geautomatiseerde ranking check & E-mail rapportage (Dagelijks of Wekelijks)
// ----------------------------------------------------
const AUTO_CHECK_INTERVAL_MS = 60 * 60 * 1000; // elk uur kijken of er iets te doen is

async function runScheduledRankChecks() {
  try {
    const enabledRow = db.prepare("SELECT value FROM settings WHERE key = 'auto_check_enabled'").get();
    if (!enabledRow || enabledRow.value !== '1') return;

    const frequencyRow = db.prepare("SELECT value FROM settings WHERE key = 'auto_check_frequency'").get();
    const frequency = frequencyRow ? frequencyRow.value : 'daily'; // 'daily' of 'weekly'
    const minAgeHours = frequency === 'weekly' ? (7 * 24 - 2) : 22; // 7 dagen (166u) of 22u

    if (!getSerpApiKey()) return;

    const recipientsRow = db.prepare("SELECT value FROM settings WHERE key = 'report_email_recipients'").get();
    const recipients = recipientsRow ? recipientsRow.value.trim() : '';

    const projects = db.prepare('SELECT * FROM projects').all();
    for (const project of projects) {
      const lastCheck = db.prepare(`
        SELECT MAX(r.checked_at) AS last
        FROM keyword_rankings r
        JOIN keywords k ON k.id = r.keyword_id
        WHERE k.project_id = ?
      `).get(project.id);

      const keywordCount = db.prepare('SELECT COUNT(*) AS n FROM keywords WHERE project_id = ?').get(project.id).n;
      if (keywordCount === 0) continue;

      const ageHours = lastCheck && lastCheck.last
        ? (Date.now() - new Date(lastCheck.last + 'Z').getTime()) / 3600000
        : Infinity;

      if (ageHours >= minAgeHours) {
        console.log(`[auto-check] ${frequency === 'weekly' ? 'Wekelijkse' : 'Dagelijkse'} ranking check voor project ${project.id} (${project.name})...`);
        try {
          const results = await checkKeywordRankings(project.id);
          console.log(`[auto-check] ${results.length} zoekwoorden gecheckt voor ${project.name}`);

          // Als er e-mailadressen zijn ingesteld, stuur automatisch het rapport via Resend
          if (recipients) {
            console.log(`[auto-report] Versturen rapport e-mail naar: ${recipients}...`);
            const keywords = db.prepare(`
              SELECT k.id, k.keyword, k.target_url, k.region, r.position, r.previous_position
              FROM keywords k
              LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
              WHERE k.project_id = ?
              AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
            `).all(project.id);

            const rankStats = {
              totalKeywords: keywords.length,
              top3: keywords.filter(k => k.position > 0 && k.position <= 3).length,
              top10: keywords.filter(k => k.position > 0 && k.position <= 10).length,
              improved: keywords.filter(k => k.position > 0 && k.position < k.previous_position).length,
              declined: keywords.filter(k => k.position > 0 && k.position > k.previous_position).length
            };

            const htmlContent = buildReportHtml({ project, rankStats, keywords });
            await sendReportEmail({
              to: recipients,
              subject: `[${frequency === 'weekly' ? 'Wekelijks' : 'Dagelijks'}] SEO Rapport ${project.name}`,
              html: htmlContent
            });
            console.log(`[auto-report] E-mail succesvol verzonden naar ${recipients}`);
          }
        } catch (err) {
          console.error(`[auto-check] Mislukt voor project ${project.id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[auto-check] Fout:', err.message);
  }
}

setInterval(runScheduledRankChecks, AUTO_CHECK_INTERVAL_MS);
setTimeout(runScheduledRankChecks, 60 * 1000); // eerste controle 1 minuut na opstarten

const googleAdsService = require('./services/googleAdsService');
const googleAdsLiveService = require('./services/googleAdsLiveService');

// ----------------------------------------------------
// Google Ads Campaign Studio Endpoints
// ----------------------------------------------------
app.get('/api/google-ads/live-stats', async (req, res) => {
  try {
    const stats = await googleAdsLiveService.fetchLiveAccountStats('1868790470');
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/google-ads/blueprints', (req, res) => {
  res.json({ blueprints: Object.keys(googleAdsService.CAMPAIGN_BLUEPRINTS) });
});

app.get('/api/google-ads/campaigns', (req, res) => {
  try {
    const campaigns = googleAdsService.getAllCampaigns(req.query.projectId);
    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/google-ads/campaigns/:id', (req, res) => {
  try {
    const campaign = googleAdsService.getCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagne niet gevonden' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/google-ads/campaigns', (req, res) => {
  try {
    const { projectId, ...campaignData } = req.body;
    const saved = googleAdsService.saveCampaign(campaignData, projectId);
    res.json({ success: true, campaign: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/google-ads/campaigns/:id', (req, res) => {
  try {
    googleAdsService.deleteCampaign(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/google-ads/generate-blueprint', (req, res) => {
  try {
    const { blueprintKey, customSettings, projectId } = req.body;
    const campaign = googleAdsService.createFromBlueprint(blueprintKey, customSettings, projectId);
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/google-ads/export-csv/:id', (req, res) => {
  try {
    const csvContent = googleAdsService.exportCampaignCSV(req.params.id);
    const campaign = googleAdsService.getCampaignById(req.params.id);
    const filename = `GoogleAds_${(campaign ? campaign.name : 'Campaign').replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all for unmatched /api routes so they return clean JSON 404 errors instead of Express HTML
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route niet gevonden: ${req.method} ${req.originalUrl}` });
});

// ----------------------------------------------------
// Static SPA (production only)
//
// Serving the built frontend from Express puts the UI and the API on one
// origin, which is what the session cookie needs. Must come after every /api
// route so the catch-all cannot swallow them. requireAuth is mounted at /api,
// so it never applies here — the login page itself stays reachable.
// ----------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '../dist');

  // Only dist/. The repo root holds seo_database.db, .env.local and a Google
  // service-account private key.
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));

  // app.get('*') is the Express 4 form; Express 5 would need '/*splat'.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next(); // let real API 404s be 404s
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`SEO Tool Backend Server active on http://localhost:${PORT}`);
  });
}

module.exports = app;
