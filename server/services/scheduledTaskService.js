const db = require('../db');
const { checkKeywordRankings, getSerpApiKey } = require('./rankTracker');
const { buildInsightsReport } = require('./insightsEngine');
const { sendReportEmail, buildReportHtml } = require('./emailService');
const { recordSnapshots } = require('./metricSnapshots');

function captureRankingSnapshots(projectId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const keywords = db.prepare(`
      SELECT r.position
      FROM keywords k
      LEFT JOIN keyword_rankings r ON k.id = r.keyword_id
      WHERE k.project_id = ?
        AND (r.id IS NULL OR r.id = (SELECT id FROM keyword_rankings WHERE keyword_id = k.id ORDER BY checked_at DESC LIMIT 1))
    `).all(projectId);

    if (keywords.length === 0) return;

    const top3 = keywords.filter((k) => k.position > 0 && k.position <= 3).length;
    const top10 = keywords.filter((k) => k.position > 0 && k.position <= 10).length;
    const ranked = keywords.filter((k) => k.position > 0);
    const avgPosition = ranked.length > 0
      ? Math.round((ranked.reduce((sum, k) => sum + k.position, 0) / ranked.length) * 10) / 10
      : null;

    const rows = [
      { source: 'rankings', metric: 'top3', day: today, value: top3, meta: null },
      { source: 'rankings', metric: 'top10', day: today, value: top10, meta: null },
      { source: 'rankings', metric: 'totalKeywords', day: today, value: keywords.length, meta: null }
    ];
    if (avgPosition !== null) {
      rows.push({ source: 'rankings', metric: 'avgPosition', day: today, value: avgPosition, meta: null });
    }
    recordSnapshots(projectId, rows);
  } catch (err) {
    console.error(`[snapshots] Ranking snapshots mislukt voor project ${projectId}:`, err.message);
  }
}

async function captureDailySnapshots() {
  const projects = db.prepare('SELECT id FROM projects').all();
  for (const project of projects) {
    try {
      await buildInsightsReport(project.id, { days: 28, refresh: true });
    } catch (err) {
      console.error(`[snapshots] project ${project.id} overgeslagen: ${err.message}`);
    }
  }
}

async function runScheduledRankChecks({ force = false } = {}) {
  const summary = {
    executedAt: new Date().toISOString(),
    checkedProjects: []
  };

  try {
    const enabledRow = db.prepare("SELECT value FROM settings WHERE key = 'auto_check_enabled'").get();
    if (!force && (!enabledRow || enabledRow.value !== '1')) {
      return { ...summary, status: 'skipped', reason: 'auto_check_disabled' };
    }

    const frequencyRow = db.prepare("SELECT value FROM settings WHERE key = 'auto_check_frequency'").get();
    const frequency = frequencyRow ? frequencyRow.value : 'weekly'; // 'daily' of 'weekly'
    const minAgeHours = frequency === 'weekly' ? (7 * 24 - 2) : 22; // 7 dagen (166u) of 22u

    if (!getSerpApiKey()) {
      return { ...summary, status: 'skipped', reason: 'no_serp_api_key' };
    }

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

      if (force || ageHours >= minAgeHours) {
        console.log(`[auto-check] ${frequency === 'weekly' ? 'Wekelijkse' : 'Dagelijkse'} ranking check voor project ${project.id} (${project.name})...`);
        try {
          const results = await checkKeywordRankings(project.id);
          console.log(`[auto-check] ${results.length} zoekwoorden gecheckt voor ${project.name}`);

          let emailSent = false;
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
            emailSent = true;
            console.log(`[auto-report] E-mail succesvol verzonden naar ${recipients}`);
          }

          captureRankingSnapshots(project.id);

          summary.checkedProjects.push({
            projectId: project.id,
            name: project.name,
            keywordCount: results.length,
            emailSent,
            recipients: emailSent ? recipients : null
          });
        } catch (err) {
          console.error(`[auto-check] Mislukt voor project ${project.id}:`, err.message);
          summary.checkedProjects.push({
            projectId: project.id,
            name: project.name,
            error: err.message
          });
        }
      }
    }

    summary.status = 'completed';
    return summary;
  } catch (err) {
    console.error('[auto-check] Fout:', err.message);
    return { ...summary, status: 'error', error: err.message };
  }
}

module.exports = {
  runScheduledRankChecks,
  captureDailySnapshots,
  captureRankingSnapshots
};
