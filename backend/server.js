const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '10mb' }));
app.use(cors());

// ── SQLite setup ───────────────────────────────────────────────
// Lives at /data/vulns.db inside the vuln-data Docker volume,
// so findings persist across container restarts and redeploys.
const DB_PATH = process.env.DB_PATH || '/data/vulns.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS vulnerabilities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    app         TEXT NOT NULL,
    tool        TEXT NOT NULL,
    run_id      TEXT NOT NULL DEFAULT 'manual',
    severity    TEXT NOT NULL DEFAULT 'UNKNOWN',
    title       TEXT NOT NULL DEFAULT 'No title',
    description TEXT DEFAULT '',
    file_path   TEXT DEFAULT '',
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_vulns_app_tool ON vulnerabilities (app, tool);

  CREATE TABLE IF NOT EXISTS run_snapshots (
    run_id   TEXT PRIMARY KEY,
    run_at   TEXT NOT NULL,
    total    INTEGER DEFAULT 0,
    critical INTEGER DEFAULT 0,
    high     INTEGER DEFAULT 0,
    medium   INTEGER DEFAULT 0,
    low      INTEGER DEFAULT 0
  );
`);

// ── One-time cleanup of duplicate rows already sitting in the DB ──
// (identical app+severity+tool+title+description+file_path). This
// runs once at boot so existing inflated counts get fixed immediately
// instead of waiting for the next pipeline run to overwrite them.
db.exec(`
  DELETE FROM vulnerabilities
  WHERE id NOT IN (
    SELECT MIN(id) FROM vulnerabilities
    GROUP BY app, severity, tool, title, description, file_path
  );
`);

// ── Receive scan results from the pipeline ─────────────────────
app.post('/vulnerabilities', (req, res) => {
  const { app: appName, tool, run_id: runId, vulnerabilities: newVulns } = req.body;

  if (!appName || !tool || !Array.isArray(newVulns)) {
    return res.status(400).json({
      error: 'Missing required fields: app, tool, vulnerabilities (array)'
    });
  }

  const run = String(runId || 'manual');
  const now = new Date().toISOString();

  // Deduplication: a new report replaces all previous findings from
  // the same app + tool (including earlier runs), so re-running a
  // pipeline never inflates the totals.
  //
  // A single report can also contain the same finding more than once
  // (e.g. a scanner re-matching the same rule against the same file),
  // so we also collapse exact duplicates *within* the incoming batch
  // before inserting, keyed on severity+title+description+file_path.
  const dedupedVulns = [];
  const seen = new Set();
  for (const v of newVulns) {
    const key = JSON.stringify([
      v.severity || 'UNKNOWN',
      v.title || 'No title',
      v.description || '',
      v.file_path || ''
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedVulns.push(v);
  }

  const replaceReport = db.transaction(() => {
    db.prepare('DELETE FROM vulnerabilities WHERE app = ? AND tool = ?')
      .run(appName, tool);

    const insert = db.prepare(`
      INSERT INTO vulnerabilities (app, tool, run_id, severity, title, description, file_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const v of dedupedVulns) {
      insert.run(
        appName,
        tool,
        run,
        v.severity || 'UNKNOWN',
        v.title || 'No title',
        v.description || '',
        v.file_path || '',
        now
      );
    }
  });
  replaceReport();

  // Snapshot DB-wide totals for this run so the trend chart has history
  const snapTotal = db.prepare('SELECT COUNT(*) AS c FROM vulnerabilities').get().c;
  const bySev = db.prepare('SELECT severity, COUNT(*) AS c FROM vulnerabilities GROUP BY severity').all();
  const sevMap = {};
  bySev.forEach(r => { sevMap[r.severity] = r.c; });
  db.prepare(`
    INSERT INTO run_snapshots (run_id, run_at, total, critical, high, medium, low)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      run_at=excluded.run_at, total=excluded.total,
      critical=excluded.critical, high=excluded.high,
      medium=excluded.medium, low=excluded.low
  `).run(run, now, snapTotal,
    sevMap['CRITICAL'] || 0, sevMap['HIGH'] || 0,
    sevMap['MEDIUM']   || 0, sevMap['LOW']  || 0);

  const skipped = newVulns.length - dedupedVulns.length;
  res.json({
    message: `Saved ${dedupedVulns.length} vulnerabilities from ${tool} for ${appName} (run ${run})` +
      (skipped > 0 ? ` — skipped ${skipped} exact duplicate(s) in the report` : '')
  });
});

// ── Send all vulnerabilities to the frontend (optional filters) ─
app.get('/vulnerabilities', (req, res) => {
  const { app: appName, severity, tool } = req.query;

  const clauses = [];
  const params = [];
  if (appName) { clauses.push('app = ?');      params.push(appName); }
  if (severity) { clauses.push('severity = ?'); params.push(severity); }
  if (tool)     { clauses.push('tool = ?');     params.push(tool); }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT * FROM vulnerabilities ${where} ORDER BY created_at DESC, id DESC
  `).all(...params);

  res.json(rows);
});

// ── Summary stats for the dashboard cards ──────────────────────
app.get('/vulnerabilities/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM vulnerabilities').get().c;

  const bySeverity = db.prepare(`
    SELECT severity, COUNT(*) AS count FROM vulnerabilities GROUP BY severity
  `).all();

  const byApp = db.prepare(`
    SELECT app, COUNT(*) AS count FROM vulnerabilities GROUP BY app
  `).all();

  res.json({ total, by_severity: bySeverity, by_app: byApp });
});

// ── Trend data for the history chart ───────────────────────────
app.get('/vulnerabilities/trend', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM run_snapshots ORDER BY run_at ASC'
  ).all();
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT} (db: ${DB_PATH})`);
});