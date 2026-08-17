# Architecture and design decisions

Notes on *why* this service is built the way it is. The what is in
[README.md](README.md).

---

## 1. The deduplication problem

This is the core of the service, and it took three separate mechanisms to get
right.

A security pipeline runs on every push. Naively appending each report means a
project scanned fifty times shows fifty copies of the same finding, and the
"Critical: 240" card becomes meaningless. But you also cannot simply ignore
repeat findings, because a finding that *disappears* is information too — it
means someone fixed it.

The resolution: **a report is a complete statement about one app and one tool at
one point in time**, not an increment. So:

### Layer 1 — replace by `(app, tool)`

```js
db.prepare('DELETE FROM vulnerabilities WHERE app = ? AND tool = ?')
  .run(appName, tool);
```

Every ingest wipes all previous findings for that app/tool pair before
inserting, inside a transaction. Re-running a pipeline is therefore idempotent,
and a fixed vulnerability genuinely vanishes from the dashboard.

The trade-off is deliberate: **per-finding history is lost.** You cannot ask
"when did this specific issue first appear?". Layer 3 recovers the aggregate
part of that.

The `(app, tool)` index exists precisely for this delete, which runs on every
single ingest.

### Layer 2 — collapse duplicates inside one report

Scanners can match the same rule against the same file more than once in a
single run. Those are collapsed before insert, keyed on
`severity + title + description + file_path`:

```js
const key = JSON.stringify([v.severity, v.title, v.description, v.file_path]);
```

Deliberately keyed on content, not on any scanner-supplied ID — the formats
differ per tool and IDs are not reliably present. The response reports how many
were skipped, so the caller can see it happened rather than silently losing rows.

### Layer 3 — one-time cleanup at boot

```sql
DELETE FROM vulnerabilities WHERE id NOT IN (
  SELECT MIN(id) FROM vulnerabilities GROUP BY app, severity, tool, title, description, file_path
);
```

Layers 1 and 2 only fix data going forward. This runs once at startup to repair
counts that were already inflated by earlier versions, rather than waiting for
each app/tool to be rescanned. It is a **migration**, not steady-state logic —
once every row has passed through layers 1 and 2 it becomes a no-op, and it
could reasonably be deleted.

---

## 2. Why SQLite

The obvious alternative was PostgreSQL in a third container.

| | SQLite (chosen) | PostgreSQL |
|---|---|---|
| Operational cost | a file in a volume | another container, credentials, healthcheck |
| Concurrency | one writer | many |
| Deployment | copy a file | dump/restore |

The write pattern here is a handful of pipeline runs per day, single writer, and
the read pattern is one dashboard. Concurrency is simply not the constraint, so
the operational simplicity wins. `better-sqlite3` is synchronous, which for
this workload is a feature: no callback or promise plumbing around what are
sub-millisecond queries.

`journal_mode = WAL` is set so the dashboard's reads never block on an ingest
write.

The database lives at `/data/vulns.db` inside the named volume `vuln-data`, and
`fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })` runs first so a fresh
volume works with no manual setup. `DB_PATH` is overridable purely so the thing
can be run locally without a `/data` directory.

---

## 3. Trend snapshots

Because layer 1 destroys per-finding history, the trend chart needs its own
storage. After each ingest, `run_snapshots` records the **database-wide** totals
by severity against that `run_id`:

```sql
INSERT INTO run_snapshots (...) VALUES (...)
ON CONFLICT(run_id) DO UPDATE SET ...
```

Two things worth noting:

- The upsert means a re-run with the same `run_id` **updates** its snapshot
  rather than adding a duplicate point to the chart — consistent with the
  idempotency principle in layer 1.
- The totals are database-wide, not per-tool. So a snapshot written by the
  Semgrep job includes whatever Trivy had already reported. That is intentional
  — the chart answers "how exposed are we overall?" — but it means snapshots
  written mid-pipeline are partial, and the last job of a run holds the
  authoritative figure.

---

## 4. Frontend as a single file

`index.html` is ~700 lines containing markup, CSS and JavaScript, served by a
three-line nginx image. No build step, no bundler, no framework.

For a dashboard that is one screen with two charts and a table, a React
toolchain would add a `node_modules` tree, a build stage in CI and a source-map
story, to render markup that does not change. The single file deploys by copying
one file into nginx.

Where this stops being the right call: a second view, client-side routing, or
any shared component. At that point the absence of a module system starts to
cost more than it saves.

Chart.js comes from a CDN, which keeps the image tiny but means **the dashboard
degrades without internet access** — a real consideration for an on-premise
deployment, and an argument for vendoring the library.

State is kept in module-level variables (`allData`, current filters, sort, page)
and the whole table re-renders on any change. At a few hundred findings that is
imperceptible; it is not a design that scales to tens of thousands of rows.

---

## 5. Two containers, one network

Backend and frontend ship as separate images because they change at different
rates and scale differently — the UI is static and cacheable, the API is not.

The deploy job creates `vuln-network` explicitly and attaches both containers,
so they can resolve each other by name. Ports 3001 and 3002 are published to
the host because the dashboard is fetched by a browser *outside* the Docker
network — which is also why the frontend needs an absolute API URL rather than a
service name, and how the hardcoded IP in `index.html:334` came about.

The cleaner fix is an nginx reverse proxy passing `/api` through to the backend
service, leaving the browser to talk to a single origin. That would remove the
hardcoded address and the need for CORS at the same time.

---

## 6. Deployment shape

The pipeline is `publish` → `deploy`:

- Both images build and push in **parallel** (no `needs` between them)
- `deploy` declares `needs: [publish_backend, publish_frontend]` so it starts
  only once both exist
- Deployment is `stop || true`, `rm || true`, `run` — no rolling update, so
  there is a **short outage on every deploy**. Acceptable for an internal
  dashboard; not for anything user-facing.
- `restart: unless-stopped` covers host reboots.

`StrictHostKeyChecking no` is set in the SSH config. That is a deliberate
convenience for a fixed internal host and a known weakness — it accepts any host
key, so the deploy is vulnerable to a man-in-the-middle on that network. A
pinned `known_hosts` entry would be the correct fix.

---

## 7. What I would change next

In priority order:

1. **Reverse-proxy the API** to kill the hardcoded IP and the CORS dependency.
2. **Tests for the ingest endpoint** — the three deduplication layers are the
   highest-risk logic and are currently unverified.
3. **Authenticate `POST /vulnerabilities`** with a shared token from a CI
   variable.
4. **Vendor Chart.js** so the dashboard works fully offline.
5. **Keep per-finding history** with a `first_seen` / `last_seen` model instead
   of delete-and-replace, which would allow "how long has this been open?"
   — the question the current schema cannot answer.
