const express = require('express');
const router = express.Router();
const { runScheduledRankChecks, captureDailySnapshots } = require('./services/scheduledTaskService');

/**
 * Vercel Cron Endpoint: /api/cron/rank-check
 * Triggered automatically by Vercel Cron according to vercel.json schedule
 * or by external cron services / webhooks.
 */
router.get('/rank-check', async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers['authorization'];
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Niet geautoriseerd voor cron endpoint (ongeldig CRON_SECRET)' });
      }
    }

    const force = req.query.force === 'true' || req.query.force === '1';
    console.log('[cron] Vercel cron rank-check geactiveerd (force=' + force + ')...');

    const result = await runScheduledRankChecks({ force });
    await captureDailySnapshots();

    res.json({
      success: true,
      message: 'Vercel cron ranking check uitgevoerd',
      result
    });
  } catch (err) {
    console.error('[cron] Fout tijdens cron ranking check:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/rank-check', async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers['authorization'];
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Niet geautoriseerd voor cron endpoint (ongeldig CRON_SECRET)' });
      }
    }

    const force = req.body?.force === true || req.query.force === 'true';
    const result = await runScheduledRankChecks({ force });
    await captureDailySnapshots();

    res.json({
      success: true,
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
