const axios = require('axios');
const db = require('../db');

async function runPageSpeedAudit(targetUrl, strategy = 'mobile') {
  try {
    // Check environment variables (supporting FS_SEO_PAGESPEED_API), fallback to SQLite settings
    const keyRow = db.prepare("SELECT value FROM settings WHERE key = 'pagespeed_api_key'").get();
    const apiKey = process.env.FS_SEO_PAGESPEED_API || process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY || (keyRow ? keyRow.value : '');

    let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=${strategy}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`;
    if (apiKey) {
      apiUrl += `&key=${apiKey}`;
    }

    const response = await axios.get(apiUrl, { timeout: 25000 });
    const data = response.data;

    const lighthouse = data.lighthouseResult;
    const categories = lighthouse?.categories || {};
    const audits = lighthouse?.audits || {};

    const perfScore = Math.round((categories.performance?.score || 0) * 100);
    const accessScore = Math.round((categories.accessibility?.score || 0) * 100);
    const seoScore = Math.round((categories.seo?.score || 0) * 100);
    const bestScore = Math.round((categories['best-practices']?.score || 0) * 100);

    // Core Web Vitals
    const lcp = audits['largest-contentful-paint']?.displayValue || 'N/B';
    const cls = audits['cumulative-layout-shift']?.displayValue || 'N/B';
    const inp = audits['interaction-to-next-paint']?.displayValue || audits['max-potential-fid']?.displayValue || 'N/B';
    const fcp = audits['first-contentful-paint']?.displayValue || 'N/B';

    // Diagnostics / Key Opportunities
    const diagnostics = [];
    const mainAudits = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'offscreen-images',
      'uses-optimized-images',
      'uses-text-compression',
      'dom-size',
      'viewport'
    ];

    mainAudits.forEach(key => {
      if (audits[key] && audits[key].score !== null && audits[key].score < 0.9) {
        diagnostics.push({
          title: audits[key].title,
          description: audits[key].description,
          displayValue: audits[key].displayValue || '',
          score: audits[key].score
        });
      }
    });

    const result = {
      url: targetUrl,
      strategy,
      performance_score: perfScore,
      accessibility_score: accessScore,
      seo_score: seoScore,
      best_practices_score: bestScore,
      lcp,
      cls,
      inp,
      fcp,
      diagnostics: JSON.stringify(diagnostics),
      created_at: new Date().toISOString()
    };

    return result;
  } catch (error) {
    console.error('PageSpeed API Error:', error.message);
    const apiDetail = error.response?.data?.error?.message || error.message;
    throw new Error(`PageSpeed audit mislukt: ${apiDetail}. Controleer de URL en de API key bij Instellingen.`);
  }
}

module.exports = { runPageSpeedAudit };
