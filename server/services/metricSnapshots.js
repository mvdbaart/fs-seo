const db = require('../db');

/**
 * Dagelijkse metriek-snapshots.
 *
 * Google Search Console bewaart zelf maximaal 16 maanden historie en de
 * GA4/GSC-clients cachen alleen in-memory. Zonder deze tabel is er dus geen
 * enkele langetermijntrend mogelijk. Eén rij per (project, bron, metriek, dag);
 * de unieke index in db.js is de dedupe-strategie, de UPSERT overschrijft.
 * Zo corrigeert nagekomen GSC-data (die 2-3 dagen achterloopt) zichzelf.
 */

const UPSERT = db.prepare(`
  INSERT INTO metric_snapshots (project_id, source, metric, day, value, meta)
  VALUES (@projectId, @source, @metric, @day, @value, @meta)
  ON CONFLICT(project_id, source, metric, day) DO UPDATE SET
    value = excluded.value,
    meta = excluded.meta,
    created_at = CURRENT_TIMESTAMP
`);

const writeMany = db.transaction((rows) => {
  for (const row of rows) UPSERT.run(row);
});

/**
 * @param {number} projectId
 * @param {Array<{source: string, metric: string, day: string, value: number|null, meta?: object}>} rows
 * @returns {number} aantal weggeschreven rijen
 */
function recordSnapshots(projectId, rows) {
  if (!projectId || !Array.isArray(rows) || rows.length === 0) return 0;

  const prepared = rows
    .filter((r) => r && r.source && r.metric && r.day)
    .map((r) => ({
      projectId: Number(projectId),
      source: r.source,
      metric: r.metric,
      day: r.day,
      value: (r.value === null || r.value === undefined || Number.isNaN(Number(r.value)))
        ? null
        : Number(r.value),
      meta: r.meta ? JSON.stringify(r.meta) : null
    }));

  if (prepared.length === 0) return 0;
  writeMany(prepared);
  return prepared.length;
}

/**
 * Tijdreeks voor één metriek, oudste eerst.
 */
function getSeries(projectId, source, metric, days = 90) {
  const rows = db.prepare(`
    SELECT day, value, meta
    FROM metric_snapshots
    WHERE project_id = ? AND source = ? AND metric = ?
      AND day >= date('now', ?)
    ORDER BY day ASC
  `).all(projectId, source, metric, `-${Number(days)} days`);

  return rows.map((r) => ({
    day: r.day,
    value: r.value,
    meta: r.meta ? safeParse(r.meta) : null
  }));
}

/**
 * Heeft dit project al een snapshot voor deze dag? Gebruikt door de scheduler
 * om te bepalen of de dagelijkse capture nog moet draaien.
 */
function hasSnapshot(projectId, source, metric, day) {
  const row = db.prepare(`
    SELECT 1 FROM metric_snapshots
    WHERE project_id = ? AND source = ? AND metric = ? AND day = ?
  `).get(projectId, source, metric, day);
  return !!row;
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

module.exports = { recordSnapshots, getSeries, hasSnapshot };
